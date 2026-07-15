<script>
	import { onMount } from 'svelte';
	import { zoom as d3Zoom } from 'd3-zoom';
	import { select } from 'd3-selection';
	import { getHitAreaSize } from '$lib/assets/js/mobile-utils.js';
	import { renderTopoSvg, topoSymbols } from '@fels/topo-renderer';

	let {
		topo,
		routes = [],
		selectedRouteId = null,
		onRouteSelect = () => {},
		hoveredRouteId = $bindable(null)
	} = $props();

	let svgElement = $state(null);
	let gElement = $state(null);
	let transform = $state({ x: 0, y: 0, k: 1 });
	let baseWidth = $state(1000);
	let baseHeight = $state(667);

	onMount(() => {
		if (!svgElement || !gElement) return;
		const zoomBehavior = d3Zoom()
			.scaleExtent([0.1, 10])
			.filter((event) =>
				event.type === 'wheel' || event.type.startsWith('touch') || event.type !== 'mousedown' || event.button === 0
			)
			.on('zoom', (event) => {
				transform = event.transform;
				select(gElement).attr('transform', `translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`);
			});
		select(svgElement).call(zoomBehavior);
		return () => select(svgElement).on('.zoom', null);
	});

	$effect(() => {
		const ratio = topo.imageAspectRatio || 1.5;
		baseWidth = 1000;
		baseHeight = 1000 / ratio;
	});

	$effect(() => {
		JSON.stringify({ routes, outlines: topo.outlines, fixPoints: topo.fixPoints, image: topo.image2D });
		selectedRouteId;
		hoveredRouteId;
		transform;
		requestAnimationFrame(() =>
			renderTopoSvg({
				gElement,
				topo,
				routes,
				baseWidth,
				baseHeight,
				selectedRouteId,
				hoveredRouteId,
				onRouteSelect,
				onRouteHover: (routeId) => (hoveredRouteId = routeId),
				getHitAreaSize,
				symbols: topoSymbols
			})
		);
	});
</script>

<div class="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
	<svg bind:this={svgElement} viewBox="0 0 {baseWidth} {baseHeight}" class="w-full h-full cursor-grab" style="touch-action: none;">
		<g bind:this={gElement}></g>
	</svg>
</div>
