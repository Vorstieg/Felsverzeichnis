<script>
	import { onMount } from 'svelte';
	import { zoom as d3Zoom } from 'd3-zoom';
	import { select } from 'd3-selection';
	import { getHitAreaSize } from '$lib/assets/js/mobile-utils.js';
	import { topoSymbols } from '$lib/assets/js/topo-utils.js';

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
	let baseWidth = 1000;
	let baseHeight = 667;

	onMount(() => {
		if (!svgElement || !gElement) return;

		// Set base dimensions from aspect ratio
		const rect = svgElement.getBoundingClientRect();
		const ratio = topo.imageAspectRatio || rect.width / rect.height;
		baseWidth = 1000;
		baseHeight = 1000 / ratio;

		const zoomBehavior = d3Zoom()
			.scaleExtent([0.1, 10])
			.filter((event) => {
				// Allow wheel for desktop
				if (event.type === 'wheel') return true;
				// Allow single touch and multi touch
				if (
					event.type === 'touchstart' ||
					event.type === 'touchmove' ||
					event.type === 'touchend'
				) {
					return true;
				}
				// Allow left mouse button
				return event.type === 'mousedown' ? event.button === 0 : true;
			})
			.on('zoom', (event) => {
				transform = event.transform;
				// Apply transform directly to the g element via D3
				// Convert transform object to SVG transform string
				select(gElement).attr(
					'transform',
					`translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`
				);
			});

		if (zoomBehavior) {
			select(svgElement).call(zoomBehavior);
		}

		return () => {
			select(svgElement).on('.zoom', null);
		};
	});

	// Synchronize base dimensions reactively
	$effect(() => {
		const ratio = topo.imageAspectRatio || 1.5;
		baseWidth = 1000;
		baseHeight = 1000 / ratio;
	});

	// Re-run rendering when selection or hover changes
	$effect(() => {
		// Dependencies: these must be referenced to trigger effect
		const _sel = selectedRouteId;
		const _hov = hoveredRouteId;
		// Use requestAnimationFrame to avoid "flush" errors if state updates fast
		requestAnimationFrame(updateD3Rendering);
	});

	function updateD3Rendering() {
		if (!svgElement || !gElement) return;

		const svg = select(svgElement);
		const mainG = select(gElement);

		// Ensure layer groups exist and are stable
		function getOrCreateLayer(className) {
			let layer = mainG.select(`g.${className}`);
			if (layer.empty()) {
				layer = mainG.append('g').attr('class', className);
			}
			return layer;
		}

		const bgLayer = getOrCreateLayer('background-layer');
		const outlinesLayer = getOrCreateLayer('outlines-layer');
		const routesLayer = getOrCreateLayer('routes-layer');
		const symbolsLayer = getOrCreateLayer('symbols-layer');

		// 1. Background
		bgLayer
			.selectAll('image.bg-image')
			.data(topo.image2D ? [topo.image2D] : [])
			.join(
				(enter) => enter.append('image').attr('class', 'bg-image'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('href', (d) => d)
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', baseWidth)
			.attr('height', baseHeight)
			.attr('preserveAspectRatio', 'none');

		// 1.5 Rock Outlines
		const outlines = topo.outlines || [];
		outlinesLayer
			.selectAll('polyline.rock-outline')
			.data(outlines, (d, i) => i) // Use index as stable key if no ID
			.join(
				(enter) =>
					enter
						.append('polyline')
						.attr('class', 'rock-outline')
						.attr('fill', 'none')
						.attr('stroke', '#d97706') // Amber-600
						.attr('stroke-width', 3)
						.attr('stroke-dasharray', '5,5')
						.attr('opacity', 0.8),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('points', (d) =>
				d.points2D.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ')
			);

		// 2. Routes
		const routes2D = routes.filter((r) => r.points2D && r.points2D.length > 0);
		routesLayer
			.selectAll('g.route-group')
			.data(routes2D, (d) => d.id)
			.join(
				(enter) => {
					const group = enter.append('g').attr('class', 'route-group cursor-pointer');

					group.append('polyline').attr('class', 'hit-area');
					group.append('polyline').attr('class', 'visible-line');
					group.append('text').attr('class', 'route-label');

					return group;
				},
				(update) => update,
				(exit) => exit.remove()
			)
			.each(function (route, i) {
				const group = select(this);
				const isSelected = selectedRouteId === route.id;
				const isHovered = hoveredRouteId === route.id;
				const highlight = isSelected || isHovered;

				const pointsStr = route.points2D
					.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`)
					.join(' ');

				group
					.on('click', (e) => {
						e.stopPropagation();
						onRouteSelect(route);
					})
					.on('mouseenter', () => (hoveredRouteId = route.id))
					.on('mouseleave', () => (hoveredRouteId = null));

				// Hit Area (Transparent)
				const hitAreaSize = getHitAreaSize(10);
				group
					.select('polyline.hit-area')
					.attr('points', pointsStr)
					.attr('fill', 'none')
					.attr('stroke', 'transparent')
					.attr('stroke-width', hitAreaSize)
					.attr('stroke-linecap', 'round')
					.attr('stroke-linejoin', 'round');

				// Visible Line
				group
					.select('polyline.visible-line')
					.attr('points', pointsStr)
					.attr('fill', 'none')
					.attr('stroke', highlight ? '#3b82f6' : '#12538b')
					.attr('stroke-width', highlight ? 5 : 3)
					.attr('stroke-linecap', 'round')
					.attr('stroke-linejoin', 'round')
					.attr('opacity', highlight ? 1 : 0.8)
					.style('transition', 'all 0.2s');

				// Label
				group
					.select('text.route-label')
					.attr('x', route.points2D[0][0] * baseWidth)
					.attr('y', route.points2D[0][1] * baseHeight - 10)
					.attr('font-size', '20')
					.attr('font-weight', 'bold')
					.attr('fill', highlight ? '#3b82f6' : '#12538b')
					.attr('text-anchor', 'middle')
					.text(i + 1);
			});

		// 3. Symbols (FixPoints)
		const symbolData = topo.fixPoints || [];
		symbolsLayer
			.selectAll('g.symbol-group')
			.data(
				symbolData.filter((s) => s.position2D),
				(d) => d.id
			)
			.join(
				(enter) => {
					const group = enter.append('g').attr('class', 'symbol-group');
					group.append('image');
					return group;
				},
				(update) => update,
				(exit) => exit.remove()
			)
			.attr(
				'transform',
				(symbol) =>
					`translate(${symbol.position2D[0] * baseWidth}, ${
						symbol.position2D[1] * baseHeight
					}) rotate(${symbol.rotation2D || 0}) scale(${symbol.scale2D || 1})`
			)
			.each(function (symbol) {
				const meta = topoSymbols.find((s) => s.id === symbol.type);
				const baseSize = meta?.width || 24;
				const radius = baseSize / 2;

				select(this)
					.select('image')
					.attr('width', baseSize)
					.attr('height', baseSize)
					.attr('x', -radius)
					.attr('y', -radius)
					.attr('href', `/icons/topo-symbols/${symbol.type}.svg`);
			});
	}

	$effect(() => {
		// Deep reactivity tracking for Svelte 5
		routes.forEach((r) => {
			if (r.points2D) {
				r.points2D.forEach((p) => {
					p[0];
					p[1];
				});
			}
		});
		if (topo.outlines) {
			topo.outlines.forEach((o) => {
				if (o.points2D) {
					o.points2D.forEach((p) => {
						p[0];
						p[1];
					});
				}
			});
		}
		if (topo.fixPoints) {
			topo.fixPoints.forEach((s) => {
				if (s.position2D) {
					s.position2D[0];
					s.position2D[1];
					s.rotation2D;
					s.scale2D;
				}
			});
		}

		// Map simple triggers
		const _trigger = {
			selected: selectedRouteId,
			zoom: transform,
			size: { baseWidth, baseHeight },
			topoImage: topo.image2D
		};

		updateD3Rendering();
	});
</script>

<div class="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
	<svg
		bind:this={svgElement}
		viewBox="0 0 {baseWidth} {baseHeight}"
		class="w-full h-full cursor-grab"
		style="touch-action: none;"
	>
		<g bind:this={gElement}> </g>
	</svg>
</div>
