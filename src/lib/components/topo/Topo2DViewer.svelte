<script>
	import { onMount } from 'svelte';
	import { zoom as d3Zoom } from 'd3-zoom';
	import { select } from 'd3-selection';

	let { topo, routes = [], selectedRouteId = null } = $props();

	let svgElement = $state(null);
	let gElement = $state(null);
	let transform = $state({ x: 0, y: 0, k: 1 });
	let baseWidth = 1000;
	let baseHeight = 667;

	onMount(() => {
		if (!svgElement || !gElement) return;

		// Set base dimensions from aspect ratio
		const rect = svgElement.getBoundingClientRect();
		const ratio = topo.imageAspectRatio || (rect.width / rect.height);
		baseWidth = 1000;
		baseHeight = 1000 / ratio;

		const zoomBehavior = d3Zoom()
			.scaleExtent([0.1, 10])
			.on('zoom', (event) => {
				transform = event.transform;
			});

		select(svgElement).call(zoomBehavior);

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

	function updateD3Rendering() {
		if (!svgElement || !gElement) return;

		const svg = select(svgElement);
		const mainG = select(gElement);

		// Use the "Full Wipe" strategy for total consistency
		mainG.selectAll('*').remove();

		const bgLayer = mainG.append('g').attr('class', 'background-layer');
		const outlinesLayer = mainG.append('g').attr('class', 'outlines-layer');
		const routesLayer = mainG.append('g').attr('class', 'routes-layer');
		const symbolsLayer = mainG.append('g').attr('class', 'symbols-layer');

		// 1. Background
		if (topo.image2D) {
			bgLayer.append('image')
				.attr('href', topo.image2D)
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('preserveAspectRatio', 'none');
		} else {
			bgLayer.append('rect')
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('fill', '#f9fafb');
			
			const defs = svg.select('defs');
			if (defs.empty()) svg.append('defs');
			if (svg.select('#grid-pattern-viewer').empty()) {
				svg.select('defs').append('pattern')
					.attr('id', 'grid-pattern-viewer')
					.attr('width', 50)
					.attr('height', 50)
					.attr('patternUnits', 'userSpaceOnUse')
					.append('path')
					.attr('d', 'M 50 0 L 0 0 0 50')
					.attr('fill', 'none')
					.attr('stroke', '#e5e7eb')
					.attr('stroke-width', 1);
			}
			bgLayer.append('rect')
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('fill', 'url(#grid-pattern-viewer)');
		}

		// 1.5 Rock Outlines
		const outlines = topo.outlines || [];
		outlines.forEach(outline => {
			const pointsStr = outline.points2D.map(p => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ');
			outlinesLayer.append('polyline')
				.attr('points', pointsStr)
				.attr('fill', 'none')
				.attr('stroke', '#d97706') // Amber-600
				.attr('stroke-width', 3)
				.attr('stroke-dasharray', '5,5')
				.attr('opacity', 0.8);
		});

		// 2. Routes
		const routes2D = routes.filter(r => r.points2D && r.points2D.length > 0);
		routes2D.forEach((route, i) => {
			const isSelected = selectedRouteId === route.id;
			const group = routesLayer.append('g').attr('class', 'route-group');
			const pointsStr = route.points2D.map(p => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ');

			group.append('polyline')
				.attr('points', pointsStr)
				.attr('fill', 'none')
				.attr('stroke', isSelected ? '#3b82f6' : '#12538b')
				.attr('stroke-width', isSelected ? 5 : 3)
				.attr('stroke-linecap', 'round')
				.attr('stroke-linejoin', 'round')
				.attr('opacity', isSelected ? 1 : 0.8)
				.style('transition', 'all 0.2s');

			group.append('text')
				.attr('x', route.points2D[0][0] * baseWidth)
				.attr('y', route.points2D[0][1] * baseHeight - 10)
				.attr('font-size', '20')
				.attr('font-weight', 'bold')
				.attr('fill', isSelected ? '#3b82f6' : '#12538b')
				.attr('text-anchor', 'middle')
				.text(i + 1);
		});

		// 3. Symbols (FixPoints)
		const symbolData = topo.fixPoints || [];
		symbolData.forEach(symbol => {
			if (!symbol.position2D) return; // Skip if it only has 3D position
			
			const group = symbolsLayer.append('g')
				.attr('class', 'symbol-group')
				.attr('transform', `translate(${symbol.position2D[0] * baseWidth}, ${symbol.position2D[1] * baseHeight}) rotate(${symbol.rotation2D || 0}) scale(${symbol.scale2D || 1})`);

			group.append('image')
				.attr('width', 30)
				.attr('height', 30)
				.attr('x', -15)
				.attr('y', -15)
				.attr('href', `/icons/topo-symbols/${symbol.type}.svg`);
		});
	}

	$effect(() => {
		// Deep reactivity tracking for Svelte 5
		routes.forEach(r => {
			if (r.points2D) {
				r.points2D.forEach(p => { p[0]; p[1]; });
			}
		});
		if (topo.outlines) {
			topo.outlines.forEach(o => {
				if (o.points2D) {
					o.points2D.forEach(p => { p[0]; p[1]; });
				}
			});
		}
		if (topo.fixPoints) {
			topo.fixPoints.forEach(s => { 
				if (s.position2D) {
					s.position2D[0]; s.position2D[1]; 
					s.rotation2D; s.scale2D; 
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
	>
		<g bind:this={gElement} transform="translate({transform.x}, {transform.y}) scale({transform.k})">
		</g>
	</svg>
</div>
