<script>
	import { userState } from '$lib/state/editor.svelte.js';
	import { onMount } from 'svelte';
	import { zoom as d3Zoom } from 'd3-zoom';
	import { select } from 'd3-selection';

	let { activeTool = 'route', selectedSymbol = 'bolt' } = $props();

	let svgElement = $state(null);
	let gElement = $state(null);
	let currentRoutePoints = $state([]);
	let currentOutlinePoints = $state([]);
	let transform = $state({ x: 0, y: 0, k: 1 }); // D3 zoom transform
	let selectedSymbolInstance = $state(null);
	let draggingPoint = $state(null); // { routeId, outlineId, pointIndex }
	let draggingSymbol = $state(null); // symbolId
	let rotatingSymbol = $state(null); // { id, startAngle, startRotation }
	let scalingSymbol = $state(null); // { id, startDist, startScale }
	let baseWidth = 1000;
	let baseHeight = 667;
	let zoomBehavior = null;

	// History management
	let history = $state([]);
	let historyIndex = $state(-1);

	function saveHistory() {
		// Deep clone routes, fixPoints, and outlines to history
		const snapshot = JSON.parse(JSON.stringify({
			routes: userState.topo.routes,
			fixPoints: userState.topo.fixPoints,
			outlines: userState.topo.outlines
		}));
		
		// If we're at the end of the stack, just push
		// If we undo and then make a change, clear the redo stack
		if (historyIndex < history.length - 1) {
			history = history.slice(0, historyIndex + 1);
		}
		
		history.push(snapshot);
		// Keep history reasonably sized
		if (history.length > 50) history.shift();
		else historyIndex = history.length - 1;
	}

	function undo() {
		if (historyIndex > 0) {
			historyIndex--;
			const state = history[historyIndex];
			userState.topo.routes = JSON.parse(JSON.stringify(state.routes));
			userState.topo.fixPoints = JSON.parse(JSON.stringify(state.fixPoints));
			userState.topo.outlines = JSON.parse(JSON.stringify(state.outlines));
		}
	}

	function redo() {
		if (historyIndex < history.length - 1) {
			historyIndex++;
			const state = history[historyIndex];
			userState.topo.routes = JSON.parse(JSON.stringify(state.routes));
			userState.topo.fixPoints = JSON.parse(JSON.stringify(state.fixPoints));
			userState.topo.outlines = JSON.parse(JSON.stringify(state.outlines));
		}
	}

	// Update D3 zoom filter (Always allow wheel, allow drag panning in most tools)
	$effect(() => {
		if (zoomBehavior) {
			zoomBehavior.filter((event) => {
				if (event.type === 'wheel') return true;
				// Allow panning always now that 'pan' mode is removed
				return true;
			});
		}
	});

	// Compute viewBox from D3 transform
	let viewBox = $derived({
		x: -transform.x / transform.k,
		y: -transform.y / transform.k,
		width: baseWidth / transform.k,
		height: baseHeight / transform.k
	});

	// Initialize D3 zoom and update base dimensions
	onMount(() => {
		if (!svgElement || !gElement) return;
		
		// Set base dimensions from aspect ratio
		const rect = svgElement.getBoundingClientRect();
		const ratio = userState.topo.imageAspectRatio || (rect.width / rect.height);
		baseWidth = 1000;
		baseHeight = 1000 / ratio;
		
		// Create D3 zoom behavior
		zoomBehavior = d3Zoom()
			.scaleExtent([0.1, 10])
			.on('zoom', (event) => {
				transform = event.transform;
			});
		
		// Apply zoom to SVG
		const svg = select(svgElement);
		svg.call(zoomBehavior);
		// Initialize first history state
		saveHistory();

		return () => {
			select(svgElement).on('.zoom', null);
		};
	});

	// Update base dimensions when image aspect ratio changes
	$effect(() => {
		if (userState.topo.imageAspectRatio) {
			const ratio = userState.topo.imageAspectRatio;
			baseWidth = 1000;
			baseHeight = 1000 / ratio;
		}
	});

	function getSVGPoint(event) {
		if (!svgElement) return null;
		const pt = svgElement.createSVGPoint();
		pt.x = event.clientX;
		pt.y = event.clientY;
		const svgP = pt.matrixTransform(svgElement.getScreenCTM().inverse());
		
		// Apply inverse D3 zoom transform to get coordinates in base space
		const transformedX = (svgP.x - transform.x) / transform.k;
		const transformedY = (svgP.y - transform.y) / transform.k;
		
		// Normalize to 0-1 range
		return {
			x: transformedX / baseWidth,
			y: transformedY / baseHeight
		};
	}

	function handleSVGClick(event) {
		const point = getSVGPoint(event);
		if (!point) return;

		// 1. Handle Deselection first
		let deselectedSomething = false;

		if (selectedSymbolInstance) {
			selectedSymbolInstance = null;
			deselectedSomething = true;
		}

		if (activeTool !== 'route' && userState.topo.selectedRouteId) {
			userState.topo.selectedRouteId = null;
			deselectedSomething = true;
		}

		if (activeTool !== 'outline' && userState.topo.selectedOutlineId) {
			userState.topo.selectedOutlineId = null;
			deselectedSomething = true;
		}

		if (deselectedSomething) return;
		
		saveHistory();

		// 2. Handle Tool Actions
		if (activeTool === 'route') {
			if (userState.topo.selectedRouteId) {
				const route = userState.topo.routes.find(r => r.id === userState.topo.selectedRouteId);
				if (route) {
					route.points2D = [...(route.points2D || []), [point.x, point.y]];
				}
			} else {
				currentRoutePoints = [...currentRoutePoints, [point.x, point.y]];
			}
		} else if (activeTool === 'outline') {
			if (userState.topo.selectedOutlineId) {
				const outline = userState.topo.outlines.find(o => o.id === userState.topo.selectedOutlineId);
				if (outline) {
					outline.points2D = [...(outline.points2D || []), [point.x, point.y]];
				}
			} else {
				currentOutlinePoints = [...currentOutlinePoints, [point.x, point.y]];
			}
		} else if (activeTool === 'symbol') {
			const symbolId = crypto.randomUUID();
			userState.topo.fixPoints.push({
				id: symbolId,
				type: selectedSymbol,
				position2D: [point.x, point.y],
				rotation2D: 0,
				scale2D: 1
			});
		} else if (activeTool === 'eraser') {
			// Check if clicking on a fixpoint (symbol)
			const clickedSymbol = userState.topo.fixPoints.find(s => {
				if (!s.position2D) return false;
				const dx = Math.abs(s.position2D[0] - point.x);
				const dy = Math.abs(s.position2D[1] - point.y);
				return dx < 0.02 && dy < 0.02; // Tolerance
			});
			if (clickedSymbol) {
				userState.topo.fixPoints = userState.topo.fixPoints.filter(s => s.id !== clickedSymbol.id);
			}
		}
	}

	function handlePointMouseDown(event, { routeId, outlineId, pointIndex }) {
		const isEraser = activeTool === 'eraser';
		const isRouteTool = activeTool === 'route';
		const isOutlineTool = activeTool === 'outline';
		
		if (!isRouteTool && !isEraser && !isOutlineTool) return;
		event.stopPropagation();
		
		// Delete point on Alt+Click or if using the eraser tool
		if (event.altKey || isEraser) {
			if (routeId) {
				const route = userState.topo.routes.find(r => r.id === routeId);
				if (route && route.points2D.length > 2) {
					route.points2D = route.points2D.filter((_, i) => i !== pointIndex);
					return;
				}
			} else if (outlineId) {
				const outline = userState.topo.outlines.find(o => o.id === outlineId);
				if (outline && outline.points2D.length > 2) {
					outline.points2D = outline.points2D.filter((_, i) => i !== pointIndex);
					return;
				}
			}
		}

		if (isRouteTool || isOutlineTool) {
			draggingPoint = { routeId, outlineId, pointIndex };
		}
	}

	function handleMouseMove(event) {
		const mouse = getSVGPoint(event);
		if (!mouse) return;

		if (draggingPoint) {
			if (draggingPoint.routeId) {
				const route = userState.topo.routes.find(r => r.id === draggingPoint.routeId);
				if (route) {
					const newPoints = [...route.points2D];
					newPoints[draggingPoint.pointIndex] = [mouse.x, mouse.y];
					route.points2D = newPoints;
				}
			} else if (draggingPoint.outlineId) {
				const outline = userState.topo.outlines.find(o => o.id === draggingPoint.outlineId);
				if (outline) {
					const newPoints = [...outline.points2D];
					newPoints[draggingPoint.pointIndex] = [mouse.x, mouse.y];
					outline.points2D = newPoints;
				}
			}
		} else if (draggingSymbol) {
			const symbol = userState.topo.fixPoints.find(s => s.id === draggingSymbol);
			if (symbol) {
				symbol.position2D = [mouse.x, mouse.y];
			}
		} else if (rotatingSymbol) {
			const symbol = userState.topo.fixPoints.find(s => s.id === rotatingSymbol.id);
			if (symbol && symbol.position2D) {
				// Calculate angle between symbol center and mouse
				const dx = (mouse.x - symbol.position2D[0]) * baseWidth;
				const dy = (mouse.y - symbol.position2D[1]) * baseHeight;
				const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
				
				// Apply rotation offset (handle is at top, so add 90)
				symbol.rotation2D = (currentAngle + 90) % 360;
			}
		} else if (scalingSymbol) {
			const symbol = userState.topo.fixPoints.find(s => s.id === scalingSymbol.id);
			if (symbol && symbol.position2D) {
				const dx = (mouse.x - symbol.position2D[0]) * baseWidth;
				const dy = (mouse.y - symbol.position2D[1]) * baseHeight;
				const currentDist = Math.sqrt(dx*dx + dy*dy);
				
				// Use ratio of current distance to initial distance for scaling
				const scaleFactor = currentDist / scalingSymbol.startDist;
				symbol.scale2D = Math.max(0.2, Math.min(5, (scalingSymbol.startScale || 1) * scaleFactor));
			}
		}
	}

	function handleMouseUp() {
		if (draggingPoint || draggingSymbol || rotatingSymbol || scalingSymbol) {
			saveHistory();
		}
		draggingPoint = null;
		draggingSymbol = null;
		rotatingSymbol = null;
		scalingSymbol = null;
	}

	function handleSymbolMouseDown(event, symbol) {
		const isSymbolTool = activeTool === 'symbol';
		if (!isSymbolTool) return;
		
		event.stopPropagation();
		draggingSymbol = symbol.id;
		handleSymbolClick(symbol); // Also select it
	}

	function handleRotateGizmoMouseDown(event, symbol) {
		event.stopPropagation();
		rotatingSymbol = { id: symbol.id };
	}

	function handleScaleGizmoMouseDown(event, symbol) {
		event.stopPropagation();
		const mouse = getSVGPoint(event);
		if (!mouse) return;
		
		const dx = (mouse.x - symbol.position2D[0]) * baseWidth;
		const dy = (mouse.y - symbol.position2D[1]) * baseHeight;
		const startDist = Math.sqrt(dx*dx + dy*dy);
		
		scalingSymbol = { 
			id: symbol.id, 
			startDist,
			startScale: symbol.rotation2D || 1 
		};
	}

	function handleRouteClick(event, routeId) {
		event.stopPropagation();
		if (currentRoutePoints.length > 0) cancelRoute();
		if (currentOutlinePoints.length > 0) cancelOutline();
		userState.topo.selectedRouteId = routeId;
	}

	function handleOutlineClick(event, outlineId) {
		event.stopPropagation();
		if (currentRoutePoints.length > 0) cancelRoute();
		if (currentOutlinePoints.length > 0) cancelOutline();
		userState.topo.selectedOutlineId = outlineId;
	}

	// D3 zoom handles all pan/zoom - no custom handlers needed

	function finalizeRoute() {
		if (currentRoutePoints.length < 2) {
			console.log('Route needs at least 2 points');
			return;
		}

		const routeId = crypto.randomUUID();
		userState.topo.routes.push({
			id: routeId,
			points2D: currentRoutePoints,
			points: [], // Empty 3D points
			tags: [],
			name: `Route ${routeId}`,
			grade: '5a',
			type: 'sports-climbing'
		});

		currentRoutePoints = [];
		saveHistory();
	}

	function finalizeOutline() {
		if (currentOutlinePoints.length < 2) {
			console.log('Outline needs at least 2 points');
			return;
		}

		const outlineId = crypto.randomUUID();
		userState.topo.outlines.push({
			id: outlineId,
			points2D: currentOutlinePoints
		});

		currentOutlinePoints = [];
		saveHistory();
	}

	function cancelRoute() {
		currentRoutePoints = [];
	}

	function cancelOutline() {
		currentOutlinePoints = [];
	}

	function handleKeyDown(event) {
		if (event.key === 'n' || event.key === 'N') {
			if (activeTool === 'route') finalizeRoute();
			else if (activeTool === 'outline') finalizeOutline();
		} else if (event.key === 'Escape') {
			if (selectedSymbolInstance) {
				selectedSymbolInstance = null;
			} else if (userState.topo.selectedRouteId) {
				userState.topo.selectedRouteId = null;
			} else if (userState.topo.selectedOutlineId) {
				userState.topo.selectedOutlineId = null;
			} else {
				cancelRoute();
				cancelOutline();
			}
		} else if (event.key === 'Delete' || event.key === 'Del') {
			let deleted = false;
			if (selectedSymbolInstance) {
				userState.topo.fixPoints = userState.topo.fixPoints.filter(s => s.id !== selectedSymbolInstance.id);
				selectedSymbolInstance = null;
				deleted = true;
			} else if (userState.topo.selectedRouteId) {
				userState.topo.routes = userState.topo.routes.filter(r => r.id !== userState.topo.selectedRouteId);
				userState.topo.selectedRouteId = null;
				deleted = true;
			} else if (userState.topo.selectedOutlineId) {
				userState.topo.outlines = userState.topo.outlines.filter(o => o.id !== userState.topo.selectedOutlineId);
				userState.topo.selectedOutlineId = null;
				deleted = true;
			}
			if (deleted) saveHistory();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
			event.preventDefault();
			undo();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
			event.preventDefault();
			redo();
		}
	}

	function handleSymbolClick(symbol) {
		selectedSymbolInstance = symbol;
	}

	function updateSymbolRotation(delta) {
		if (!selectedSymbolInstance) return;
		const symbol = userState.topo.fixPoints.find(s => s.id === selectedSymbolInstance.id);
		if (symbol) {
			symbol.rotation2D = ((symbol.rotation2D || 0) + delta) % 360;
		}
	}

	function updateSymbolScale(delta) {
		if (!selectedSymbolInstance) return;
		const symbol = userState.topo.fixPoints.find(s => s.id === selectedSymbolInstance.id);
		if (symbol) {
			symbol.scale2D = Math.max(0.2, Math.min(5, (symbol.scale2D || 1) + delta));
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	// Get routes that have 2D points
	let routes2D = $derived(userState.topo.routes.filter(r => r.points2D && r.points2D.length > 0));

	// D3 Render groups (Managed imperatively)

	function updateD3Rendering() {
		if (!svgElement || !gElement) return;

		const svg = select(svgElement);
		const mainG = select(gElement);

		// NUCLEAR OPTION: Completely wipe all children of the transform group.
		// This guarantees that no stale elements (ghosts) can persist.
		mainG.selectAll('*').remove();

		// Create layer groups dynamically
		const bgLayer = mainG.append('g').attr('class', 'background-layer');
		const outlinesLayer = mainG.append('g').attr('class', 'outlines-layer');
		const routesLayer = mainG.append('g').attr('class', 'routes-layer');
		const currentLayer = mainG.append('g').attr('class', 'current-layer');
		const handlesLayer = mainG.append('g').attr('class', 'handles-layer');
		const symbolsLayer = mainG.append('g').attr('class', 'symbols-layer');

		// 1. Background Rendering
		if (userState.topo.image2D) {
			bgLayer.append('image')
				.attr('class', 'bg-image')
				.attr('href', userState.topo.image2D)
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('preserveAspectRatio', 'none');
		} else {
			bgLayer.append('rect')
				.attr('class', 'blank-bg')
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('fill', '#f9fafb');

			const defs = svg.select('defs');
			if (defs.empty()) svg.append('defs');
			if (svg.select('#grid-pattern').empty()) {
				svg.select('defs').append('pattern')
					.attr('id', 'grid-pattern')
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
				.attr('class', 'grid-bg')
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('fill', 'url(#grid-pattern)');
		}

		// 1.5 Rock Outlines Rendering
		userState.topo.outlines.forEach(outline => {
			const isSelected = userState.topo.selectedOutlineId === outline.id;
			const pointsStr = outline.points2D.map(p => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ');

			outlinesLayer.append('polyline')
				.attr('points', pointsStr)
				.attr('fill', 'none')
				.attr('stroke', isSelected ? '#b45309' : '#d97706') // Amber-700 / Amber-600
				.attr('stroke-width', isSelected ? 4 : 3)
				.attr('stroke-dasharray', '5,5')
				.attr('class', 'cursor-pointer rock-outline')
				.style('pointer-events', activeTool === 'route' || activeTool === 'symbol' ? 'none' : 'auto')
				.on('click', (e) => handleOutlineClick(e, outline.id));

			// Handles for selected outline
			if (isSelected && (activeTool === 'outline' || activeTool === 'eraser')) {
				outline.points2D.forEach((p, i) => {
					handlesLayer.append('circle')
						.attr('cx', p[0] * baseWidth)
						.attr('cy', p[1] * baseHeight)
						.attr('r', activeTool === 'eraser' ? 10 : 6)
						.attr('fill', activeTool === 'eraser' ? '#fee2e2' : '#b45309')
						.attr('stroke', activeTool === 'eraser' ? '#ef4444' : 'none')
						.attr('stroke-width', 2)
						.attr('class', 'cursor-move')
						.on('mousedown', (e) => handlePointMouseDown(e, { outlineId: outline.id, pointIndex: i }));
				});
			}
		});

		// 2. Routes Rendering
		routes2D.forEach((route, i) => {
			const group = routesLayer.append('g').attr('class', 'route-group');
			const pointsStr = route.points2D.map(p => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ');

			group.append('polyline')
				.attr('class', 'hit-area cursor-pointer')
				.attr('points', pointsStr)
				.attr('fill', 'none')
				.attr('stroke', 'transparent')
				.attr('stroke-width', 20)
				.on('mousedown', (e) => e.stopPropagation()) // Prevent pan start
				.on('click', (e) => handleRouteClick(e, route.id));

			group.append('polyline')
				.attr('class', 'main-path cursor-pointer')
				.attr('points', pointsStr)
				.attr('fill', 'none')
				.attr('stroke', userState.topo.selectedRouteId === route.id ? '#3b82f6' : '#12538b')
				.attr('stroke-width', userState.topo.selectedRouteId === route.id ? 5 : 3)
				.attr('stroke-linecap', 'round')
				.attr('stroke-linejoin', 'round')
				.on('mousedown', (e) => e.stopPropagation()) // Prevent pan start
				.on('click', (e) => handleRouteClick(e, route.id));

			group.append('text')
				.attr('class', 'route-label pointer-events-none')
				.attr('x', route.points2D[0][0] * baseWidth)
				.attr('y', route.points2D[0][1] * baseHeight - 10)
				.attr('font-size', '20')
				.attr('font-weight', 'bold')
				.attr('fill', userState.topo.selectedRouteId === route.id ? '#3b82f6' : '#12538b')
				.attr('text-anchor', 'middle')
				.text(i + 1);
		});

		// 3. Current Drawing Rendering
		if (currentRoutePoints.length > 0) {
			currentLayer.append('polyline')
				.attr('class', 'current-path')
				.attr('points', currentRoutePoints.map(p => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' '))
				.attr('fill', 'none')
				.attr('stroke', '#ff00ff')
				.attr('stroke-width', 3)
				.attr('stroke-linecap', 'round')
				.attr('stroke-linejoin', 'round');

			currentRoutePoints.forEach(p => {
				currentLayer.append('circle')
					.attr('class', 'current-point')
					.attr('cx', p[0] * baseWidth)
					.attr('cy', p[1] * baseHeight)
					.attr('r', 5)
					.attr('fill', '#ff00ff');
			});
		}

		if (currentOutlinePoints.length > 0) {
			const pointsStr = currentOutlinePoints.map(p => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ');
			currentLayer.append('polyline')
				.attr('class', 'current-outline')
				.attr('points', pointsStr)
				.attr('fill', 'none')
				.attr('stroke', '#f59e0b') // Amber-500
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', '4,2');

			currentOutlinePoints.forEach(p => {
				currentLayer.append('circle')
					.attr('cx', p[0] * baseWidth)
					.attr('cy', p[1] * baseHeight)
					.attr('r', 3)
					.attr('fill', '#f59e0b');
			});
		}

		// 4. Handles Rendering (Selected Route)
		const selectedRoute = userState.topo.selectedRouteId ? routes2D.find(r => r.id === userState.topo.selectedRouteId) : null;
		if (selectedRoute && (activeTool === 'route' || activeTool === 'eraser')) {
			selectedRoute.points2D.forEach((p, index) => {
				handlesLayer.append('circle')
					.attr('class', `handle ${activeTool === 'route' ? 'cursor-move' : 'cursor-pointer'}`)
					.attr('cx', p[0] * baseWidth)
					.attr('cy', p[1] * baseHeight)
					.attr('r', activeTool === 'eraser' ? 10 : 8) // Slightly larger target for eraser
					.attr('fill', activeTool === 'eraser' ? '#fee2e2' : 'white')
					.attr('stroke', activeTool === 'eraser' ? '#ef4444' : '#3b82f6')
					.attr('stroke-width', 2)
					.on('mousedown', (e) => handlePointMouseDown(e, { routeId: selectedRoute.id, pointIndex: index }));
			});
		}

		// 5. Symbols (FixPoints) Rendering
		userState.topo.fixPoints.forEach(symbol => {
			if (!symbol.position2D) return; // Skip if it only has 3D position
			
			const isSelected = selectedSymbolInstance?.id === symbol.id;
			const group = symbolsLayer.append('g')
				.attr('class', 'symbol-group cursor-pointer')
				.attr('transform', `translate(${symbol.position2D[0] * baseWidth}, ${symbol.position2D[1] * baseHeight}) rotate(${symbol.rotation2D || 0}) scale(${symbol.scale2D || 1})`)
				.attr('opacity', isSelected ? 0.9 : 1)
				.style('pointer-events', activeTool === 'route' || activeTool === 'eraser' ? 'none' : 'auto')
				.on('mousedown', (e) => handleSymbolMouseDown(e, symbol))
				.on('click', (e) => {
					e.stopPropagation();
					handleSymbolClick(symbol);
				});

			group.append('image')
				.attr('width', 30)
				.attr('height', 30)
				.attr('x', -15)
				.attr('y', -15)
				.attr('href', `/icons/topo-symbols/${symbol.type}.svg`);

			if (isSelected && activeTool === 'symbol') {
				// Bounding Box
				group.append('rect')
					.attr('x', -20)
					.attr('y', -20)
					.attr('width', 40)
					.attr('height', 40)
					.attr('fill', 'none')
					.attr('stroke', '#3b82f6')
					.attr('stroke-width', 1)
					.attr('stroke-dasharray', '2,2');

				// Rotation Stalk
				group.append('line')
					.attr('x1', 0)
					.attr('y1', -20)
					.attr('x2', 0)
					.attr('y2', -40)
					.attr('stroke', '#3b82f6')
					.attr('stroke-width', 1);

				// Rotation Handle
				group.append('circle')
					.attr('cx', 0)
					.attr('cy', -40)
					.attr('r', 6)
					.attr('fill', '#3b82f6')
					.attr('class', 'cursor-pointer')
					.on('mousedown', (e) => handleRotateGizmoMouseDown(e, symbol));

				// Scaling Handle (Bottom Right)
				group.append('rect')
					.attr('x', 14)
					.attr('y', 14)
					.attr('width', 12)
					.attr('height', 12)
					.attr('fill', '#3b82f6')
					.attr('class', 'cursor-nwse-resize')
					.on('mousedown', (e) => handleScaleGizmoMouseDown(e, symbol));
			}

			group.append('circle')
				.attr('class', 'selection-circle')
				.attr('cx', 0)
				.attr('cy', 0)
				.attr('r', 20)
				.attr('fill', 'none')
				.attr('stroke', '#3b82f6')
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', '4')
				.style('display', isSelected ? 'block' : 'none');
		});
	}

	// Trigger D3 render on state changes
	$effect(() => {
		// Explicitly track deep reactive dependencies for D3 rendering
		// Svelte 5 needs to see these accessed synchronously to track them
		for (const r of userState.topo.routes) {
			if (r.points2D) {
				for (const p of r.points2D) {
					p[0]; p[1];
				}
			}
		}
		for (const o of userState.topo.outlines) {
			for (const p of o.points2D) {
				p[0]; p[1];
			}
		}
		for (const s of userState.topo.fixPoints) {
			if (s.position2D) {
				s.position2D[0]; s.position2D[1]; 
				s.rotation2D; s.scale2D;
			}
		}
		for (const p of currentRoutePoints) {
			p[0]; p[1];
		}
		for (const p of currentOutlinePoints) {
			p[0]; p[1];
		}
		
		// Map these as dependencies too
		const _deps = {
			active: activeTool,
			selected: userState.topo.selectedRouteId,
			transform: transform,
			base: { baseWidth, baseHeight }
		};

		updateD3Rendering();
	});
</script>

<div class="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
	<svg
		bind:this={svgElement}
		viewBox="0 0 {baseWidth} {baseHeight}"
		class="w-full h-full cursor-{activeTool === 'eraser' ? 'crosshair' : 'crosshair'}"
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
	>
		<g bind:this={gElement} transform="translate({transform.x},{transform.y}) scale({transform.k})" onclick={handleSVGClick}>
		</g>
	</svg>

	<!-- History UI -->
	<div class="absolute top-4 right-4 flex gap-2">
		<button 
			class="w-10 h-10 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
			onclick={undo}
			disabled={historyIndex <= 0}
			title="Rückgängig (Strg+Z)"
		>
			<i class="fa-solid fa-rotate-left"></i>
		</button>
		<button 
			class="w-10 h-10 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
			onclick={redo}
			disabled={historyIndex >= history.length - 1}
			title="Wiederholen (Strg+Y)"
		>
			<i class="fa-solid fa-rotate-right"></i>
		</button>
	</div>
</div>
