import json
import os
import numpy as np
import csv
import re
import cv2
import xml.etree.ElementTree as ET
import argparse
from collections import defaultdict
from multiprocessing import Pool, cpu_count

# --- Constants ---
SURFACE_SNAPPING_RADIUS = 0.15

def get_transform_matrix(rsinfo_path):
    if not rsinfo_path or not os.path.exists(rsinfo_path): return np.eye(4)
    try:
        with open(rsinfo_path, 'r') as f:
            content = "<root>" + f.read() + "</root>"
        root = ET.fromstring(content)
        transform_str = root.find(".//Model").attrib.get("transformToModel", "1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1")
        nums = [float(x) for x in transform_str.split()]
        return np.array(nums).reshape(4, 4).T
    except: return np.eye(4)

_verts = None
_norms = None
_grid = None
_cameras = None
_T_model = None
_filters = {}

def save_crop_worker(args):
    hit_idx, h, img_dir, crop_dir = args
    crop_path = os.path.join(crop_dir, f"hit_{hit_idx}.jpg")
    img_path = os.path.join(img_dir, h['img'])
    img = cv2.imread(img_path)
    if img is not None:
        ux, uy = int(h['uv'][0]), int(h['uv'][1])
        y1, y2 = max(0, uy-200), min(img.shape[0], uy+200)
        x1, x2 = max(0, ux-200), min(img.shape[1], ux+200)
        crop = img[y1:y2, x1:x2].copy()
        cv2.circle(crop, (ux-x1, uy-y1), 25, (0, 255, 255), 2)
        cv2.imwrite(crop_path, crop)
        return crop_path
    return None

def run_pipeline():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out_dir", required=True)
    parser.add_argument("--det", required=True)
    parser.add_argument("--reg", required=True)
    parser.add_argument("--model")
    parser.add_argument("--img_dir", required=True)
    parser.add_argument("--crop_dir", default="hit_crops_dashboard")
    parser.add_argument("--html", default="bolt_dashboard_alice_0045.html")
    parser.add_argument("--rsinfo")
    parser.add_argument("--rx", type=float, default=0)
    parser.add_argument("--ry", type=float, default=0)
    parser.add_argument("--rz", type=float, default=0)
    parser.add_argument("--min_conf", type=float, default=0.3)
    parser.add_argument("--max_edge_dist", type=float, default=0.6)
    parser.add_argument("--min_angle_dot", type=float, default=0.2)
    parser.add_argument("--gps", help="Path to gps_data.json")
    args = parser.parse_args()

    if not os.path.exists(args.crop_dir): os.makedirs(args.crop_dir)
    
    gps_data = {}
    if args.gps and os.path.exists(args.gps):
        with open(args.gps, 'r') as f:
            gps_data = json.load(f)
            # Ensure keys are ints
            gps_data = {int(k): v for k, v in gps_data.items()}

    math_mesh_path = os.path.join(args.out_dir, "mesh_filtered.obj")
    model_path = args.model if args.model else os.path.join(args.out_dir, "model.glb")
    
    import trimesh
    import warnings
    warnings.filterwarnings("ignore", category=DeprecationWarning) 
    
    if os.path.exists(math_mesh_path):
        print(f"[*] Processing raw mesh for math: {math_mesh_path}")
        mesh = trimesh.load(math_mesh_path, process=False)
    else:
        print(f"[*] Processing model for math: {model_path}")
        scene = trimesh.load(model_path)
        mesh = scene.to_geometry() if hasattr(scene, 'to_geometry') else (scene.dump(concatenate=True) if hasattr(scene, 'dump') else scene)

    rsinfo_path = args.rsinfo if args.rsinfo else model_path + ".rsInfo"
    T_model = get_transform_matrix(rsinfo_path)
    verts_model = np.array(mesh.vertices, dtype=np.float32)
    norms_model = np.array(mesh.vertex_normals, dtype=np.float32)
    T_inv = np.linalg.inv(T_model)
    verts = (np.hstack([verts_model, np.ones((len(verts_model), 1), dtype=np.float32)]) @ T_inv.T)[:, :3]
    norms = norms_model @ T_inv[:3, :3].T
    norms /= np.linalg.norm(norms, axis=1, keepdims=True)

    grid = defaultdict(list)
    for idx, v in enumerate(verts): grid[tuple((v / 0.5).astype(int))].append(idx)
    
    cameras = {}; is_alicevision = False
    if args.reg.endswith('.sfm') or args.reg.endswith('.json'):
        print(f"[*] Loading reconstruction: {args.reg}")
        with open(args.reg, 'r') as f: data = json.load(f)
        if isinstance(data, dict) and 'views' in data and 'poses' in data:
            print("[*] Detected AliceVision format")
            is_alicevision = True
            view_map = {v['poseId']: v for v in data['views']}
            intrinsics_map = {i['intrinsicId']: i for i in data['intrinsics']}
            for p in data['poses']:
                pose_id = p['poseId']
                if pose_id not in view_map: continue
                view = view_map[pose_id]
                match = re.search(r'frame(\d+)', view['path'])
                f_idx = int(match.group(1)) if match else int(view.get('frameId', 0))
                # ALIGNMENT: AliceVision provides World-to-Camera rotation and World Center
                R_w2c = np.array([float(x) for x in p['pose']['transform']['rotation']]).reshape(3, 3)
                C_world = np.array([float(x) for x in p['pose']['transform']['center']])
                
                # ALIGNMENT: AliceVision [R|C] -> Mesh Space [X, -Y, -Z]
                R_raw = np.array([float(x) for x in p['pose']['transform']['rotation']]).reshape(3, 3)
                C_raw = np.array([float(x) for x in p['pose']['transform']['center']])
                
                # Flip Center to match [X, -Y, -Z] mesh
                C_mesh = np.array([C_raw[0], -C_raw[1], -C_raw[2]])
                
                # Use raw R but flip the rows corresponding to flipped axes
                # R_mesh = R_raw with Y and Z rows negated
                R_mesh = R_raw.copy()
                R_mesh[1, :] *= -1
                R_mesh[2, :] *= -1
                t_mesh = -R_mesh @ C_mesh

                intr = intrinsics_map.get(view['intrinsicId'], {})
                width, height = float(view.get('width', 3840)), float(view.get('height', 2160))
                f_mm = float(intr.get('focalLength', 1.0))
                sw_mm = float(intr.get('sensorWidth', 36.0))
                f_px = f_mm * (width / sw_mm)
                pp_offset = intr.get('principalPoint', [0, 0])
                
                # Principal Point: AliceVision uses offset from center
                px, py = (width / 2.0) + float(pp_offset[0]), (height / 2.0) + float(pp_offset[1])
                
                # Map AliceVision [k1, k2, k3] to OpenCV [k1, k2, p1, p2, k3]
                raw_dist = [float(x) for x in intr.get('distortionParams', [0,0,0])]
                dist_params = np.array([raw_dist[0] if len(raw_dist)>0 else 0, 
                                        raw_dist[1] if len(raw_dist)>1 else 0, 
                                        0, 0, 
                                        raw_dist[2] if len(raw_dist)>2 else 0], dtype=np.float32)

                cameras[f_idx] = {
                    'R': R_mesh.astype(np.float32), 't': t_mesh.astype(np.float32),
                    'K': np.array([[f_px, 0, px], [0, f_px, py], [0, 0, 1]], dtype=np.float32),
                    'dist': dist_params,
                    'img': os.path.basename(view['path']), 'pp': [px, py], 'w': width, 'h': height
                }
        elif isinstance(data, list) and len(data) > 0:
            pass
    else:
        print(f"[*] Loading RealityCapture registration: {args.reg}")
        with open(args.reg, 'r') as f: lines = f.readlines()
        header = [h.strip().replace('#', '') for h in next(csv.reader([lines[0]]))[:22]]
        for row_raw in csv.reader([l for l in lines if not l.startswith('#') and l.strip()]):
            row = {header[i]: row_raw[i] for i in range(len(header))}
            match = re.search(r'frame(\d+)', row['name'])
            if not match: continue
            f_idx = int(match.group(1))
            px, py = float(row['px']), float(row['py'])
            f_px = float(row['f'])
            cameras[f_idx] = {
                'R': np.array([[float(row['R00']), float(row['R01']), float(row['R02'])],[float(row['R10']), float(row['R11']), float(row['R12'])],[float(row['R20']), float(row['R21']), float(row['R22'])]], dtype=np.float32),
                't': np.array([float(row['tx']), float(row['ty']), float(row['tz'])], dtype=np.float32),
                'K': np.array([[f_px, 0, px], [0, f_px, py], [0, 0, 1]], dtype=np.float32),
                'dist': np.array([float(row['k1']), float(row['k2']), float(row['t2']), float(row['t1']), float(row['k3'])], dtype=np.float32),
                'img': row['name'], 'pp': [px, py], 'w': 3840.0, 'h': 2160.0 # Default for RC images
            }

    cam_positions_glb = {}
    for f_idx, cam in cameras.items():
        C_reg = -cam['R'].T @ cam['t']
        C_glb = (T_model @ np.append(C_reg, 1.0))[:3]
        cam_positions_glb[f_idx] = C_glb.tolist()

    with open(args.det, 'r') as f: detections_data = json.load(f)
    print(f"[*] Processing {len(detections_data['frames'])} frames for hits...")
    
    # Prepare all rays for vectorized intersection
    ray_origins = []
    ray_directions = []
    ray_meta = []
    
    for frame in detections_data['frames']:
        f_idx = frame['frame_index']
        if f_idx not in cameras: continue
        cam = cameras[f_idx]
        C_reg = -cam['R'].T @ cam['t']
        
        # Transform camera center to Model space
        C_model = (T_model @ np.append(C_reg, 1.0))[:3]

        for det in frame['detections']:
            if det['confidence'] < args.min_conf: continue
            
            px, py = (det['bbox_xyxy'][0] + det['bbox_xyxy'][2]) / 2.0, (det['bbox_xyxy'][1] + det['bbox_xyxy'][3]) / 2.0
            
            # Resolution-aware edge distance
            width, height = cam.get('w', 3840.0), cam.get('h', 2160.0)
            dx, dy = (px - cam['pp'][0]) / width, (py - cam['pp'][1]) / height
            edge_dist = np.sqrt(dx**2 + dy**2)
            if edge_dist > args.max_edge_dist: continue

            pts_u = cv2.undistortPoints(np.array([[[px, py]]], dtype=np.float32), cam['K'], cam['dist'], P=cam['K'])
            ux, uy = pts_u[0][0]
            p_cam = np.array([(ux-cam['K'][0,2])/cam['K'][0,0], (uy-cam['K'][1,2])/cam['K'][1,1], 1.0])
            D_reg = cam['R'].T @ p_cam; D_reg /= np.linalg.norm(D_reg)
            
            # Transform ray direction to Model space
            D_model = (T_model[:3, :3] @ D_reg)
            D_model /= np.linalg.norm(D_model)

            ray_origins.append(C_model)
            ray_directions.append(D_model)
            ray_meta.append({
                'conf': det['confidence'], 'edge_dist': edge_dist, 'img': cam['img'], 
                'uv': [px, py], 'class': det['class_name'], 'C_model': C_model, 'D_model': D_model
            })

    # Vectorized Ray-Mesh Intersection in batches
    print(f"[*] Casting {len(ray_origins)} rays using trimesh...")
    all_locations = []
    all_index_ray = []
    all_index_tri = []
    
    batch_size = 100
    for i in range(0, len(ray_origins), batch_size):
        end = min(i + batch_size, len(ray_origins))
        print(f"[*]   Batch {i//batch_size + 1}: rays {i} to {end}...")
        locs, idx_ray, idx_tri = mesh.ray.intersects_location(
            ray_origins[i:end], ray_directions[i:end], multiple_hits=False)
        
        # Adjust indices for the full list
        all_locations.extend(locs)
        all_index_ray.extend(idx_ray + i)
        all_index_tri.extend(idx_tri)
    
    all_hits = []
    for i in range(len(all_locations)):
        p_model = all_locations[i]
        meta = ray_meta[all_index_ray[i]]
        
        # Get normal at intersection
        norm_model = mesh.face_normals[all_index_tri[i]]
        normal_dot = abs(np.dot(meta['D_model'], norm_model))
        
        if normal_dot < args.min_angle_dot: continue
        
        # Camera position and distance in Model space
        C_model = meta['C_model']
        cam_dist = np.linalg.norm(C_model - p_model)

        all_hits.append({
            'pos': p_model.tolist(), 'cam_pos': C_model.tolist(), 'conf': float(meta['conf']), 
            'edge_dist': float(meta['edge_dist']), 'img': meta['img'], 'uv': meta['uv'], 
            'normal_dot': float(normal_dot), 'class': meta['class'], 'norm': norm_model.tolist(),
            'cam_dist': float(cam_dist)
        })

    print(f"[*] Total Hits: {len(all_hits)}. Generating Dashboard...")
    all_hits = sorted(all_hits, key=lambda x: x['conf'], reverse=True)[:10000]
    crop_args = [(i, h, args.img_dir, args.crop_dir) for i, h in enumerate(all_hits)]
    num_procs = cpu_count()
    with Pool(num_procs) as pool:
        crop_paths = pool.map(save_crop_worker, crop_args)
        html_dir = os.path.dirname(os.path.abspath(args.html))
        for i, path in enumerate(crop_paths): 
            if path: all_hits[i]['crop'] = os.path.relpath(os.path.abspath(path), html_dir)
            else: all_hits[i]['crop'] = None

    viewer_rel_path = os.path.relpath(model_path, os.path.dirname(os.path.abspath(args.html)))
    
    html_template = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
        <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"></script>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
        :root {{ --bg: #0f0f0f; --panel: #1a1a1a; --border: #333; --accent: #00ffff; --text: #eee; }}
        body {{ margin: 0; display: flex; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; height: 100vh; overflow: hidden; }}
        #viewer-container {{ flex: 3; height: 100vh; position: relative; border-right: 1px solid var(--border); }}
        model-viewer {{ width: 100%; height: 100%; background-color: #111; }}
        #side-panel {{ flex: 1; height: 100vh; background: var(--panel); overflow-y: auto; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; }}
        .gallery {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 20px; }}
        .gallery img {{ width: 100%; border-radius: 6px; border: 1px solid #444; cursor: zoom-in; }}
        h2 {{ margin: 0 0 8px 0; color: var(--accent); font-size: 20px; }}
        .meta {{ font-size: 13px; color: #aaa; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }}
        .controls {{ position: absolute; top: 20px; left: 20px; background: rgba(20,20,20,0.9); padding: 20px; border-radius: 12px; border: 1px solid var(--border); z-index: 100; width: 280px; max-height: 80vh; overflow-y: auto; }}
        .ctrl-group {{ background: rgba(255,255,255,0.03); border-radius: 8px; padding: 12px; margin-bottom: 12px; }}
        .ctrl-row {{ margin-bottom: 10px; }}
        .ctrl-row label {{ display: flex; justify-content: space-between; font-size: 11px; color: #888; }}
        input[type=range] {{ width: 100%; cursor: pointer; }}
        .hotspot {{ width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; cursor: pointer; padding: 0; margin: 0; outline: none; appearance: none; -webkit-appearance: none; background-color: white; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }}
        .hotspot.alt-class {{ clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); border-radius: 0; border: none; background-color: white !important; position: relative; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }}
        .hotspot.alt-class::after {{ content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: var(--hex-color, #fff); clip-path: inherit; transform: scale(0.8); z-index: 1; }}
        .annotation {{ background: rgba(255,255,255,0.9); border-radius: 4px; color: #000; font-size: 10px; font-weight: bold; padding: 2px 4px; position: absolute; top: -18px; left: 10px; white-space: nowrap; pointer-events: none; }}
        .cam-hotspot {{ width: 10px; height: 10px; background: #ffff00; border-radius: 50%; border: 1px solid #000; pointer-events: none; z-index: 50; }}
        .hit-hotspot {{ width: 6px; height: 6px; background: rgba(255,255,255,0.8); border-radius: 50%; border: 1px solid #000; pointer-events: auto; z-index: 200; transition: transform 0.1s; }}
        .hit-hotspot:hover {{ transform: scale(2.5); background: #00ffff; border-color: #fff; z-index: 300; }}
        .hit-hotspot.highlight {{ transform: scale(2.5); background: #00ffff; border-color: #fff; z-index: 300; box-shadow: 0 0 10px #00ffff; }}
        .gallery-item {{ position: relative; transition: outline 0.1s; outline: 2px solid transparent; border-radius: 4px; }}
        .gallery-item.highlight {{ outline: 3px solid #00ffff; z-index: 10; transform: scale(1.05); }}
        #hit-inspector {{ position: absolute; bottom: 20px; right: 20px; background: rgba(20,20,20,0.9); padding: 15px; border-radius: 10px; border: 1px solid var(--border); font-size: 11px; width: 220px; pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 500; }}
        #hit-inspector b {{ color: var(--accent); display: block; margin-bottom: 8px; font-size: 12px; }}
        .stat-row {{ display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px; }}
        .stat-row span {{ color: #888; }}
        #lightbox {{ display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; justify-content: center; align-items: center; }}
        #lightbox img {{ max-width: 90%; max-height: 90%; border: 2px solid var(--accent); }}
        #map-container {{ width: 100%; height: 200px; margin-top: 20px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }}
        </style></head><body>
        <div id="lightbox" onclick="this.style.display='none'"><img src="" id="lightbox-img"></div>
        <div id="hit-inspector"></div>
        <div id="viewer-container">
        <div class="controls"><b>Bolt Dashboard</b>
        <div class="ctrl-group">
            <div class="ctrl-row"><label>Cluster Radius <span id="r-val">0.20m</span></label><input type="range" id="r-clust" min="0.0" max="1.5" step="0.01" value="0.20" oninput="recluster()"></div>
        </div>
        <div class="ctrl-group">
            <div class="ctrl-row"><label>Hard Cutoffs</label>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <div id="row-c-cut">
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">Min Confidence <span id="c-cut-val">23%</span></div>
                        <input type="range" id="c-cut" min="0" max="100" value="23" oninput="recluster()">
                    </div>
                    <div id="row-e-cut">
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">Max Edge Dist <span id="e-cut-val">1.00</span></div>
                        <input type="range" id="e-cut" min="0" max="1.0" step="0.01" value="1.00" oninput="recluster()">
                    </div>
                    <div id="row-a-cut">
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">Min Angle Cos <span id="a-cut-val">0.66</span></div>
                        <input type="range" id="a-cut" min="0" max="1" step="0.01" value="0.66" oninput="recluster()">
                    </div>
                    <div id="row-d-cut">
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">Max Cam Dist <span id="d-cut-val">50m</span></div>
                        <input type="range" id="d-cut" min="0" max="50" step="0.5" value="50" oninput="recluster()">
                    </div>
                    <div id="row-s-cut">
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">Min View Spread <span id="s-cut-val">0.40m</span></div>
                        <input type="range" id="s-cut" min="0" max="2" step="0.05" value="0.40" oninput="recluster()">
                    </div>
                    <div id="row-o-cut">
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">Min Observations <span id="o-cut-val">4</span></div>
                        <input type="range" id="o-cut" min="1" max="50" step="1" value="4" oninput="recluster()">
                    </div>
                </div>
            </div>
        </div>
        <div class="ctrl-group">
            <div class="ctrl-row"><label>Global Rotation</label>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">X <span id="rx-val">{args.rx}deg</span></div>
                    <input type="range" id="rot-x" min="-180" max="180" value="{args.rx}" oninput="updateRotation()">
                    <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">Y <span id="ry-val">{args.ry}deg</span></div>
                    <input type="range" id="rot-y" min="-180" max="180" value="{args.ry}" oninput="updateRotation()">
                    <div style="display:flex; justify-content:space-between; font-size:9px; color:#666">Z <span id="rz-val">{args.rz}deg</span></div>
                    <input type="range" id="rot-z" min="-180" max="180" value="{args.rz}" oninput="updateRotation()">
                </div>
            </div>
        </div>
        <div class="ctrl-group" style="border-color: var(--accent);">
            <div style="font-size:11px;">Visible Clusters: <span id="visible-count-ui">0</span></div>
            <div style="margin-top:10px; display:flex; gap:10px; flex-wrap: wrap;">
                <label style="font-size:10px;"><input type="checkbox" id="show-ann" checked onchange="recluster()"> Labels</label>
                <label style="font-size:10px;"><input type="checkbox" id="show-cams" onchange="toggleCams()"> Camera Trail</label>
            </div>
            <button onclick="exportVisibleBolts()" style="margin-top:12px; width:100%; background:var(--accent); color:#000; border:none; border-radius:4px; padding:6px; font-size:11px; font-weight:bold; cursor:pointer;">Export Visible Bolts (.json)</button>
        </div>
        </div>
        <model-viewer id="mv" src="{viewer_rel_path}" camera-controls shadow-intensity="1" orientation="{args.rz}deg {args.rx}deg {args.ry}deg"></model-viewer></div>
        <div id="side-panel">
            <h2 id="title">Bolt Inspection</h2>
            <div id="filter-info" style="font-size: 11px; color: #888; margin-bottom: 16px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border);">
                <b style="color: var(--accent); display: block; margin-bottom: 4px;">Dynamic Pipeline Waterfall</b>
                <div style="display: grid; grid-template-columns: 1fr 60px 40px; gap: 4px; font-size: 10px;">
                    <span style="color:#eee">Input Hits</span> <span id="stat-total" style="text-align:right">-</span> <span></span>
                    
                    <span style="color:#666">→ Conf Filter</span> <span id="stat-conf" style="text-align:right">-</span> <span id="stat-conf-cut" style="color:#f44; font-size:9px; text-align:right"></span>
                    <span style="color:#666">→ Edge Filter</span> <span id="stat-edge" style="text-align:right">-</span> <span id="stat-edge-cut" style="color:#f44; font-size:9px; text-align:right"></span>
                    <span style="color:#666">→ Angle Filter</span> <span id="stat-angle" style="text-align:right">-</span> <span id="stat-angle-cut" style="color:#f44; font-size:9px; text-align:right"></span>
                    <span style="color:#666">→ Cam Dist Filter</span> <span id="stat-dist" style="text-align:right">-</span> <span id="stat-dist-cut" style="color:#f44; font-size:9px; text-align:right"></span>
                    
                    <b style="color:#eee; border-top:1px solid #333; margin-top:4px; padding-top:4px;">Clustered Hits</b> <b id="stat-final-hits" style="text-align:right; border-top:1px solid #333; margin-top:4px; padding-top:4px;">-</b> <span></span>
                    
                    <span style="color:#eee; margin-top:8px;">Initial Clusters</span> <span id="stat-clusters" style="text-align:right; margin-top:8px;">-</span> <span></span>
                    <span style="color:#666">→ Spread Filter</span> <span id="stat-spread" style="text-align:right">-</span> <span id="stat-spread-cut" style="color:#f44; font-size:9px; text-align:right"></span>
                    <span style="color:#666">→ Obs Filter</span> <span id="stat-obs" style="text-align:right">-</span> <span id="stat-obs-cut" style="color:#f44; font-size:9px; text-align:right"></span>
                    
                    <b style="color:var(--accent); border-top:1px solid #333; margin-top:4px; padding-top:4px;">Final Clusters</b> <b id="stat-final-clusters" style="text-align:right; border-top:1px solid #333; margin-top:4px; padding-top:4px;">-</b> <span></span>
                </div>
            </div>
            <div id="meta-info" class="meta">Select a marker.</div>
            <div id="gallery" class="gallery"></div>
            <div style="flex-grow: 1;"></div>
            <div id="map-container"></div>
        </div>
        <script>
        const allHits = {json.dumps(all_hits)}; const camPositions = {json.dumps(cam_positions_glb)};
        const gpsData = {json.dumps(gps_data)};
        const mv = document.getElementById('mv'); let clusters = [];

        // Map Initialization
        let map, dronePath;
        function initMap() {{
            const gpsKeys = Object.keys(gpsData).sort((a,b)=>a-b);
            if(gpsKeys.length === 0) {{
                document.getElementById('map-container').style.display = 'none';
                return;
            }}
            
            const points = gpsKeys.map(k => [gpsData[k].latitude, gpsData[k].longitude]);
            const center = points[Math.floor(points.length / 2)];
            
            map = L.map('map-container').setView(center, 18);
            L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
                maxZoom: 23,
                maxNativeZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }}).addTo(map);
            
            dronePath = L.polyline(points, {{color: '#00ffff', weight: 3, opacity: 0.7}}).addTo(map);
            L.marker(center).addTo(map).bindPopup("Model Location").openPopup();
            map.fitBounds(dronePath.getBounds());
        }}
        initMap();

        function estimateGps(pGlb) {{
            const pairs = [];
            for (let fIdx in camPositions) {{
                if (gpsData[fIdx]) {{
                    pairs.push({{
                        glb: camPositions[fIdx],
                        gps: [gpsData[fIdx].latitude, gpsData[fIdx].longitude, gpsData[fIdx].abs_alt || gpsData[fIdx].rel_alt || 0]
                    }});
                }}
            }}
            if (pairs.length === 0) return null;

            const nearest = pairs
                .map(p => ({{ p, d: dist(pGlb, p.glb) }}))
                .sort((a,b) => a.d - b.d)
                .slice(0, 5);
            
            if (nearest[0].d < 0.001) return nearest[0].p.gps;

            let weightSum = 0;
            let estGps = [0,0,0];
            nearest.forEach(n => {{
                const w = 1.0 / Math.pow(n.d, 2);
                weightSum += w;
                for(let i=0; i<3; i++) estGps[i] += n.p.gps[i] * w;
            }});
            return estGps.map(v => v / weightSum);
        }}

        function initSliders() {{
            const stats = {{
                'c-cut': {{ min: 100, max: 0, val: h => h.conf * 100, type: 'min' }},
                'e-cut': {{ min: 1, max: 0, val: h => h.edge_dist, type: 'max' }},
                'a-cut': {{ min: 1, max: 0, val: h => h.normal_dot, type: 'min' }},
                'd-cut': {{ min: 1000, max: 0, val: h => h.cam_dist, type: 'max' }}
            }};
            
            allHits.forEach(h => {{
                for(let id in stats) {{
                    const v = stats[id].val(h);
                    if(v < stats[id].min) stats[id].min = v;
                    if(v > stats[id].max) stats[id].max = v;
                }}
            }});

            const rSlider = document.getElementById('r-clust');
            if(rSlider) {{
                const dMax = stats['d-cut'].max;
                rSlider.value = (dMax * (0.07 / 3.3)).toFixed(2);
            }}

            for(let id in stats) {{
                const el = document.getElementById(id);
                if(!el) continue;
                const s = stats[id];
                
                // Scale slider to data exactly
                el.min = s.min.toFixed(3);
                el.max = s.max.toFixed(3);
                el.step = ((s.max - s.min) / 100).toFixed(4);
                
                // Set smart default (1/3rd from the "best" side)
                if(s.type === 'min') {{
                    el.value = (s.min + (s.max - s.min) / 3).toFixed(3);
                }} else {{
                    el.value = (s.max - (s.max - s.min) / 3).toFixed(3);
                }}
            }}
        }}

        function rotatePoint(p, rx, ry, rz) {{
            let [x, y, z] = p;
            const d2r = Math.PI / 180;
            const ax = rx * d2r, ay = ry * d2r, az = rz * d2r;
            let x1 = x * Math.cos(az) - y * Math.sin(az);
            let y1 = x * Math.sin(az) + y * Math.cos(az);
            x = x1; y = y1;
            let y2 = y * Math.cos(ax) - z * Math.sin(ax);
            let z2 = y * Math.sin(ax) + z * Math.cos(ax);
            y = y2; z = z2;
            let x3 = x * Math.cos(ay) + z * Math.sin(ay);
            let z3 = -x * Math.sin(ay) + z * Math.cos(ay);
            x = x3; z = z3;
            return [x, y, z];
        }}

        window.updateRotation = () => {{
            const rx = parseFloat(document.getElementById('rot-x').value);
            const ry = parseFloat(document.getElementById('rot-y').value);
            const rz = parseFloat(document.getElementById('rot-z').value);
            document.getElementById('rx-val').innerText = rx + "deg";
            document.getElementById('ry-val').innerText = ry + "deg";
            document.getElementById('rz-val').innerText = rz + "deg";
            mv.setAttribute('orientation', `${{rz}}deg ${{rx}}deg ${{ry}}deg`);
            recluster();
            if(document.getElementById('show-cams').checked) toggleCams();
        }};

        function getHSL(q) {{ let h; if(q<40) h=(q/40)*20; else if(q<80) h=20+((q-40)/40)*70; else h=90+((q-80)/20)*10; return "hsl("+(h*1.2)+", 100%, 50%)"; }}
        function dist(p1, p2) {{ return Math.sqrt(Math.pow(p1[0]-p2[0],2)+Math.pow(p1[1]-p2[1],2)+Math.pow(p1[2]-p2[2],2)); }}
        
        window.exportVisibleBolts = () => {{
            const originGps = estimateGps([0, 0, 0]);
            
            const exportData = {{ 
                fixPoints: clusters.map(c => ({{
                    id: Math.random().toString(36).substring(2),
                    position: c.anchor,
                    type: c.class
                }})),
                coordinates: originGps ? [originGps[1], originGps[0]] : null,
                altitude: originGps ? originGps[2] : null
            }};
            const blob = new Blob([JSON.stringify(exportData, null, 4)], {{type: "application/json"}});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = "bolts_export.json"; a.click(); URL.revokeObjectURL(url);
        }};

        window.recluster = () => {{
            const radius = parseFloat(document.getElementById('r-clust').value); 
            const cCut = parseFloat(document.getElementById('c-cut').value) / 100.0;
            const eCut = parseFloat(document.getElementById('e-cut').value);
            const aCut = parseFloat(document.getElementById('a-cut').value);
            const dCut = parseFloat(document.getElementById('d-cut').value);
            const sCut = parseFloat(document.getElementById('s-cut').value);
            const oCut = parseInt(document.getElementById('o-cut').value);
            
            document.getElementById('r-val').innerText = radius.toFixed(2) + "m";
            document.getElementById('c-cut-val').innerText = (cCut*100).toFixed(0) + "%";
            document.getElementById('e-cut-val').innerText = eCut.toFixed(2);
            document.getElementById('a-cut-val').innerText = aCut.toFixed(2);
            document.getElementById('d-cut-val').innerText = dCut.toFixed(1) + "m";
            document.getElementById('s-cut-val').innerText = sCut.toFixed(2) + "m";
            document.getElementById('o-cut-val').innerText = oCut;

            const rx = parseFloat(document.getElementById('rot-x').value);
            const ry = parseFloat(document.getElementById('rot-y').value);
            const rz = parseFloat(document.getElementById('rot-z').value);
            const showAnn = document.getElementById('show-ann').checked;

            document.getElementById('stat-total').innerText = allHits.length;
            let h1 = allHits.filter(h => h.conf >= cCut);
            let h2 = h1.filter(h => h.edge_dist <= eCut);
            let h3 = h2.filter(h => h.normal_dot >= aCut);
            let h4 = h3.filter(h => dist(h.pos, h.cam_pos) <= dCut);
            
            const updateStat = (id, count, prevCount) => {{
                document.getElementById(id).innerText = count;
                const cut = prevCount - count;
                document.getElementById(id+'-cut').innerText = cut > 0 ? "-"+cut : "";
            }};
            
            updateStat('stat-conf', h1.length, allHits.length);
            updateStat('stat-edge', h2.length, h1.length);
            updateStat('stat-angle', h3.length, h2.length);
            updateStat('stat-dist', h4.length, h3.length);
            document.getElementById('stat-final-hits').innerText = h4.length;

            let tempClusters = [];
            h4.forEach(h => {{
                let found = false;
                for(let c of tempClusters) {{ if(dist(h.pos, c.anchor) < radius && c.class === h.class) {{ if (!c.members.some(m => m.img === h.img)) {{ c.members.push(h); found = true; break; }} }} }}
                if(!found) tempClusters.push({{ anchor: h.pos, class: h.class, members: [h] }});
            }});

            document.getElementById('stat-clusters').innerText = tempClusters.length;
            let c1 = tempClusters.filter(c => {{
                let ms = 0; for(let i=0; i<c.members.length; i++) for(let j=i+1; j<c.members.length; j++) ms = Math.max(ms, dist(c.members[i].cam_pos, c.members[j].cam_pos));
                c.spread_val = ms; return ms >= sCut;
            }});
            updateStat('stat-spread', c1.length, tempClusters.length);
            clusters = c1.filter(c => c.members.length >= oCut);
            updateStat('stat-obs', clusters.length, c1.length);
            document.getElementById('stat-final-clusters').innerText = clusters.length;
            document.getElementById('visible-count-ui').innerText = clusters.length;

            clusters.forEach((c, idx) => {{
                const hts = c.members; c.id = idx; 
                c.conf = (hts.reduce((a,b)=>a+b.conf,0)/hts.length)*100;
                c.avg_angle = hts.reduce((a,b)=>a+b.normal_dot,0)/hts.length;
                c.anchor = [hts.reduce((a,b)=>a+b.pos[0],0)/hts.length, hts.reduce((a,b)=>a+b.pos[1],0)/hts.length, hts.reduce((a,b)=>a+b.pos[2],0)/hts.length];
                const avgNorm = [hts.reduce((a,b)=>a+b.norm[0],0)/hts.length, hts.reduce((a,b)=>a+b.norm[1],0)/hts.length, hts.reduce((a,b)=>a+b.norm[2],0)/hts.length];
                const nLen = Math.sqrt(avgNorm[0]**2 + avgNorm[1]**2 + avgNorm[2]**2) + 1e-6;
                const finalNorm = [avgNorm[0]/nLen, avgNorm[1]/nLen, avgNorm[2]/nLen];
                const dPos = [c.anchor[0] + finalNorm[0]*0.01, c.anchor[1] + finalNorm[1]*0.01, c.anchor[2] + finalNorm[2]*0.01];
                c.displayPos = rotatePoint(dPos, rx, ry, rz);
                c.currC = getHSL(Math.min(100, c.conf + (hts.length * 2)));
            }});

            document.querySelectorAll('.hotspot:not(.cam-hotspot), .hit-hotspot').forEach(o=>o.remove());
            clusters.forEach(c => {{
                const btn = document.createElement('button'); btn.className = 'hotspot'; 
                if (c.class !== 'bolt') {{
                    btn.classList.add('alt-class');
                    btn.style.setProperty('--hex-color', c.currC);
                }} else {{
                    btn.style.backgroundColor = c.currC;
                }}
                btn.setAttribute('slot', 'hotspot-'+c.id);
                btn.setAttribute('data-position', c.displayPos[0] + " " + c.displayPos[1] + " " + c.displayPos[2]);
                btn.onclick = () => showBolt(c.id);
                const ann = document.createElement('div'); ann.className = 'annotation'; ann.innerText = c.members.length; ann.style.display = showAnn ? 'block' : 'none';
                btn.appendChild(ann); mv.appendChild(btn);
            }});
        }};

        window.toggleCams = () => {{
            const show = document.getElementById('show-cams').checked;
            const rx = parseFloat(document.getElementById('rot-x').value), ry = parseFloat(document.getElementById('rot-y').value), rz = parseFloat(document.getElementById('rot-z').value);
            document.querySelectorAll('.cam-hotspot').forEach(e => e.remove());
            if(show) {{
                for (let idx in camPositions) {{
                    const p = camPositions[idx];
                    const rp = rotatePoint(p, rx, ry, rz);
                    const dot = document.createElement('div'); dot.className = 'cam-hotspot'; dot.setAttribute('slot', 'hotspot-cam-' + idx);
                    dot.setAttribute('data-position', rp.join(' ')); mv.appendChild(dot);
                }}
            }}
        }};

                window.showBolt = (id) => {{
                    const c = clusters[id]; const hts = c.members;
                    const rx = parseFloat(document.getElementById('rot-x').value), ry = parseFloat(document.getElementById('rot-y').value), rz = parseFloat(document.getElementById('rot-z').value);
                    const showRays = document.getElementById('show-cams').checked;
                    const inspector = document.getElementById('hit-inspector');
                    
                    document.querySelectorAll('.hit-hotspot, .ray-dot').forEach(e => e.remove());
                    const g = document.getElementById('gallery'); g.innerHTML=''; 
                    
                    const updateInspector = (m) => {{
                        inspector.innerHTML = `<b>Hit Inspector</b>
                            <div class="stat-row"><span>Image</span> <b>${{m.img}}</b></div>
                            <div class="stat-row"><span>Confidence</span> <b>${{(m.conf*100).toFixed(1)}}%</b></div>
                            <div class="stat-row"><span>Cam Distance</span> <b>${{m.cam_dist.toFixed(2)}}m</b></div>
                            <div class="stat-row"><span>Angle Cosine</span> <b>${{m.normal_dot.toFixed(3)}}</b></div>
                            <div class="stat-row"><span>Edge Distance</span> <b>${{m.edge_dist.toFixed(3)}}</b></div>
                            <div class="stat-row"><span>Pixel (UV)</span> <b>${{m.uv[0].toFixed(0)}}, ${{m.uv[1].toFixed(0)}}</b></div>`;
                        inspector.style.opacity = 1;
                    }};
        
                    hts.forEach((m, i) => {{
                        // Create 3D Hit Marker
                        const rp = rotatePoint([m.pos[0] + m.norm[0]*0.02, m.pos[1] + m.norm[1]*0.02, m.pos[2] + m.norm[2]*0.02], rx, ry, rz);
                        const dot = document.createElement('div'); 
                        dot.className = 'hit-hotspot'; 
                        dot.id = `marker-${{i}}`;
                        dot.setAttribute('slot', 'hotspot-hit-' + id + '-' + i);
                        dot.setAttribute('data-position', rp.join(' ')); 
                        
                        // 3D -> Gallery & Inspector
                        dot.onmouseenter = () => {{
                            document.getElementById(`gallery-item-${{i}}`)?.classList.add('highlight');
                            document.getElementById(`gallery-item-${{i}}`)?.scrollIntoView({{behavior: 'smooth', block: 'nearest'}});
                            updateInspector(m);
                        }};
                        dot.onmouseleave = () => {{
                            document.getElementById(`gallery-item-${{i}}`)?.classList.remove('highlight');
                            inspector.style.opacity = 0;
                        }};
                        mv.appendChild(dot);
                        
                        // Draw Rays (Simple, no glow)
                        if(showRays) {{
                            for(let step=1; step<=25; step++) {{
                                const t = step / 26.0;
                                const rayP = [m.pos[0]*(1-t) + m.cam_pos[0]*t, m.pos[1]*(1-t) + m.cam_pos[1]*t, m.pos[2]*(1-t) + m.cam_pos[2]*t];
                                const rRayP = rotatePoint(rayP, rx, ry, rz);
                                const rd = document.createElement('div'); rd.className = 'ray-dot'; rd.setAttribute('slot', 'hotspot-ray-' + id + '-' + i + '-' + step);
                                rd.setAttribute('data-position', rRayP.join(' ')); 
                                rd.style.cssText = 'width:3px; height:3px; background:rgba(0,255,255,0.6); border-radius:50%; pointer-events:none;';
                                mv.appendChild(rd);
                            }}
                        }}
                        
                        // Add to Gallery
                        if(m.crop) {{ 
                            const div = document.createElement('div'); 
                            div.className = 'gallery-item';
                            div.id = `gallery-item-${{i}}`;
                            
                            // Gallery -> 3D & Inspector
                            div.onmouseenter = () => {{
                                document.getElementById(`marker-${{i}}`)?.classList.add('highlight');
                                updateInspector(m);
                            }};
                            div.onmouseleave = () => {{
                                document.getElementById(`marker-${{i}}`)?.classList.remove('highlight');
                                inspector.style.opacity = 0;
                            }};
                            
                            const img = document.createElement('img'); 
                            img.src = m.crop; 
                            img.onclick = () => {{ document.getElementById('lightbox-img').src=m.crop; document.getElementById('lightbox').style.display='flex'; }};
                            const label = document.createElement('div'); 
                            label.innerText = m.img;
                            label.style.cssText = 'position:absolute; bottom:2px; left:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; font-size:8px; padding:2px; border-radius:2px; pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
                            
                            div.appendChild(img); 
                            div.appendChild(label);
                            g.appendChild(div); 
                        }}
                    }});
        
            document.getElementById('title').innerText=c.class.toUpperCase() + ' #' + id; 
            document.getElementById('title').style.color = c.currC;
            document.getElementById('meta-info').innerHTML = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                <div><span style="color:#666;font-size:10px;text-transform:uppercase;">Class</span><br><b>${{c.class}}</b></div>
                <div><span style="color:#666;font-size:10px;text-transform:uppercase;">Frames</span><br><b>${{hts.length}}</b></div>
                <div><span style="color:#666;font-size:10px;text-transform:uppercase;">Avg Conf</span><br><b>${{c.conf.toFixed(1)}}%</b></div>
                <div><span style="color:#666;font-size:10px;text-transform:uppercase;">View Spread</span><br><b>${{c.spread_val.toFixed(2)}}m</b></div>
            </div>`;
        }};
        initSliders();
        recluster();
        </script></body></html>"""
    with open(args.html, "w", encoding="utf-8") as f: f.write(html_template)
    print(f"[*] Dashboard generated: {args.html}")

if __name__ == "__main__": run_pipeline()
