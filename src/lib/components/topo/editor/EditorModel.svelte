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
    import { Topo3DInteractionManager } from './3d/InteractionManager.svelte.js';

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

    // --- Interaction Manager ---
    const interaction = new Topo3DInteractionManager();

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
    
    // Derived state for rendering saved routes
	let visualRoutes = $derived.by(() => {
		const _ = interaction.updateTick; // Subscribe to updates from interaction manager
		
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
			if (userState.ui.selectedRouteId) {
				const route = userState.topo.routes.find(r => r.id === userState.ui.selectedRouteId);
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

    // Sync state to interaction manager
    $effect(() => {
        interaction.gltfScene = gltfScene;
        interaction.camera = camera.current;
        interaction.modelPosition = props.position || [0, 0, 0];
        interaction.visualRoutes = visualRoutes;
        interaction.visualFixPoints = visualFixPoints;
    });

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

	onMount(() => {
		const handleKey = (e) => interaction.handleKeyDown(e, activeTool);
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	});
</script>

{#if gltfScene}
	<T is={gltfScene} onclick={(e) => interaction.handleMeshClick(e)} ondblclick={(e) => interaction.handleMeshDblClick(e, activeTool)} onpointermove={(e) => interaction.handleMeshPointerMove(e, activeTool)} dispose={null} {...props} />
{/if}

{#each clippingPlanes as plane, i}
	{#if i === activePlaneIndex} <Cutter {plane} active={isCutting} /> {/if}
{/each}

{#if interaction.previewLineSegment}
	<T.Mesh>
		<MeshLineGeometry points={interaction.previewLineSegment.points} />
		<MeshLineMaterial color={"#ffeb3b"} width={0.1} resolution={[$size.width, $size.height]} transparent opacity={0.7} />
	</T.Mesh>
{/if}

{#each interaction.currentLineSegments as segment (segment.id)}
	<T.Mesh>
		<MeshLineGeometry points={segment.points} />
		<MeshLineMaterial color={"#ff00ff"} width={0.15} resolution={[$size.width, $size.height]} />
	</T.Mesh>
{/each}

{#each visualFixPoints as point (point.id)}
	<CssObject position={point.renderPosition} scaleWithZoom={true}>
		<div
			class="flex items-center justify-center w-6 h-6 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-95 bg-transparent {point.isAssigned ? 'border-2 !border-green-500' : ''}"
			onclick={(e) => {
				interaction.handleFixPointClick(e, point.id);
				if (activeTool === 'symbol') {
					// Logic for selecting symbol in 3D if needed
				}
			}}
			ondblclick={(e) => interaction.handleFixPointDblClick(e, point.id, activeTool)}
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
				onclick={(e) => {
                    // Route selection logic usually handled by visual routes click, or we can add specific handler
                    // For now, assume this just selects
                    // But wait, handleRouteClick is NO LONGER in EditorModel or InteractionManager explicitly exposed as single click?
                    // Ah, I missed handleRouteClick in InteractionManager!
                    // Let me check InteractionManager content again.
                    // It has handleRouteDblClick, handleMeshClick...
                    // Is there a handleRouteClick?
                    // No!
                    // But in the original file, handleRouteClick was probably just setting selection.
                    // Let's implement it inline or add it to interaction manager.
                    // Inline for now:
                    e.stopPropagation();
                    userState.ui.selectedRouteId = (userState.ui.selectedRouteId === route.parentId) ? null : route.parentId;
                }}
				onkeypress={(e) => {
                    if (e.key === 'Enter') {
                        e.stopPropagation();
                        userState.ui.selectedRouteId = (userState.ui.selectedRouteId === route.parentId) ? null : route.parentId;
                    }
                }}
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
						(interaction.lastSnappedRouteId === route.parentId ? 0.12 : 0.1)
					}
					color={
						userState.ui.selectedRouteId === route.parentId ? "#3b82f6" : 
						(interaction.lastSnappedRouteId === route.parentId ? "#f59e0b" : 
						(interaction.hoverSnappedRouteId === route.parentId ? "#3b82f6" : "#12538b"))
					}
					resolution={[$size.width, $size.height]}
				/>
			</T.Mesh>

			<!-- Hit Box -->
			{#if route.curve}
				<T.Mesh 
					onclick={(e) => {
                        e.stopPropagation();
                        userState.ui.selectedRouteId = (userState.ui.selectedRouteId === route.parentId) ? null : route.parentId;
                    }}
					ondblclick={(e) => interaction.handleRouteDblClick(e, route.parentId, activeTool)}
					onpointermove={(e) => interaction.handleMeshPointerMove(e, activeTool)}
					onpointerenter={() => interaction.currentClickData.length === 0 && (document.body.style.cursor = 'pointer')}
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

{#if interaction.firstPointVisual}
	<T.Mesh position={interaction.firstPointVisual} renderOrder={999}>
		<T.SphereGeometry args={[0.1]} />
		<T.MeshBasicMaterial color="#00ff00" depthTest={false} transparent />
	</T.Mesh>
{/if}