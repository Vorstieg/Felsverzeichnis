<script>
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
	} = $props();

	let svgElement = $state(null);
	let gElement = $state(null);
	let transform = $state({ x: 0, y: 0, k: 1 });
	let baseWidth = $state(1000);
	let baseHeight = $state(667);

	function renderViewerDecorations() {
		if (!gElement) return;
		const root = select(gElement);
		const hasBackgroundImage = Boolean(topo.image2D);
		const gridId = 'topo-viewer-grid';
		const defs = select(svgElement).selectAll('defs.topo-viewer-defs').data([null]).join('defs');
		const pattern = defs
			.selectAll(`pattern#${gridId}`)
			.data([null])
			.join('pattern')
			.attr('id', gridId)
			.attr('width', 50)
			.attr('height', 50)
			.attr('patternUnits', 'userSpaceOnUse');
		pattern
			.selectAll('path')
			.data([null])
			.join('path')
			.attr('d', 'M 50 0 L 0 0 0 50')
			.attr('fill', 'none')
			.attr('stroke', colors.ui.grid)
			.attr('stroke-width', 1);

		// A route-only topo has the same neutral drawing surface as the editor.
		// Keep it inside the zoomed content group so panning behaves consistently.
		root
			.selectAll('rect.viewer-blank-background')
			.data(hasBackgroundImage ? [] : [null])
			.join('rect')
			.attr('class', 'viewer-blank-background')
			.attr('width', baseWidth)
			.attr('height', baseHeight)
			.attr('fill', `url(#${gridId})`)
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
			(label) => Array.isArray(label.position2D) && label.position2D.length === 2
		);
		labelsLayer
			.selectAll('text.topo-text-label')
			.data(labels, (label) => label.id)
			.join('text')
			.attr('class', 'topo-text-label')
			.attr(
				'transform',
				(label) =>
					`translate(${label.position2D[0] * baseWidth}, ${label.position2D[1] * baseHeight}) rotate(${label.rotation2D || 0})`
			)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'middle')
			.attr('font-size', (label) => (label.fontSize2D || 0.025) * baseHeight)
			.attr('font-weight', (label) => label.fontWeight || 700)
			.attr('fill', (label) => label.color || colors.text.ink)
			.style('pointer-events', 'none')
			.text((label) => label.text || '');
	}

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
		const savedRatio = Number(topo.canvasAspectRatio || topo.imageAspectRatio);
		const ratio = Number.isFinite(savedRatio) && savedRatio > 0 ? savedRatio : 1.5;
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

<div class="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
	<svg bind:this={svgElement} viewBox="0 0 {baseWidth} {baseHeight}" class="w-full h-full cursor-grab" style="touch-action: none;">
		<g bind:this={gElement}></g>
	</svg>
</div>
