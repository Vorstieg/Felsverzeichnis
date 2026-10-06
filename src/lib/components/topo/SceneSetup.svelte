<script lang="ts">
	import { useThrelte, useTask } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
	import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import type { CameraAnimation } from '$lib/types/application';
	let {
		animation = $bindable(null),
		controls,
		onAnimationEnd
	}: {
		animation: CameraAnimation | null;
		controls?: OrbitControls;
		onAnimationEnd: () => void;
	} = $props();

	const { scene, size, autoRenderTask, camera } = useThrelte();

	interactivity({ filter: (hits) => hits.slice(0, 1) });

	let cssRenderer: CSS2DRenderer;
	let targetElement: HTMLElement | null;
	onMount(() => {
		targetElement = document.getElementById('css-renderer-target');
		if (targetElement && scene && camera && size) {
			cssRenderer = new CSS2DRenderer({ element: targetElement });
			const unsubscribeSize = size.subscribe((value) => {
				if (cssRenderer && value.width && value.height) {
					cssRenderer.setSize(value.width, value.height);
				}
			});
			return () => {
				unsubscribeSize();
				if (targetElement) targetElement.innerHTML = '';
			};
		}
	});
	useTask(
		() => {
			if (cssRenderer && scene && camera?.current) cssRenderer.render(scene, camera.current);

			if (animation && camera?.current && controls) {
				const elapsed = (Date.now() - animation.startTime) / animation.duration;
				if (elapsed >= 1) {
					camera.current.position.copy(animation.endPos);
					controls.target.copy(animation.endTarget);
					animation = null;
					onAnimationEnd();
				} else {
					const t = cubicOut(elapsed);
					camera.current.position.lerpVectors(animation.startPos, animation.endPos, t);
					controls.target.lerpVectors(animation.startTarget, animation.endTarget, t);
				}
				controls.update();
			}
		},
		{ after: autoRenderTask, autoInvalidate: false }
	);
</script>
