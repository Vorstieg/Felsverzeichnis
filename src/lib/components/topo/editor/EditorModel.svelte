<script>
	import { T, useTask, useThrelte } from '@threlte/core';
	import { interactivity, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras';
	import { ArrowHelper, Raycaster, Vector3, Plane, CatmullRomCurve3, TubeGeometry } from 'three'; 
	import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
	import CssObject from '../CssObject.svelte';
	import Cutter from './Cutter.svelte';
	import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
	import { userState } from '$lib/state/editor.svelte.js';

	// Apply BVH extension to THREE
	if (!THREE.BufferGeometry.prototype.computeBoundsTree) {
		THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
		THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
		THREE.Mesh.prototype.raycast = acceleratedRaycast;
	}

	// Initialize interactivity system
	interactivity({ filter: (hits) => hits.slice(0, 1) });

	// --- Props ---
	let { 
		gltfScene = null, 
		element, 
		isCutting = false, 
		activeTool, 
		drawingTarget = null,
		...props 
	} = $props(); 
	
	// --- Export Functionality Binding ---
	export const downloadClippedModel = (filename = 'clipped_model.glb') => {
		if (!gltfScene) return;
		
		const exporter = new GLTFExporter();
		const sceneClone = gltfScene.clone();
		
		const scale = userState.topo.scale || 1;
		sceneClone.scale.set(scale, scale, scale);
		
		const offset = userState.topo.modelOffset || [0, 0, 0];
		sceneClone.position.set(offset[0], offset[1], offset[2]);

		sceneClone.updateMatrixWorld(true);
		
		if (isCutting && clippingPlanes.length > 0) {
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
						
						let keepFace = true;
						for (const plane of clippingPlanes) {
							const distA = vA.dot(plane.normal) + plane.constant;
							const distB = vB.dot(plane.normal) + plane.constant;
							const distC = vC.dot(plane.normal) + plane.constant;
							if (distA < 0 && distB < 0 && distC < 0) {
								keepFace = false;
								break;
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

	const { renderer, autoRenderTask, camera, scene, size } = useThrelte();
	
	$effect(() => {
		if (renderer) renderer.localClippingEnabled = true;
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
					if (child.geometry && !child.geometry.boundsTree) {
						child.geometry.computeBoundsTree();
					}

					// Standardize material properties
					if (child.material) {
						const materials = Array.isArray(child.material) ? child.material : [child.material];
						materials.forEach(material => {
							if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
								material.metalness = 0;
								material.roughness = Math.max(material.roughness, 0.8);
								material.emissive.setHex(0x252525);
								material.needsUpdate = true;
							}
						});
					}

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

	// --- State for Line Drawing ---
	let currentClickData = $state([]);
	let currentLineSegments = $state([]);
	let firstPointVisual = $state(null); 
	let previewLineSegment = $state(null); 
	let lastPreviewUpdate = 0; 
	
	let localDrawingState = $state(null);
	let lastSnappedRouteId = $state(null);
	let lastSnappedVertexIndex = $state(-1);
	let hoverSnappedRouteId = $state(null);
	let updateTick = $state(0); 
	
	// Derived state for rendering saved routes
	let visualRoutes = $derived.by(() => {
		const _ = updateTick;
		
		return userState.topo.routes.flatMap(route => {
			const offset = props.position ? new Vector3(...props.position) : new Vector3(0, 0, 0);
			
			const processPoints = (points, subId, label) => {
				let normal = null;
				let displacement = new Vector3(0, 0, 0);
				if (route.orientation) {
					normal = new Vector3(route.orientation[0], route.orientation[1], route.orientation[2]);
					displacement = normal.clone().multiplyScalar(0.05);
				}
				
				const vecPoints = (points || []).map(p => new Vector3(p[0], p[1], p[2]).add(offset).add(displacement));
				
				const curve = vecPoints.length >= 2 ? new CatmullRomCurve3(vecPoints, false, 'catmullrom', 0) : null;

				return {
					id: subId,
					points: vecPoints,
					curve: curve,
					normal: normal,
					label: label || route.id,
					parentId: route.id
				};
			};

			if (route.type === 'multi-pitch' && route.pitches) {
				return route.pitches.map((pitch, idx) => {
					const pId = pitch.id || `${route.id}_p${idx}`;
					return processPoints(pitch.points || [], pId, `${route.id}.${idx + 1}`);
				});
			} else {
				return [processPoints(route.points, route.id)];
			}
		});
	});

	// Only certain symbol types can be 3D fixpoints
	const FIXPOINT_TYPES = ['bolt', 'belay', 'abseil', 'piton', 'tree'];
	let visualFixPoints = $derived(userState.topo.fixPoints
		.filter(pt => pt.position && FIXPOINT_TYPES.includes(pt.type))
		.map(pt => {
			const offset = props.position ? new Vector3(...props.position) : new Vector3(0, 0, 0);
			const pos = new Vector3(pt.position[0], pt.position[1], pt.position[2]).add(offset);
			let isAssigned = false;
			if (userState.topo.selectedRouteId) {
				const route = userState.topo.routes.find(r => r.id === userState.topo.selectedRouteId);
				if (route && route.fixPoints && route.fixPoints.includes(pt.id)) {
					isAssigned = true;
				}
			}
			
			return {
				...pt,
				renderPosition: pos.toArray(),
				isAssigned
			};
		})
	);

	const cssRenderer = new CSS2DRenderer({ element })
	$effect(() => {
		cssRenderer.setSize($size.width, $size.height)
	})

	useTask(() => {
		scene.updateMatrixWorld()
	}, { before: autoRenderTask })

	useTask(() => {
		cssRenderer.render(scene, camera.current)
	}, { after: autoRenderTask, autoInvalidate: false })

	const projectionRaycaster = new Raycaster();
	const STEP_SIZE = 0.2; 
	const OFFSET_DISTANCE = 0.05;
	const SNAP_THRESHOLD = 0.15;

	function getSnappedVertex(point) {
		let finalPoint = point.clone();
		let bestDist = SNAP_THRESHOLD;
		let found = null; // { point, routeId, index }

		visualFixPoints.forEach(fp => {
			const fpPos = new Vector3(...fp.renderPosition);
			const dist = point.distanceTo(fpPos);
			if (dist < bestDist) {
				bestDist = dist;
				finalPoint.copy(fpPos);
				found = { point: finalPoint.clone(), type: 'fixpoint' };
			}
		});

		visualRoutes.forEach(vr => {
			vr.points.forEach((p, idx) => {
				const dist = point.distanceTo(p);
				if (dist < bestDist) {
					bestDist = dist;
					finalPoint.copy(p);
					found = { point: finalPoint.clone(), routeId: vr.parentId, index: idx };
				}
			});
		});

		return found || { point: point.clone() };
	}

	function handleMeshPointerMove(event) {
		if ((activeTool !== 'route' && activeTool !== 'multipitch') || currentClickData.length === 0) {
			if (previewLineSegment) previewLineSegment = null;
			hoverSnappedRouteId = null;
			return;
		}
		const now = Date.now();
		if (now - lastPreviewUpdate < 30) return; // Increased frequency slightly
		lastPreviewUpdate = now;
		if (!event.point) return;

		// Snap the preview point for visual feedback
		const snapResult = getSnappedVertex(event.point);
		hoverSnappedRouteId = snapResult.routeId || null;
		
		const startClick = currentClickData[currentClickData.length - 1];
		previewLineSegment = { points: [startClick.point.clone(), snapResult.point] };
	}

	function handleMeshClick(event) {
		if (currentClickData.length === 0) {
			userState.ui.selectedRouteId = null;
			userState.ui.selectedFixpointId = null;
		}
	}

	function handleMeshDblClick(event) {
		let isMeshInLoadedScene = false;
		if (gltfScene && event.object?.isMesh) {
			event.object.traverseAncestors((ancestor) => { if (ancestor === gltfScene) isMeshInLoadedScene = true; });
		}
		
		if (!isMeshInLoadedScene || !event.point || !event.face?.normal) return;

		if (activeTool === 'point') {
			const modelOffset = new Vector3(...(props.position || [0, 0, 0]));
			userState.topo.fixPoints.push({ id: crypto.randomUUID(), position: event.point.clone().sub(modelOffset).toArray(), type: 'bolt' });
			return;
		}

		if (activeTool !== 'route' && activeTool !== 'multipitch') return;

		// Snapping to vertices only when clicking mesh
		const snapResult = getSnappedVertex(event.point);
		if (snapResult.routeId) {
			lastSnappedRouteId = snapResult.routeId;
			lastSnappedVertexIndex = snapResult.index;
		} else {
			lastSnappedRouteId = null;
			lastSnappedVertexIndex = -1;
		}

		const normalMatrix = new THREE.Matrix3().getNormalMatrix(event.object.matrixWorld);
		const worldNormal = event.face.normal.clone().applyMatrix3(normalMatrix).normalize();
		const currentClick = { point: snapResult.point, normal: worldNormal, mesh: event.object };
		currentClickData = [...currentClickData, currentClick];

		if (currentClickData.length === 1) {
			firstPointVisual = currentClick.point.clone().addScaledVector(currentClick.normal, 0.05).toArray();
		}

		if (currentClickData.length >= 2) {
			const previousClick = currentClickData[currentClickData.length - 2];
			const segmentPointData = generateProjectedSegment(previousClick, currentClick, gltfScene, camera.current);
			if (segmentPointData && segmentPointData.length > 1) {
				const offsetPoints = segmentPointData.map(pd => new Vector3().copy(pd.point).addScaledVector(pd.normal, OFFSET_DISTANCE));
				currentLineSegments = [...currentLineSegments, { id: currentLineSegments.length, points: offsetPoints, pointsData: segmentPointData }];
				previewLineSegment = null;
			}
		}
	}

	function handleRouteDblClick(e, parentId) {
		if (activeTool !== 'route' && activeTool !== 'multipitch') return;
		e.stopPropagation();

		const route = visualRoutes.find(vr => vr.parentId === parentId);
		if (!route || route.points.length === 0) return;

		let closestIdx = 0;
		let minDist = Infinity;
		route.points.forEach((p, idx) => {
			const d = p.distanceToSquared(e.point);
			if (d < minDist) {
				minDist = d;
				closestIdx = idx;
			}
		});

		const snappedPoint = route.points[closestIdx];
		const normal = route.normal || new Vector3(0, 1, 0);

		if (currentClickData.length > 0 && lastSnappedRouteId === parentId && lastSnappedVertexIndex !== -1) {
			const start = lastSnappedVertexIndex;
			const end = closestIdx;
			if (start !== end) {
				const step = (start < end) ? 1 : -1;
				let tracePoints = [];
				let traceData = [];
				for (let k = start + step; ; k += step) {
					const p = route.points[k];
					tracePoints.push(p.clone());
					traceData.push({ point: p.clone(), normal: normal.clone() });
					if (k === end) break;
				}

				currentLineSegments = [...currentLineSegments, { id: currentLineSegments.length, points: tracePoints, pointsData: traceData }];
				const last = traceData[traceData.length - 1];
				currentClickData = [...currentClickData, { point: last.point, normal: last.normal, mesh: null }];
			}
		} else {
			const currentClick = { point: snappedPoint, normal: normal, mesh: null };
			currentClickData = [...currentClickData, currentClick];
			if (currentClickData.length === 1) {
				firstPointVisual = currentClick.point.clone().addScaledVector(currentClick.normal, 0.05).toArray();
			}
			if (currentClickData.length >= 2) {
				const previousClick = currentClickData[currentClickData.length - 2];
				const segmentPointData = generateProjectedSegment(previousClick, currentClick, gltfScene, camera.current);
				if (segmentPointData && segmentPointData.length > 1) {
					currentLineSegments = [...currentLineSegments, { id: currentLineSegments.length, points: segmentPointData.map(pd => pd.point), pointsData: segmentPointData }];
				}
			}
		}

		lastSnappedRouteId = parentId;
		lastSnappedVertexIndex = closestIdx;
		previewLineSegment = null;
		updateTick += 1;
	}
	
	function handleFixPointClick(e, pointId) {
		e.stopPropagation();
		if (userState.ui.selectedRouteId) {
			const route = userState.topo.routes.find(r => r.id === userState.ui.selectedRouteId);
			if (route) {
				if (!route.fixPoints) route.fixPoints = [];
				if (route.fixPoints.includes(pointId)) {
					route.fixPoints = route.fixPoints.filter(id => id !== pointId);
				} else {
					route.fixPoints.push(pointId);
				}
			}
		} else {
			userState.ui.selectedFixpointId = (userState.ui.selectedFixpointId === pointId) ? null : pointId;
		}
	}

	function handleFixPointDblClick(e, pointId) {
		e.stopPropagation();
		
		if ((activeTool === 'multipitch' || activeTool === 'route') && currentClickData.length > 0) {
			const startPoint = userState.topo.fixPoints.find(p => p.id === pointId);
			if (!startPoint) return;

			const modelOffset = new Vector3(...(props.position || [0, 0, 0]));
			const snapPoint = new Vector3(...startPoint.position).add(modelOffset);
			const lastClick = currentClickData[currentClickData.length - 1];
			const snapClick = { point: snapPoint, normal: new Vector3(0, 1, 0), mesh: null };
			const segmentPoints = generateProjectedSegment(lastClick, snapClick, gltfScene, camera.current);
			
			let allPointsWithNormals = [];
			currentLineSegments.forEach(segment => {
				if (segment.pointsData?.length > 0) allPointsWithNormals.push(...segment.pointsData);
			});
			if (segmentPoints && segmentPoints.length > 0) {
				allPointsWithNormals.push(...segmentPoints);
			} else {
				allPointsWithNormals.push({ point: snapPoint, normal: new Vector3(0, 1, 0) });
			}

			const finalPoints = allPointsWithNormals.map(p => p.point.clone().sub(modelOffset).toArray().map(c => Number(c.toFixed(2))));

			if (activeTool === 'multipitch') {
				let route = userState.topo.routes.find(r => r.id === (localDrawingState?.routeId || userState.ui.selectedRouteId));
				if (route) {
					let pitch = localDrawingState ? route.pitches.find(p => p.id === localDrawingState.pitchId) : null;
					if (!pitch && route.pitches.length > 0) pitch = route.pitches[route.pitches.length - 1];
					if (pitch) {
						pitch.points = finalPoints;
						pitch.endNodeId = pointId;
					}
				}
				localDrawingState = null;
			} else if (activeTool === 'route') {
				const averageNormal = new Vector3();
				allPointsWithNormals.forEach(pd => averageNormal.add(pd.normal));
				averageNormal.normalize();
				const newRoute = {
					id: crypto.randomUUID(),
					name: 'New Route',
					points: finalPoints,
					orientation: [averageNormal.x, averageNormal.y, averageNormal.z],
					tags: [],
					fixPoints: []
				};
				userState.topo.routes = [...userState.topo.routes, newRoute];
				userState.ui.selectedRouteId = newRoute.id;
			}

			currentClickData = [];
			currentLineSegments = [];
			firstPointVisual = null;
			previewLineSegment = null;
			lastSnappedRouteId = null;
			lastSnappedVertexIndex = -1;
			updateTick += 1;
			return;
		}

		if (activeTool === 'multipitch') {
			const route = userState.topo.routes.find(r => r.id === userState.ui.selectedRouteId);
			if (route && route.type === 'multi-pitch') {
				const startPoint = userState.topo.fixPoints.find(p => p.id === pointId);
				if (startPoint) {
					const startClick = {
						point: new Vector3(...startPoint.position).add(new Vector3(...(props.position || [0,0,0]))),
						normal: new Vector3(0, 1, 0),
						mesh: null
					};
					currentClickData = [startClick];
					currentLineSegments = [];
					firstPointVisual = startClick.point.toArray();
					previewLineSegment = null;
					const newPitch = { id: crypto.randomUUID(), startNodeId: pointId, points: [], type: 'climb' };
					route.pitches = [...(route.pitches || []), newPitch];
					localDrawingState = { routeId: route.id, pitchId: newPitch.id };
					updateTick += 1;
				}
			}
		}
	}

	function handleRouteClick(e, routeId) {
		if (currentClickData.length > 0) return;
		e.stopPropagation();
		userState.ui.selectedRouteId = (userState.ui.selectedRouteId === routeId) ? null : routeId;
		userState.ui.selectedFixpointId = null;
	}

	function handleKeyDown(event) {
		if (activeTool !== 'route' && activeTool !== 'multipitch') return;

		if (activeTool === 'multipitch' && (event.key === 'b' || event.key === 'B')) {
			if (currentClickData.length > 0) {
				let allPointsWithNormals = [];
				currentLineSegments.forEach(segment => {
					if (segment.pointsData?.length > 0) allPointsWithNormals.push(...segment.pointsData);
				});
				if (allPointsWithNormals.length === 0) return;

				const modelOffset = new Vector3(...(props.position || [0, 0, 0]));
				const finalPoints = allPointsWithNormals.map(p => p.point.clone().sub(modelOffset).toArray().map(c => Number(c.toFixed(2))));
				
				let route = userState.topo.routes.find(r => r.id === (localDrawingState?.routeId || userState.ui.selectedRouteId));
				if (!route) {
					route = { id: crypto.randomUUID(), type: 'multi-pitch', pitches: [], tags: [], fixPoints: [] };
					userState.topo.routes.push(route);
				}

				const anchorId = crypto.randomUUID();
				const lastPoint = allPointsWithNormals[allPointsWithNormals.length - 1];
				userState.topo.fixPoints.push({ id: anchorId, position: lastPoint.point.clone().sub(modelOffset).toArray(), type: 'belay' });

				const currentPitch = { id: crypto.randomUUID(), pitchNumber: route.pitches.length + 1, points: finalPoints, type: 'pitch', endNodeId: anchorId };
				route.pitches.push(currentPitch);

				const nextPitch = { id: crypto.randomUUID(), pitchNumber: route.pitches.length + 1, startNodeId: anchorId, points: [], type: 'climb' };
				route.pitches.push(nextPitch);

				currentClickData = [{ point: lastPoint.point.clone(), normal: lastPoint.normal.clone(), mesh: null }];
				currentLineSegments = [];
				firstPointVisual = lastPoint.point.toArray();
				previewLineSegment = null;
				localDrawingState = { routeId: route.id, pitchId: nextPitch.id };
				lastSnappedRouteId = null;
				lastSnappedVertexIndex = -1;
				updateTick += 1;
			}
			return;
		}

		if (event.key === 'n' || event.key === 'N' || event.key === 'Enter') {
			if (currentLineSegments.length > 0 && currentClickData.length > 0) {
				let allPointsWithNormals = [];
				currentLineSegments.forEach(segment => {
					if (segment.pointsData?.length > 0) allPointsWithNormals.push(...segment.pointsData);
				});
				if (allPointsWithNormals.length > 0) {
					const modelOffset = new Vector3(...(props.position || [0, 0, 0]));
					const finalPoints = allPointsWithNormals.map(p => p.point.clone().sub(modelOffset).toArray().map(c => Number(c.toFixed(2))));
					const averageNormal = new Vector3();
					allPointsWithNormals.forEach(pd => averageNormal.add(pd.normal));
					averageNormal.normalize();

					if (activeTool === 'multipitch') {
						let route = userState.topo.routes.find(r => r.id === (localDrawingState?.routeId || userState.ui.selectedRouteId));
						if (!route) {
							route = {
								id: crypto.randomUUID(),
								name: 'New Multi-Pitch',
								type: 'multi-pitch',
								pitches: [],
								orientation: [averageNormal.x, averageNormal.y, averageNormal.z],
								tags: [],
								fixPoints: []
							};
							userState.topo.routes = [...userState.topo.routes, route];
							userState.ui.selectedRouteId = route.id;
						}
						const endId = crypto.randomUUID();
						userState.topo.fixPoints.push({ id: endId, position: finalPoints[finalPoints.length - 1], type: 'bolt' });
						route.pitches.push({ id: crypto.randomUUID(), pitchNumber: route.pitches.length + 1, points: finalPoints, type: 'climb', endNodeId: endId });
					} else {
						const newRoute = {
							id: crypto.randomUUID(),
							name: 'New Route',
							points: finalPoints,
							orientation: [averageNormal.x, averageNormal.y, averageNormal.z],
							tags: [],
							fixPoints: []
						};
						userState.topo.routes = [...userState.topo.routes, newRoute];
						userState.ui.selectedRouteId = newRoute.id;
					}
				}
				currentClickData = [];
				currentLineSegments = [];
				firstPointVisual = null;
				previewLineSegment = null;
				lastSnappedRouteId = null;
				lastSnappedVertexIndex = -1;
				updateTick += 1;
			}
		} else if (event.key === 'Escape') {
			currentClickData = [];
			currentLineSegments = [];
			firstPointVisual = null;
			previewLineSegment = null;
			lastSnappedRouteId = null;
			lastSnappedVertexIndex = -1;
		}
	}

	function generateProjectedSegment(startData, endData, mesh, cam, stepSize = STEP_SIZE) {
		if (!cam || !mesh || !startData?.point || !endData?.point) return [];
		const startPoint = startData.point.clone();
		const endPoint = endData.point.clone();
		const startToEnd = new Vector3().subVectors(endPoint, startPoint);
		const segmentLength = startToEnd.length();
		if (segmentLength < 0.001) return [{ point: startPoint, normal: startData.normal.clone() }, { point: endPoint, normal: endData.normal.clone() }];

		const pointsData = [{ point: startPoint, normal: startData.normal.clone() }];
		const camPos = cam.position.clone();
		const subdivisions = Math.min(20, Math.max(5, Math.ceil(segmentLength / stepSize)));

		for (let i = 1; i < subdivisions; i++) {
			const t = i / subdivisions;
			const interP = new Vector3().copy(startPoint).addScaledVector(startToEnd, t);
			projectionRaycaster.set(camPos, new Vector3().subVectors(interP, camPos).normalize());
			const intersects = projectionRaycaster.intersectObject(mesh, true);
			
			if (intersects.length > 0 && intersects[0].face) {
				const hit = intersects[0];
				const normMat = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
				pointsData.push({ point: hit.point.clone(), normal: hit.face.normal.clone().applyMatrix3(normMat).normalize() });
			} else {
				pointsData.push({ point: interP, normal: new Vector3().lerpVectors(startData.normal, endData.normal, t).normalize() });
			}
		}
		pointsData.push({ point: endPoint, normal: endData.normal.clone() });
		return pointsData;
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>

{#if gltfScene}
	<T is={gltfScene} onclick={handleMeshClick} ondblclick={handleMeshDblClick} onpointermove={handleMeshPointerMove} dispose={null} {...props} />
{/if}

{#each clippingPlanes as plane, i}
	{#if i === activePlaneIndex} <Cutter {plane} active={isCutting} /> {/if}
{/each}

{#if previewLineSegment}
	<T.Mesh>
		<MeshLineGeometry points={previewLineSegment.points} />
		<MeshLineMaterial color={"#ffeb3b"} width={0.1} resolution={[$size.width, $size.height]} transparent opacity={0.7} />
	</T.Mesh>
{/if}

{#each currentLineSegments as segment (segment.id)}
	<T.Mesh>
		<MeshLineGeometry points={segment.points} />
		<MeshLineMaterial color={"#ff00ff"} width={0.15} resolution={[$size.width, $size.height]} />
	</T.Mesh>
{/each}

{#each visualFixPoints as point (point.id)}
	<CssObject position={point.renderPosition}>
		<div
			class="flex items-center justify-center w-6 h-6 bg-white/90 rounded-full shadow-lg backdrop-blur-sm border-2 transition-all cursor-pointer hover:scale-110 active:scale-95 {(point.type === 'belay' || point.type === 'abseil') ? 'border-sky-400' : 'border-red-400'} {point.isAssigned ? '!border-green-500' : ''}"
			onclick={(e) => {
				handleFixPointClick(e, point.id);
				if (activeTool === 'symbol') {
					// Logic for selecting symbol in 3D if needed
				}
			}}
			ondblclick={(e) => handleFixPointDblClick(e, point.id)}
		>
			<img 
				src="/icons/topo-symbols/{point.type}.svg" 
				alt={point.type}
				class="w-4 h-4"
			/>
		</div>
	</CssObject>
{/each}

{#each visualRoutes as route (route.id)}
	<CssObject position={route.points[0]}>
		{#snippet content()}
			<div 
				class={"route-label " + (userState.ui.selectedRouteId === route.parentId ? "!bg-blue-600 !scale-110 shadow-lg border-2 border-white" : "")}
				onclick={(e) => handleRouteClick(e, route.parentId)}
				onkeypress={(e) => e.key === 'Enter' && handleRouteClick(e, route.parentId)}
				role="button"
				tabindex="0"
			>
				{route.label}
			</div>
		{/snippet}
	</CssObject>

	{#if route.points}
			<!-- Visual Line -->
			<T.Mesh>
				<MeshLineGeometry points={route.points} />
				<MeshLineMaterial
					width={
						userState.ui.selectedRouteId === route.parentId ? 0.15 : 
						(lastSnappedRouteId === route.parentId ? 0.12 : 0.1)
					}
					color={
						userState.ui.selectedRouteId === route.parentId ? "#3b82f6" : 
						(lastSnappedRouteId === route.parentId ? "#f59e0b" : 
						(hoverSnappedRouteId === route.parentId ? "#3b82f6" : "#12538b"))
					}
					resolution={[$size.width, $size.height]}
				/>
			</T.Mesh>

			<!-- Hit Box -->
			{#if route.curve}
				<T.Mesh 
					onclick={(e) => handleRouteClick(e, route.parentId)}
					ondblclick={(e) => handleRouteDblClick(e, route.parentId)}
					onpointermove={handleMeshPointerMove}
					onpointerenter={() => currentClickData.length === 0 && (document.body.style.cursor = 'pointer')}
					onpointerleave={() => document.body.style.cursor = 'default'}
				>
					<T is={TubeGeometry} args={[route.curve, route.points.length, 0.15, 4, false]} />
					<T.MeshBasicMaterial transparent opacity={0} depthWrite={false} />
				</T.Mesh>
			{/if}
	{/if}

	{#if route.normal && route.normal.lengthSq() > 0.0001 && route.points.length > 0}
		<T is={ArrowHelper}
			 args={[
				 route.normal.normalize(),
				 route.points[0],
				 0.8,       /* length */
				 0xff0000,  /* color */
				 0.32,      /* headLength */
				 0.2       /* headWidth */
			]}
		/>
	{/if}
{/each}

{#if firstPointVisual}
	<T.Mesh position={firstPointVisual} renderOrder={999}>
		<T.SphereGeometry args={[0.1]} />
		<T.MeshBasicMaterial color="#00ff00" depthTest={false} transparent />
	</T.Mesh>
{/if}