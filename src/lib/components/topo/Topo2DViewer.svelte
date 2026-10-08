<script lang="ts">
	import type { FelsTopoDocument, Route, Point2D, TextLabel } from '@vorstieg/fels-types/types';
	import type { D3ZoomEvent } from 'd3-zoom';
	import { onMount } from 'svelte';
	import { zoom as d3Zoom } from 'd3-zoom';
	import { select } from 'd3-selection';
	import { getHitAreaSize } from '$lib/assets/js/mobile-utils.js';
	import { renderTopoSvg, topoSymbols } from '@vorstieg/topo-renderer';
	import { colors } from '$lib/colors.js';

	let {
		topo,
		routes = [],
		selectedRouteId = null,
		onRouteSelect = () => {},
		hoveredRouteId = $bindable(null)
	}: {
		topo: FelsTopoDocument;
		routes?: Route[];
		selectedRouteId?: Route['id'] | null;
		onRouteSelect?: (route: Route) => void;
		hoveredRouteId?: Route['id'] | null;
	} = $props();

	let svgElement = $state<SVGSVGElement | null>(null);
	let gElement = $state<SVGGElement | null>(null);
	let transform = $state({ x: 0, y: 0, k: 1 });
	let baseWidth = $state(1000);
	let baseHeight = $state(667);

	function renderViewerDecorations() {
		if (!gElement) return;
		const root = select(gElement);
		const hasBackgroundImage = Boolean(topo.image2D);
		// Keep the route-only background inside the zoomed content group.
		root
			.selectAll('rect.viewer-blank-background')
			.data(hasBackgroundImage ? [] : [null])
			.join('rect')
			.attr('class', 'viewer-blank-background')
			.attr('width', baseWidth)
			.attr('height', baseHeight)
			.attr('fill', '#fff')
			.attr('pointer-events', 'none')
			.lower();

		// Text labels are authored by Felsstudio but are not yet part of the
		// shared renderer's public API. Render them in their own stable layer so
		// they retain the editor's normalized placement and styling.
		const labelsLayer = root
			.selectAll('g.topo-text-labels-layer')
			.data([null])
			.join('g')
			.attr('class', 'topo-text-labels-layer');
		const labels = (topo.textLabels || []).filter(
			(label): label is TextLabel & { position2D: Point2D } => label.position2D !== undefined
		);
		labelsLayer
			.selectAll<SVGTextElement, TextLabel & { position2D: Point2D }>('text.topo-text-label')
			.data(labels, (label) => String(label.id))
			.join('text')
			.attr('class', 'topo-text-label')
			.attr(
				'transform',
				(label) =>
					`translate(${label.position2D[0] * baseWidth}, ${label.position2D[1] * baseHeight}) rotate(${label.rotation2D ?? 0})`
			)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'middle')
			.attr('font-size', (label) => (label.fontSize2D ?? 0.025) * baseHeight)
			.attr('font-weight', (label) => label.fontWeight ?? 700)
			.attr('fill', (label) => label.color || colors.text.ink)
			.style('pointer-events', 'none')
			.text((label) => label.text);
	}

	onMount(() => {
		if (!svgElement || !gElement) return;
		const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 10])
			.filter(
				(event: MouseEvent | TouchEvent | WheelEvent) =>
					event.type === 'wheel' ||
					event.type.startsWith('touch') ||
					event.type !== 'mousedown' ||
					('button' in event && event.button === 0)
			)
			.on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
				transform = event.transform;
				if (!gElement) return;
				select(gElement).attr(
					'transform',
					`translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`
				);
			});
		select(svgElement).call(zoomBehavior);
		return () => select(svgElement).on('.zoom', null);
	});

	$effect(() => {
		const savedRatio = topo.imageAspectRatio ?? 1.5;
		const ratio = savedRatio;
		baseWidth = 1000;
		baseHeight = 1000 / ratio;
	});

	$effect(() => {
		JSON.stringify({
			routes,
			outlines: topo.outlines,
			fixPoints: topo.fixPoints,
			textLabels: topo.textLabels,
			image: topo.image2D,
			backgroundFit: topo.backgroundFit
		});
		selectedRouteId;
		hoveredRouteId;
		transform;
		requestAnimationFrame(() => {
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
			});
			renderViewerDecorations();
		});
	});
</script>

<div class="relative h-full w-full overflow-hidden rounded-lg bg-white">
	<svg
		bind:this={svgElement}
		viewBox="0 0 {baseWidth} {baseHeight}"
		class="h-full w-full cursor-grab"
		style="touch-action: none;"
	>
		<g bind:this={gElement}></g>
	</svg>
</div>
