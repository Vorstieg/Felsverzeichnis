<script context="module">
	// Use WeakMap to associate cache with the specific Renderer instance.
	// When the Renderer is destroyed (e.g. navigation away from Topo view), 
	// the cache is automatically garbage collected, preventing memory leaks.
	const rendererCache = new WeakMap();

	/**
	 * Applies common material modifications to a Three.js scene graph.
	 * This ensures consistent visual properties for loaded models.
	 * @param {THREE.Object3D} object The root object of the scene graph to traverse.
	 */
	function applyMaterialFixes(object) {
		object.traverse((node) => {
			if (node.isMesh) {
				node.castShadow = true;
				node.receiveShadow = true;
				node.frustumCulled = false;

				if (node.material) {
					const materials = Array.isArray(node.material) ? node.material : [node.material];
					materials.forEach(material => {
						if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
							material.metalness = 0;
							material.roughness = Math.max(material.roughness, 0.8);
							material.emissive.setHex(0x252525);
							
							// Custom: Fade out when close to camera
							// Dithered transparency to avoid depth sorting issues
							
							material.onBeforeCompile = (shader) => {
								shader.vertexShader = `
									varying vec3 vWorldPositionVar;
								` + shader.vertexShader;
								
								shader.vertexShader = shader.vertexShader.replace(
									'#include <worldpos_vertex>',
									`
									#include <worldpos_vertex>
									vWorldPositionVar = (modelMatrix * vec4(transformed, 1.0)).xyz;
									`
								);
								
								shader.fragmentShader = `
									varying vec3 vWorldPositionVar;
									
									float hash(vec2 p) {
										return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
									}
								` + shader.fragmentShader;
								
								shader.fragmentShader = shader.fragmentShader.replace(
									'#include <dithering_fragment>',
									`
									#include <dithering_fragment>
									float fadeDist = distance(cameraPosition, vWorldPositionVar);
									float fadeAlpha = smoothstep(0.8, 2.5, fadeDist);
									
									if (fadeAlpha < 1.0) {
										if (fadeAlpha < hash(gl_FragCoord.xy)) discard;
									}
									`
								);
							};

							material.needsUpdate = true;
						}
					});
				}
			}
		});
	}
</script>

<script>
	import { T, useThrelte } from '@threlte/core';
	import { interactivity, Text } from '@threlte/extras';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

	interactivity();

	let {
		position = [0, 0, 0],
		modelUrl,
		onload,
		...props
	} = $props();

	// Access the current Three.js WebGLRenderer from the Threlte context.
	// This renderer instance serves as the key for our cache, ensuring context-aware caching.
	const { renderer } = useThrelte();

	let scene = $state(); // Holds the loaded (and potentially cached) GLTF scene
	let error = $state(); // Stores any error during model loading
	let modelRef; // Reference to the mounted Three.js object in the scene

	/**
	 * $effect hook to handle model loading based on `modelUrl` and `renderer`.
	 * It checks the cache first and loads the model if not found or if the renderer context has changed.
	 */
	$effect(() => {
		// Clear previous state when modelUrl or renderer changes
		scene = undefined;
		error = undefined;
		
		if (!modelUrl || !renderer) {
			return; // Do nothing if modelUrl or renderer is not yet available
		}

		// Get or create the cache for this specific renderer instance
		let cache = rendererCache.get(renderer);
		if (!cache) {
			cache = new Map();
			rendererCache.set(renderer, cache);
		}

		const cachedScene = cache.get(modelUrl);
		
		if (cachedScene) {
			// Cache hit: Reuse the cached scene.
			// This is fast as no loading/parsing is required.
			scene = cachedScene;
			onload?.(); // Notify parent that the model is "loaded" (from cache)
			return;
		}
		
		// Cache miss: Load the model fresh using GLTFLoader.
		// The browser's HTTP cache will still prevent re-downloading if available.
		const loader = new GLTFLoader();
		loader.load(
			modelUrl,
			(gltf) => {
				const s = gltf.scene;
				applyMaterialFixes(s); // Apply standardized material modifications
				
				// Store the processed scene in cache for this renderer
				cache.set(modelUrl, s);
				
				scene = s; // Make the scene available for rendering
				onload?.(); // Notify parent that the model has finished loading
			},
			undefined, // onProgress callback (not used here, but can be added if needed)
			(err) => {
				console.error('Error loading model:', err);
				error = err; // Store error for display
			}
		);
	});

</script>

<!-- Conditional rendering based on error or loaded scene state -->
{#if error}
	<T.Group {position}>
		<T.Mesh>
			<T.SphereGeometry args={[0.1]} />
			<T.MeshBasicMaterial color="red" wireframe={true} />
			<Text
				text={'Error: ' + error.message}
				anchorX='center'
				anchorY='middle'
				position={[0,-0.3,0]}
				fontSize={0.08}
				castShadow={false}
				receiveShadow={false}
			/>
		</T.Mesh>
	</T.Group>
{:else if scene}
	<!-- Use a #key block to ensure the <T> component reacts correctly if the 'scene' object reference changes.
	     We clone the scene to ensure each mount gets its own Object3D hierarchy.
	     dispose={false} is crucial here: it prevents Threlte from disposing the
	     shared geometry/materials held in the cache when this component unmounts.
	     The cloned scene's Object3D structure will be garbage collected naturally. -->
	{#key scene} 
		<T {...props} is={scene.clone(true)} dispose={false} {position} bind:ref={modelRef} />
	{/key}
{/if}