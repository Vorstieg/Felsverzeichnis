<script>
	import { T, useTask, useThrelte } from '@threlte/core';
	import { interactivity, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras';
	import { ArrowHelper, Raycaster, Vector3, Plane } from 'three'; // Added Plane
	import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import CssObject from '../CssObject.svelte';
	import Cutter from './Cutter.svelte';
	import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
	import { userState } from '$lib/state/editor.svelte.js';

	// Initialize interactivity system
	interactivity({ filter: (hits) => hits.slice(0, 1) });

	// --- Props ---
	let { gltfScene = null, element, isCutting = false, activeTool, ...props } = $props(); // Receive isCutting and activeTool
	
	// --- Export Functionality Binding ---
	export const downloadClippedModel = (filename = 'clipped_model.glb') => {
		if (!gltfScene) return;
		
		const exporter = new GLTFExporter();
		const sceneClone = gltfScene.clone();
		
		// Apply scale from userState
		const scale = userState.topo.scale || 1;
		sceneClone.scale.set(scale, scale, scale);
		
		// Apply position offset (baking centering)
		const offset = userState.topo.modelOffset || [0, 0, 0];
		sceneClone.position.set(offset[0], offset[1], offset[2]);

		sceneClone.updateMatrixWorld(true);
		
		if (isCutting && clippingPlanes.length > 0) {
			// Prune geometry
			sceneClone.traverse((child) => {
				if (child.isMesh && child.geometry) {
					const geo = child.geometry;
					if (!geo.attributes.position) return;
					
					const posAttr = geo.attributes.position;
					const indexAttr = geo.index;
					const newIndices = [];
					
					const vA = new Vector3();
					const vB = new Vector3();
					const vC = new Vector3();
					
					child.updateMatrixWorld(true);
					const worldMatrix = child.matrixWorld;
					
					const count = indexAttr ? indexAttr.count : posAttr.count;
					
					for (let i = 0; i < count; i += 3) {
						let a, b, c;
						if (indexAttr) {
							a = indexAttr.getX(i);
							b = indexAttr.getX(i+1);
							c = indexAttr.getX(i+2);
						} else {
							a = i; b = i+1; c = i+2;
						}
						
						vA.fromBufferAttribute(posAttr, a).applyMatrix4(worldMatrix);
						vB.fromBufferAttribute(posAttr, b).applyMatrix4(worldMatrix);
						vC.fromBufferAttribute(posAttr, c).applyMatrix4(worldMatrix);
						
						// Check face against ALL planes.
						// To survive, a face must be visible in the "Intersection" of all half-spaces.
						// Strict logic: A face is kept if it is at least partially inside the valid volume.
						// For each plane, if the face is completely *outside* (all verts < 0), it is culled by that plane.
						// If a face survives Plane A, we check Plane B.
						
						let keepFace = true;
						
						for (const plane of clippingPlanes) {
							const distA = vA.dot(plane.normal) + plane.constant;
							const distB = vB.dot(plane.normal) + plane.constant;
							const distC = vC.dot(plane.normal) + plane.constant;
							
							// If all vertices are behind this plane, the face is clipped by this plane.
							if (distA < 0 && distB < 0 && distC < 0) {
								keepFace = false;
								break; // No need to check other planes, it's gone.
							}
						}
						
						if (keepFace) {
							newIndices.push(a, b, c);
						}
					}
					
					if (indexAttr) {
						geo.setIndex(newIndices);
					} else {
						console.warn("Non-indexed geometry pruning not fully optimized.");
					}
				}
			});
		}
		
		exporter.parse(
			sceneClone,
			(glb) => {
				const blob = new Blob([glb], { type: 'application/octet-stream' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				a.click();
				URL.revokeObjectURL(url);
			},
			(err) => console.error(err),
			{ binary: true }
		);
	};
	
	export const addPlane = () => {
		clippingPlanes = [...clippingPlanes, new Plane(new Vector3(0, 1, 0), 0)];
		activePlaneIndex = clippingPlanes.length - 1;
	};
	
	export const removeLastPlane = () => {
		if (clippingPlanes.length > 0) {
			clippingPlanes = clippingPlanes.slice(0, -1);
			activePlaneIndex = clippingPlanes.length - 1;
		}
	};
	
	export const clearPlanes = () => {
		clippingPlanes = [];
		activePlaneIndex = -1;
	};

	const { renderer } = useThrelte();
	$effect(() => {
		renderer.localClippingEnabled = true;
	});

	let clippingPlanes = $state([]);
	let activePlaneIndex = $state(-1);

	$effect(() => {
		if (isCutting && clippingPlanes.length === 0) {
			addPlane();
		}
	});

	$effect(() => {
		if (gltfScene) {
			gltfScene.traverse((child) => {
				if (child.isMesh) {
					if (isCutting) {
						child.material.clippingPlanes = clippingPlanes;
						child.material.clipShadows = true;
					} else {
						child.material.clippingPlanes = [];
					}
					child.material.needsUpdate = true;
				}
			});
		}
	});

	// ... existing code ...
	$effect(() => {
		cssRenderer.setSize($size.width, $size.height)
	})

	// --- State for Line Drawing ---
	let currentClickData = $state([]);
	let currentLineSegments = $state([]);
	
	// Derived state for rendering saved routes (handles both newly created and imported)
	let visualRoutes = $derived(userState.topo.routes.map(route => {
		// Check if we have a position offset prop (array [x,y,z])
		const offset = props.position ? new Vector3(...props.position) : new Vector3(0, 0, 0);
		
		// Parse orientation normal if available
		let normal = null;
		let displacement = new Vector3(0, 0, 0);
		
		if (route.orientation) {
			normal = new Vector3(route.orientation[0], route.orientation[1], route.orientation[2]);
			// Displace slightly along normal to prevent z-fighting with the wall
			displacement = normal.clone().multiplyScalar(0.01); // Reduced from 0.02
		}
		
		// Convert points to Vector3 and apply offsets
		const points = route.points.map(p => new Vector3(p[0], p[1], p[2]).add(offset).add(displacement));
		
		return {
			id: route.id,
			points: points,
			normal: normal
		};
	}));

	let visualFixPoints = $derived(userState.topo.fixPoints.map(pt => {
		const offset = props.position ? new Vector3(...props.position) : new Vector3(0, 0, 0);
		const pos = new Vector3(pt.position[0], pt.position[1], pt.position[2]).add(offset);
		return {
			...pt,
			renderPosition: pos.toArray()
		};
	}));

	const { autoRenderTask, camera, scene, size } = useThrelte()
	// note that the renderer won't be reactive if `element` updates
	// you'd have to do `$derived(new CSS2DRenderer({element}))` if you'd want that to be the case
	const cssRenderer = new CSS2DRenderer({ element })
	$effect(() => {
		cssRenderer.setSize($size.width, $size.height)
	})
	// We are running two renderers, and don't want to run
	// updateMatrixWorld twice; tell the renderers that we'll handle
	// it manually.
	// https://threejs.org/docs/#api/en/core/Object3D.updateWorldMatrix
	const last = scene.matrixWorldAutoUpdate
	scene.matrixWorldAutoUpdate = false
	$effect(() => {
		return () => {
			scene.matrixWorldAutoUpdate = last
		}
	})
	// To update the matrices *once* per frame, we'll use a task that is added
	// right before the autoRenderTask. This way, we can be sure that the
	// matrices are updated before the renderers run.
	useTask(
		() => {
			scene.updateMatrixWorld()
		},
		{ before: autoRenderTask }
	)
	// The CSS2DRenderer needs to be updated after the autoRenderTask, so we
	// add a task that runs after it.
	useTask(
		() => {
			cssRenderer.render(scene, camera.current)
		},
		{
			after: autoRenderTask,
			autoInvalidate: false
		}
	)




	const projectionRaycaster = new Raycaster();
	const SUBDIVISIONS = 20;
	const OFFSET_DISTANCE = 0.01;

	// --- Interaction Functions ---
	function handleMeshDblClick(event) {
		// Ensure the click happened on a mesh within the passed gltfScene
		let isMeshInLoadedScene = false;
		if (gltfScene && event.object?.isMesh) {
			event.object.traverseAncestors((ancestor) => {
				if (ancestor === gltfScene) {
					isMeshInLoadedScene = true;
				}
			});
		}

		// Ensure we have valid intersection data on the correct scene
		if (!isMeshInLoadedScene || !event.point || !event.face?.normal) {
			// console.log('Ignoring click (not on loaded model or invalid data)');
			return;
		}

		if (activeTool === 'point') {
			const modelOffset = new Vector3(...(props.position || [0, 0, 0]));
			const point = event.point.clone().sub(modelOffset);
			
			userState.topo.fixPoints.push({
				id: crypto.randomUUID(),
				position: point.toArray(),
				type: 'bolt'
			});
			return;
		}

		if (activeTool !== 'route') return;

		const currentClick = {
			point: event.point.clone(),
			normal: event.face.normal.clone(), // Clone to be safe
			mesh: event.object // Reference to the specific mesh clicked
		};

		// Add the click data
		currentClickData = [...currentClickData, currentClick];

		// If we have at least two points, generate a segment
		if (currentClickData.length >= 2) {
			const previousClick = currentClickData[currentClickData.length - 2];
			const segmentPointData = generateProjectedSegment(previousClick, currentClick, currentClick.mesh, camera.current);

			if (segmentPointData && segmentPointData.length > 1) {
				const offsetPoints = segmentPointData.map(pd =>
					new Vector3().copy(pd.point).addScaledVector(pd.normal, OFFSET_DISTANCE)
				);
				currentLineSegments = [
					...currentLineSegments,
					{
						id: currentLineSegments.length,
						points: offsetPoints,
						pointsData: segmentPointData
					}
				];
			} else {
				console.warn('Segment generation failed or yielded insufficient points.');
			}
		}
	}

	function handleKeyDown(event) {
		if (activeTool !== 'route') return;

		// Finalize line on 'N'
		if (event.key === 'n' || event.key === 'N') {
			if (currentLineSegments.length > 0 && currentClickData.length > 0) {
				let allPointsWithNormals = [];
				currentLineSegments.forEach(segment => {
					if (segment.pointsData?.length > 0) {
						allPointsWithNormals = [...allPointsWithNormals, ...segment.pointsData];
					}
				});
				if (allPointsWithNormals.length === 0 && currentClickData.length > 0) { // Fallback if segments somehow failed
					allPointsWithNormals = currentClickData.map(click => ({ point: click.point, normal: click.normal }));
				}

				if (allPointsWithNormals.length > 0) {
					const pointsWithNormals = allPointsWithNormals.map((pd) => {
						const point = pd.point.clone();
						const normal = pd.normal ? pd.normal.clone() : new Vector3(0, 1, 0); // Use default if normal missing
						if (normal.lengthSq() > 0.0001) normal.normalize();
						return { point, normal };
					});

					const averageNormal = new Vector3(); let validNormals = 0;
					pointsWithNormals.forEach(pointData => {
						if (pointData.normal.lengthSq() > 0.0001) { averageNormal.add(pointData.normal); validNormals++; }
					});
					if (validNormals > 0) averageNormal.divideScalar(validNormals).normalize();
					
					const modelOffset = new Vector3(...(props.position || [0, 0, 0]));

					userState.topo.routes.push(						{
						id: String(userState.topo.routes.length + 1),
						points: pointsWithNormals.map(p => p.point.clone().sub(modelOffset).toArray().map(c => Number(c.toFixed(2)))),
						orientation: [averageNormal.x, averageNormal.y, averageNormal.z],
						tags: []
					})
				} else {
					console.warn("Finalize attempt failed: No valid points found.");
				}
				currentClickData = [];
				currentLineSegments = [];
			} else {
				console.log("Nothing to finalize.");
			}
		}
		// Cancel line on 'Escape'
		else if (event.key === 'Escape') {
			if (currentClickData.length > 0 || currentLineSegments.length > 0) {
				currentClickData = [];
				currentLineSegments = [];
				console.log('Current line cancelled.');
			}
		}
	}

	// Generate points along the surface between two clicks
	function generateProjectedSegment(startData, endData, mesh, cam) {
		if (!cam || !mesh || !startData?.point || !endData?.point) {
			console.error("generateProjectedSegment missing required data", { cam, mesh, startData, endData });
			return [];
		}

		const startPoint = startData.point.clone();
		const endPoint = endData.point.clone();
		// Ensure normals are valid or provide fallbacks
		const startNormal = (startData.normal && startData.normal.lengthSq() > 0.0001) ? startData.normal.clone().normalize() : new Vector3(0, 1, 0);
		const endNormal = (endData.normal && endData.normal.lengthSq() > 0.0001) ? endData.normal.clone().normalize() : new Vector3(0, 1, 0);

		const pointsData = [{ point: startPoint, normal: startNormal }];
		const tempVec = new Vector3();
		const tempDir = new Vector3();
		const startToEnd = new Vector3().subVectors(endPoint, startPoint);
		const segmentLength = startToEnd.length();

		// If segment is very short, just return start and end points
		if (segmentLength < 0.001) {
			pointsData.push({ point: endPoint, normal: endNormal });
			return pointsData;
		}

		const camPos = cam.position.clone();

		for (let i = 1; i < SUBDIVISIONS; i++) {
			const t = i / SUBDIVISIONS;
			// Interpolate point linearly in 3D space first
			const intermediatePoint = tempVec.copy(startPoint).addScaledVector(startToEnd, t);

			// Raycast from camera towards the interpolated point to find the surface point
			const rayDirection = tempDir.subVectors(intermediatePoint, camPos).normalize();
			projectionRaycaster.set(camPos, rayDirection);
			projectionRaycaster.near = cam.near;
			projectionRaycaster.far = cam.far;

			let hitPoint = null;
			let hitNormal = null;

			try {
				// Intersect with the specific mesh the points were clicked on
				// Pass `true` for recursive if gltfScene contains nested meshes
				const intersects = projectionRaycaster.intersectObject(mesh, false); // Set to true if mesh is a group

				// Find the closest intersection on the target mesh
				let closestIntersect = null;
				for(const intersect of intersects) {
					if(intersect.object === mesh) { // Ensure it hit the mesh we care about
						closestIntersect = intersect;
						break;
					}
				}


				if (closestIntersect && closestIntersect.face && closestIntersect.point) {
					hitPoint = closestIntersect.point.clone();
					// Get the normal in world space directly from the intersection data if possible
					// The face normal is typically in local space, needs transformation
					hitNormal = closestIntersect.face.normal.clone();
					// Transform normal to world space requires the object's world matrix normal part
					const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
					hitNormal.applyMatrix3(normalMatrix).normalize();

				}
			} catch (error) {
				console.error('Raycasting failed during segment generation:', error);
			}

			// If raycast missed or failed, use the linearly interpolated point and normal
			if (!hitPoint || !hitNormal) {
				hitPoint = intermediatePoint.clone();
				hitNormal = new Vector3().lerpVectors(startNormal, endNormal, t).normalize();
			}

			pointsData.push({ point: hitPoint, normal: hitNormal });
		}

		pointsData.push({ point: endPoint, normal: endNormal }); // Add the last point
		return pointsData;
	}


	// Add/Remove keyboard listener
	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		console.log('Model component mounted, keydown listener added.');
		// Cleanup function
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			console.log('Model component unmounted, keydown listener removed.');
		};
	});

</script>

{#if gltfScene}
	<T is={gltfScene}
		 ondblclick={handleMeshDblClick}
		 dispose={null}
	{...props}
	/>
{/if}

{#each clippingPlanes as plane, i}
	{#if i === activePlaneIndex}
		<Cutter {plane} active={isCutting} />
	{/if}
{/each}

{#each currentLineSegments as segment (segment.id)}
	<T.Mesh>
		<MeshLineGeometry points={segment.points} />
		<MeshLineMaterial
			color={"#ff00ff"}
			width={0.15}
			resolution={$size.width && $size.height ? [$size.width, $size.height] : [1, 1]}
		/>
	</T.Mesh>
{/each}

{#each visualFixPoints as point (point.id)}
	<T.Mesh position={point.renderPosition}>
		<T.SphereGeometry args={[0.2]} />
		<T.MeshBasicMaterial color={point.type === 'anchor' ? 'orange' : 'red'} />
	</T.Mesh>
{/each}

{#each visualRoutes as route (route.id)}
	<CssObject position={route.points[0]}>
		{#snippet content()}
			<div class={"route-label"}>
				{route.id}
			</div>
		{/snippet}
		<div class={"route-label"}>
			{route.id}
		</div>
	</CssObject>
	
	<T.Mesh>
		<MeshLineGeometry points={route.points} />
		<MeshLineMaterial
			color={"#12538b"}
			width={0.15}
			resolution={$size.width && $size.height ? [$size.width, $size.height] : [1, 1]}
		/>
	</T.Mesh>

	{#if route.normal && route.normal.lengthSq() > 0.0001}
		<T is={ArrowHelper}
			 args={[
     route.normal.normalize(),
     route.points[0],
     0.4,       /* length */
     0xff0000,  /* color */
     0.08,      /* headLength */
     0.05       /* headWidth */
    ]}
		/>
	{/if}
{/each}