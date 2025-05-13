<script>
	import { T } from '@threlte/core';
	import { interactivity, Text, useGltf } from '@threlte/extras'; // Import Text for fallbacks

	interactivity();
	let {
		position = [0, 0, 0],
		modelUrl,
		...props
	} = $props();

	let gltf = $derived(modelUrl ? useGltf(modelUrl) : undefined);
	let modelRef;

	// Effect to modify materials after the model is loaded
	$effect(() => {
		if (modelRef) {
			modelRef.traverse((node) => {
				if (node.isMesh) {
					if (node.material) {
						const materials = Array.isArray(node.material) ? node.material : [node.material];
						materials.forEach(material => {
							if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
								material.metalness = 0;
								material.roughness = Math.max(material.roughness, 0.8);
								material.needsUpdate = true;
							}
						});
					}
				}
			});
		}
	});

</script>
{#if gltf}
	{#await gltf}
	{:then gltfInstance}
		<T {...props} is={gltfInstance.scene} {position} bind:ref={modelRef} />
	{:catch error}
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
	{/await}
{/if}