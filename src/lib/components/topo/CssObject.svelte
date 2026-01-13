<script>
	import { T, useThrelte, useTask } from '@threlte/core';
	import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
	import { Vector3 } from 'three';

	// Use $props() to get pointerEvents and restProps (like position)
	let { pointerEvents = false, scaleWithZoom = false, referenceDistance = 15, children, ...props } = $props();

	let element = $state(); // Bind to the wrapper div element
	let innerElement = $state();
	let cssObject = $state();
	
	const { camera } = useThrelte();
	const vec = new Vector3();

	useTask(() => {
		if (scaleWithZoom && innerElement && cssObject && camera.current) {
			cssObject.getWorldPosition(vec);
			const distance = camera.current.position.distanceTo(vec);
			// Prevent division by zero or infinite scaling near 0
			// Standard perspective projection: scale is inversely proportional to distance.
			// If distance = referenceDistance, scale = 1.
			// If distance = 2 * referenceDistance, scale = 0.5.
			let scale = referenceDistance / Math.max(0.1, distance);
			
			// Clamp scale to reasonable limits to avoid disappearance or huge elements
			scale = Math.max(0.1, Math.min(5, scale));
			
			innerElement.style.transform = `scale(${scale})`;
		}
	});
</script>

<div
	bind:this={element}
	style:pointer-events={pointerEvents ? 'auto' : 'none'}
	style:position="absolute"
	style:user-select="none"
	style:will-change="transform"
>
	<div bind:this={innerElement} style:transition="transform 0.1s linear">
		{@render children?.()}
	</div>
</div>

{#if element !== undefined}
	<T
		{...props}
		is={CSS2DObject}
		args={[element]}
		bind:ref={cssObject}
	>
		{#snippet children({ ref })}
			{@render children?.({ ref })}
		{/snippet}
	</T>
{/if}