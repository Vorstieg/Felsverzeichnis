<script>
	import { T, useTask } from '@threlte/core';
	import { TransformControls } from '@threlte/extras';
	import { Plane, Vector3, DoubleSide } from 'three';

	let { plane = $bindable(), active = false } = $props();

	let planeMesh = $state();

	// Initialize the clipping plane
	// Normal points +Y by default for a horizontal plane
	const initNormal = new Vector3(0, 1, 0);
	const initConstant = 0;
	
	$effect(() => {
		if (!plane) {
			plane = new Plane(initNormal, initConstant);
		}
	});

	// Update the mathematical plane when the mesh moves
	useTask(() => {
		if (planeMesh && active) {
			// The plane is defined by a normal and a constant (distance from origin).
			// We derive this from the mesh's world position and rotation.

			const normal = new Vector3(0, 0, 1).applyQuaternion(planeMesh.quaternion);
			const point = planeMesh.position;
			
			plane.normal.copy(normal);
			plane.constant = -point.dot(normal);
		}
	});

</script>

{#if active}
	<T.Mesh
		bind:ref={planeMesh}
		position={[0, 1, 0]} 
		rotation={[-Math.PI / 2, 0, 0]}
		scale={[5, 5, 1]}
	>
		<T.PlaneGeometry />
		<T.MeshBasicMaterial 
			color="red" 
			side={DoubleSide} 
			transparent 
			opacity={0.25} 
			depthWrite={false}
		/>
	</T.Mesh>

	{#if planeMesh}
		<TransformControls object={planeMesh} mode="translate" />
		<TransformControls object={planeMesh} mode="rotate" showX={true} showY={true} showZ={true} size={0.5} />
	{/if}
{/if}