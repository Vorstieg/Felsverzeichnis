<script>
	import { T } from '@threlte/core';
	import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

	// Use $props() to get pointerEvents and restProps (like position)
	let { pointerEvents = false, children, ...props } = $props();

	let element = $state(); // Bind to the wrapper div element
</script>

<div
	bind:this={element}
	style:pointer-events={pointerEvents ? 'auto' : 'none'}
	style:position="absolute"
	style:user-select="none"
	style:will-change="transform"
>
	{@render children?.()}
</div>

{#if element !== undefined}
	<T
		{...props}
		is={CSS2DObject}
		args={[element]}
	>
		{#snippet children({ ref })}
			{@render children?.({ ref })}
		{/snippet}
	</T>
{/if}