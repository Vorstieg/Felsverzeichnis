<script>
	import { userState } from '$lib/state/editor.svelte.js';
	import { onMount } from 'svelte';
	import { zoom as d3Zoom } from 'd3-zoom';
	import { select } from 'd3-selection';
	import { RouteTool } from './tools/RouteTool.svelte.js';
	import { SymbolTool } from './tools/SymbolTool.svelte.js';
	import { EraserTool } from './tools/EraserTool.svelte.js';
	import { OutlineTool } from './tools/OutlineTool.svelte.js';
	import { SelectTool } from './tools/SelectTool.svelte.js';
	import {
		isTouchDevice,
		getTouchTargetSize,
		getHitAreaSize,
		getTouchPoint,
		createLongPressDetector,
		vibrateOnAction
	} from '$lib/assets/js/mobile-utils.js';

	let { activeTool = $bindable(null), selectedSymbol = 'bolt', drawingTarget = null } = $props();

	let svgElement = $state(null);
	let gElement = $state(null);

	// Pass saveHistory callback to all tools
	const toolConfig = { saveHistory };
	const tools = {
		route: new RouteTool(toolConfig),
		multipitch: null,
		symbol: new SymbolTool(toolConfig),
		eraser: new EraserTool(toolConfig),
		outline: new OutlineTool(toolConfig),
		select: new SelectTool(toolConfig)
	};
	// Share the same instance for route and multipitch as they share logic in RouteTool
	tools.multipitch = tools.route;

	// Track previous tool for lifecycle
	let previousTool = $state(null);

	let currentTool = $derived(tools[activeTool] || tools.select);

	// Synchronize drawingTarget to the tool
	$effect(() => {
		if (currentTool instanceof RouteTool) {
			currentTool.drawingTarget = drawingTarget;
		}
	});

	// Sync selectedSymbol to SymbolTool
	$effect(() => {
		if (tools.symbol) {
			tools.symbol.selectedType = selectedSymbol;
		}
	});

	// Tool lifecycle management
	$effect(() => {
		if (previousTool && previousTool !== currentTool) {
			previousTool.onDeactivate?.();
		}

		// If we are activating a drawing tool, clear any existing selection
		if (
			currentTool instanceof RouteTool ||
			currentTool instanceof OutlineTool ||
			currentTool instanceof SymbolTool
		) {
			userState.ui.selectedFixpointId = null;
			userState.ui.selectedRouteId = null;
			userState.ui.selectedOutlineId = null;
			selectedSymbolInstance = null;
			selectedItems.clear();
		}

		currentTool.onActivate?.();
		previousTool = currentTool;
	});

	// Derived state for rendering
	let currentRoutePoints = $derived(
		currentTool instanceof RouteTool ? currentTool.currentPoints : []
	);
	let currentOutlinePoints = $derived(
		currentTool instanceof OutlineTool ? currentTool.currentPoints : []
	);
	// Symbol tool manages symbol creation directly into userState, so no "currentSymbolPoints" needed for preview distinct from cursor?
	// RouteTool creates points as you click.

	let transform = $state({ x: 0, y: 0, k: 1 }); // D3 zoom transform
	let selectedSymbolInstance = $state(null);
	let draggingPoint = $state(null); // { routeId, outlineId, pointIndex }
	let rotatingSymbol = $state(null); // { id, startAngle, startRotation }
	let scalingSymbol = $state(null); // { id, startDist, startScale }
	let draggingLabel = $state(null); // { routeId, pitchId }
	let draggingSelection = $state(null); // { items: { routes: [], outlines: [], symbols: [] }, startMouse }
	let baseWidth = $state(1000);
	let baseHeight = $state(667);
	let zoomBehavior = null;

	// Touch interaction state
	let activeTouch = $state(null); // Track active touch ID
	// Disabled long-press auto-finish - was triggering too easily when drawing slowly
	let longPressDetector = createLongPressDetector(() => {
		// No-op: User should explicitly tap finish button
	}, 5000); // Very long timeout so it never triggers during normal use

	// Multi-select state
	// Unified selection state: Set of "type:id" strings
	let selectedItems = $state(new Set());
	let isShiftPressed = $state(false);

	// History management
	let history = $state([]);
	let historyIndex = $state(-1);

	function saveHistory() {
		// Deep clone routes, fixPoints, and outlines to history
		const snapshot = JSON.parse(
			JSON.stringify({
				routes: userState.topo.routes,
				fixPoints: userState.topo.fixPoints,
				outlines: userState.topo.outlines
			})
		);

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
		const ratio = userState.topo.imageAspectRatio || rect.width / rect.height;
		baseWidth = 1000;
		baseHeight = 1000 / ratio;

		// Create D3 zoom behavior with smooth mobile pinch support
		zoomBehavior = d3Zoom()
			.scaleExtent([0.1, 5])
			.translateExtent([
				[-baseWidth * 0.5, -baseHeight * 0.5],
				[baseWidth * 1.5, baseHeight * 1.5]
			])
			.extent([
				[0, 0],
				[baseWidth, baseHeight]
			])
			.wheelDelta((event) => {
				// Smoother wheel zoom with better sensitivity
				return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
			})
			.interpolate(() => (t) => t) // No interpolation - follow fingers immediately
			.duration(0) // No transition delay - respond instantly to touch
			.constrain((transform, extent, translateExtent) => {
				// Allow smooth continuous zoom without stepping
				return transform;
			})
			.filter((event) => {
				// Always allow mouse wheel zoom (desktop)
				if (event.type === 'wheel') return true;

				// TOUCH EVENTS (Mobile):
				// - 2+ fingers: Enable d3-zoom for pinch-to-zoom and two-finger panning
				// - 1 finger: Return false to let our drawing handlers work
				if (
					event.type === 'touchstart' ||
					event.type === 'touchmove' ||
					event.type === 'touchend'
				) {
					return event.touches && event.touches.length >= 2;
				}

				// MOUSE EVENTS (Desktop):
				// - Left button drag: Enable panning (d3-zoom handles it)
				// - Drawing is done via SVG click handler, which doesn't conflict with drag
				if (event.type === 'mousedown') {
					// Only allow d3-zoom panning if NO tool is active
					// OR if it's not the left button (e.g. middle/right button panning)
					if (activeTool !== null && event.button === 0) return false;
					return event.button === 0; // Allow left mouse button for panning when no tool active
				}

				return false;
			})
			.touchable(() => true) // Enable touch events
			.on('zoom', (event) => {
				transform = event.transform;
				// Apply transform directly to the g element via D3
				// Convert transform object to SVG transform string
				select(gElement).attr(
					'transform',
					`translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`
				);
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

	// Touch event helpers
	function handleTouchStart(event) {
		if (event.touches.length === 1) {
			// Single touch - treat as mouse down
			const touch = event.touches[0];
			activeTouch = touch.identifier;

			// Start long press detection
			longPressDetector.start(event);

			const point = getTouchPoint(event, svgElement, transform, baseWidth, baseHeight);
			if (point) {
				// Simulate mouse event for tool
				const mouseEvent = {
					clientX: touch.clientX,
					clientY: touch.clientY,
					stopPropagation: () => event.stopPropagation(),
					preventDefault: () => event.preventDefault(),
					altKey: false,
					shiftKey: false
				};
				currentTool.onMouseDown(mouseEvent, point);
				vibrateOnAction('selection');
			}
		} else if (event.touches.length >= 2) {
			// Multi-touch: prevent default browser zoom/scroll
			event.preventDefault();
			// d3-zoom will handle this for pinch-to-zoom
		}
		// Two+ fingers are handled by D3 zoom for pan/pinch
	}

	function handleTouchMove(event) {
		// Prevent default browser behavior for multi-touch (zooming the whole page)
		if (event.touches.length >= 2) {
			event.preventDefault();
			// d3-zoom handles multi-touch pan/zoom
			return;
		}

		// Single touch movement
		longPressDetector.cancel();

		if (event.touches.length === 1 && activeTouch !== null) {
			const touch = Array.from(event.touches).find((t) => t.identifier === activeTouch);
			if (!touch) return;

			const mouseEvent = {
				clientX: touch.clientX,
				clientY: touch.clientY,
				stopPropagation: () => event.stopPropagation(),
				preventDefault: () => event.preventDefault()
			};
			handleMouseMove(mouseEvent);
		}
	}

	function handleTouchEnd(event) {
		longPressDetector.cancel();

		if (activeTouch !== null) {
			// Find if our tracked touch ended
			const touchStillActive = Array.from(event.touches).some((t) => t.identifier === activeTouch);
			if (!touchStillActive) {
				// Simulate mouse up
				const changedTouch = Array.from(event.changedTouches).find(
					(t) => t.identifier === activeTouch
				);
				if (changedTouch) {
					const point = getTouchPoint(
						{ touches: [changedTouch] },
						svgElement,
						transform,
						baseWidth,
						baseHeight
					);
					if (point) {
						const mouseEvent = {
							clientX: changedTouch.clientX,
							clientY: changedTouch.clientY,
							stopPropagation: () => event.stopPropagation(),
							preventDefault: () => event.preventDefault()
						};
						handleMouseUp(mouseEvent);
					}
				}
				activeTouch = null;
			}
		}
	}

	function handleSVGMouseDown(event) {
		// Only handle left click for drawing/selection
		if (event.button !== 0 && !event.touches) return;

		const point = getSVGPoint(event);
		if (!point) return;

		// If in selection mode, clicking empty space clears selection (unless Shift is pressed)
		if (activeTool === null && !isShiftPressed) {
			clearSelection();
		}

		// Delegate to tool - this handles placing points, etc.
		currentTool.onMouseDown(event, point);
	}

	// Forward dragging events if tools support it (optional future step)
	function handlePointMouseDown(event, { routeId, pitchId, outlineId, pointIndex }) {
		// Only allow point manipulation in selection mode (null tool) or eraser mode
		if (activeTool !== null && activeTool !== 'eraser') return;

		event.stopPropagation();

		// Delete point on Alt+Click or if using the eraser tool
		if (event.altKey || activeTool === 'eraser') {
			if (routeId) {
				const route = userState.topo.routes.find((r) => r.id === routeId);
				if (route) {
					if (pitchId && route.pitches) {
						const pitch = route.pitches.find((p) => p.id === pitchId);
						if (pitch && pitch.points2D.length > 2) {
							pitch.points2D = pitch.points2D.filter((_, i) => i !== pointIndex);
							return;
						}
					} else if (route.points2D.length > 2) {
						route.points2D = route.points2D.filter((_, i) => i !== pointIndex);
						return;
					}
				}
			} else if (outlineId) {
				const outline = userState.topo.outlines.find((o) => o.id === outlineId);
				if (outline && outline.points2D.length > 2) {
					outline.points2D = outline.points2D.filter((_, i) => i !== pointIndex);
					return;
				}
			}
		}

		// Set dragging state
		draggingPoint = { routeId, pitchId, outlineId, pointIndex };
	}

	function handleMidpointClick(event, { routeId, pitchId, outlineId, insertIndex, point }) {
		event.stopPropagation();
		if (routeId) {
			const route = userState.topo.routes.find((r) => r.id === routeId);
			if (route) {
				if (pitchId && route.pitches) {
					const pitch = route.pitches.find((p) => p.id === pitchId);
					if (pitch) {
						const newPoints = [...pitch.points2D];
						newPoints.splice(insertIndex, 0, [point.x, point.y]);
						pitch.points2D = newPoints;
					}
				} else if (route.points2D) {
					const newPoints = [...route.points2D];
					newPoints.splice(insertIndex, 0, [point.x, point.y]);
					route.points2D = newPoints;
				}
			}
		} else if (outlineId) {
			const outline = userState.topo.outlines.find((o) => o.id === outlineId);
			if (outline) {
				const newPoints = [...outline.points2D];
				newPoints.splice(insertIndex, 0, [point.x, point.y]);
				outline.points2D = newPoints;
			}
		}
		saveHistory();
	}

	function handleMouseMove(event) {
		const mouse = getSVGPoint(event);
		if (!mouse) return;

		// Delegate to tool for generic mouse move (e.g. hover effects)
		currentTool.onMouseMove(event, mouse);

		if (draggingSelection) {
			const deltaX = mouse.x - draggingSelection.startMouse.x;
			const deltaY = mouse.y - draggingSelection.startMouse.y;

			// Move routes
			draggingSelection.items.routes.forEach(({ routeId, pitchId, startPoints }) => {
				const route = userState.topo.routes.find((r) => r.id === routeId);
				if (route) {
					if (pitchId && route.pitches) {
						const pitch = route.pitches.find((p) => p.id === pitchId);
						if (pitch && pitch.points2D) {
							pitch.points2D = startPoints.map((p) => [p[0] + deltaX, p[1] + deltaY]);
						}
					} else if (route.points2D) {
						route.points2D = startPoints.map((p) => [p[0] + deltaX, p[1] + deltaY]);
					}
				}
			});

			// Move outlines
			draggingSelection.items.outlines.forEach(({ outlineId, startPoints }) => {
				const outline = userState.topo.outlines.find((o) => o.id === outlineId);
				if (outline && outline.points2D) {
					outline.points2D = startPoints.map((p) => [p[0] + deltaX, p[1] + deltaY]);
				}
			});

			// Move symbols
			draggingSelection.items.symbols.forEach(({ symbolId, startPos }) => {
				const symbol = userState.topo.fixPoints.find((s) => s.id === symbolId);
				if (symbol) {
					symbol.position2D = [startPos[0] + deltaX, startPos[1] + deltaY];
				}
			});
		} else if (draggingPoint) {
			if (draggingPoint.routeId) {
				const route = userState.topo.routes.find((r) => r.id === draggingPoint.routeId);
				if (route) {
					if (draggingPoint.pitchId && route.pitches) {
						const pitch = route.pitches.find((p) => p.id === draggingPoint.pitchId);
						if (pitch) {
							const newPoints = [...pitch.points2D];
							newPoints[draggingPoint.pointIndex] = [mouse.x, mouse.y];
							pitch.points2D = newPoints;
						}
					} else if (route.points2D) {
						const newPoints = [...route.points2D];
						newPoints[draggingPoint.pointIndex] = [mouse.x, mouse.y];
						route.points2D = newPoints;
					}
				}
			} else if (draggingPoint.outlineId) {
				const outline = userState.topo.outlines.find((o) => o.id === draggingPoint.outlineId);
				if (outline) {
					const newPoints = [...outline.points2D];
					newPoints[draggingPoint.pointIndex] = [mouse.x, mouse.y];
					outline.points2D = newPoints;
				}
			}
		} else if (rotatingSymbol) {
			const symbol = userState.topo.fixPoints.find((s) => s.id === rotatingSymbol.id);
			if (symbol && symbol.position2D) {
				const dx = (mouse.x - symbol.position2D[0]) * baseWidth;
				const dy = (mouse.y - symbol.position2D[1]) * baseHeight;
				const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
				symbol.rotation2D = (currentAngle + 90) % 360;
			}
		} else if (scalingSymbol) {
			const symbol = userState.topo.fixPoints.find((s) => s.id === scalingSymbol.id);
			if (symbol && symbol.position2D) {
				const dx = (mouse.x - symbol.position2D[0]) * baseWidth;
				const dy = (mouse.y - symbol.position2D[1]) * baseHeight;
				const currentDist = Math.sqrt(dx * dx + dy * dy);
				const scaleFactor = currentDist / scalingSymbol.startDist;
				symbol.scale2D = Math.max(0.2, Math.min(5, (scalingSymbol.startScale || 1) * scaleFactor));
			}
		} else if (draggingLabel) {
			const route = userState.topo.routes.find((r) => r.id === draggingLabel.routeId);
			if (route) {
				const target = draggingLabel.pitchId
					? route.pitches.find((p) => p.id === draggingLabel.pitchId)
					: route;
				if (target && target.points2D?.length > 0) {
					const basePoint = target.points2D[0];
					if (!target.labelOffset2D) target.labelOffset2D = [0, 0.05];
					target.labelOffset2D = [mouse.x - basePoint[0], mouse.y - basePoint[1]];
				}
			}
		}
	}

	function handleMouseUp(event) {
		const point = getSVGPoint(event);
		if (point) currentTool.onMouseUp(event, point);

		if (draggingPoint || rotatingSymbol || scalingSymbol || draggingLabel || draggingSelection) {
			saveHistory();
		}
		draggingPoint = null;
		rotatingSymbol = null;
		scalingSymbol = null;

		draggingLabel = null;
		draggingSelection = null;
	}

	function isSelected(type, id) {
		return selectedItems.has(`${type}:${id}`);
	}

	function selectObject(type, id, multi = false) {
		if (!multi) {
			selectedItems.clear();
			userState.ui.selectedRouteId = null;
			userState.ui.selectedFixpointId = null;
			userState.ui.selectedOutlineId = null;
			selectedSymbolInstance = null;
		}

		const itemKey = `${type}:${id}`;
		if (multi && selectedItems.has(itemKey)) {
			selectedItems.delete(itemKey);
		} else {
			selectedItems.add(itemKey);
			if (type === 'route') {
				userState.ui.selectedRouteId = id;
			} else if (type === 'symbol') {
				userState.ui.selectedFixpointId = id;
				selectedSymbolInstance = userState.topo.fixPoints.find((s) => s.id === id);
			} else if (type === 'outline') {
				userState.ui.selectedOutlineId = id;
			}
		}
	}

	function handleObjectMouseDown(event, { type, id, pitchId = null }) {
		if (activeTool !== null) return;
		event.stopPropagation();
		const mouse = getSVGPoint(event);
		if (!mouse) return;

		if (!isSelected(type, id)) {
			selectObject(type, id, isShiftPressed);
		}

		draggingSelection = collectDraggingSelection(mouse);
	}

	function clearSelection() {
		userState.ui.selectedFixpointId = null;
		userState.ui.selectedRouteId = null;
		userState.ui.selectedOutlineId = null;
		selectedSymbolInstance = null;
		selectedItems.clear();
	}

	function handleObjectClick(event, type, id) {
		if (event) event.stopPropagation();
		if (activeTool !== null) return;
		if (currentRoutePoints.length > 0 || currentOutlinePoints.length > 0) return;
		selectObject(type, id, isShiftPressed);
	}

	function collectDraggingSelection(mouse) {
		const routes = [];
		const outlines = [];
		const symbols = [];

		selectedItems.forEach((itemKey) => {
			const [type, id] = itemKey.split(':');

			if (type === 'route') {
				const r = userState.topo.routes.find((rt) => rt.id === id);
				if (r && r.points2D) {
					routes.push({
						routeId: r.id,
						pitchId: null,
						startPoints: JSON.parse(JSON.stringify(r.points2D))
					});
					// Also collect pitches if any
					if (r.pitches) {
						r.pitches.forEach((p) => {
							if (p.points2D) {
								routes.push({
									routeId: r.id,
									pitchId: p.id,
									startPoints: JSON.parse(JSON.stringify(p.points2D))
								});
							}
						});
					}
				}
			} else if (type === 'outline') {
				const o = userState.topo.outlines.find((outline) => outline.id === id);
				if (o && o.points2D) {
					outlines.push({
						outlineId: o.id,
						startPoints: JSON.parse(JSON.stringify(o.points2D))
					});
				}
			} else if (type === 'symbol') {
				const s = userState.topo.fixPoints.find((fp) => fp.id === id);
				if (s && s.position2D) {
					symbols.push({
						symbolId: s.id,
						startPos: [...s.position2D]
					});
				}
			}
		});

		return {
			items: { routes, outlines, symbols },
			startMouse: mouse
		};
	}

	function handleLabelMouseDown(event, { routeId, pitchId }) {
		event.stopPropagation();
		draggingLabel = { routeId, pitchId };
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
		const startDist = Math.sqrt(dx * dx + dy * dy);

		scalingSymbol = {
			id: symbol.id,
			startDist,
			startScale: symbol.scale2D || 1
		};
	}

	// D3 zoom handles all pan/zoom - no custom handlers needed

	// Finalize/Cancel functions delegated to Tools (removed local versions)

	export function finalize() {
		if (currentTool && typeof currentTool.finalize === 'function') {
			currentTool.finalize();
		} else {
			currentTool.onKeyDown?.({ key: 'n' });
		}
	}

	export function cancel() {
		if (currentTool && typeof currentTool.cancel === 'function') {
			currentTool.cancel();
		} else {
			currentTool.onKeyDown?.({ key: 'Escape' });
		}
	}

	function handleKeyDown(event) {
		// Track shift key for multi-select
		if (event.key === 'Shift') {
			isShiftPressed = true;
		}

		// Global delete handler
		if (event.key === 'Escape') {
			// Priority 1: If drawing, cancel the drawing
			if (currentRoutePoints.length > 0 || currentOutlinePoints.length > 0) {
				currentTool.cancel?.();
				return;
			}

			// Priority 2: If a tool is active, deselect it
			if (activeTool !== null) {
				activeTool = null;
				return;
			}

			// Priority 3: Clear all selections
			clearSelection();
		}

		if (event.key === 'Delete' || event.key === 'Backspace') {
			if (selectedItems.size > 0) {
				const idsByType = { route: [], symbol: [], outline: [] };
				selectedItems.forEach((itemKey) => {
					const [type, id] = itemKey.split(':');
					idsByType[type].push(id);
				});

				// Delete routes
				if (idsByType.route.length > 0) {
					userState.topo.routes = userState.topo.routes.filter(
						(r) => !idsByType.route.includes(r.id)
					);
					userState.ui.selectedRouteId = null;
				}

				// Delete symbols
				if (idsByType.symbol.length > 0) {
					userState.topo.fixPoints = userState.topo.fixPoints.filter(
						(p) => !idsByType.symbol.includes(p.id)
					);
					// Remove references from routes
					userState.topo.routes.forEach((route) => {
						if (route.fixPoints) {
							route.fixPoints = route.fixPoints.filter((id) => !idsByType.symbol.includes(id));
						}
						if (route.pitches) {
							route.pitches.forEach((pitch) => {
								idsByType.symbol.forEach((id) => {
									if (pitch.startNodeId === id) pitch.startNodeId = null;
									if (pitch.endNodeId === id) pitch.endNodeId = null;
								});
							});
						}
					});
					userState.ui.selectedFixpointId = null;
				}

				// Delete outlines
				if (idsByType.outline.length > 0) {
					userState.topo.outlines = userState.topo.outlines.filter(
						(o) => !idsByType.outline.includes(o.id)
					);
					userState.ui.selectedOutlineId = null;
				}

				selectedItems.clear();
				saveHistory();
				return;
			}

			// Single delete (existing logic)
			if (userState.ui.selectedFixpointId) {
				const idToDelete = userState.ui.selectedFixpointId;
				// Remove from global fixpoints
				userState.topo.fixPoints = userState.topo.fixPoints.filter((p) => p.id !== idToDelete);

				// Remove references from routes
				userState.topo.routes.forEach((route) => {
					if (route.fixPoints) {
						route.fixPoints = route.fixPoints.filter((id) => id !== idToDelete);
					}
					if (route.pitches) {
						route.pitches.forEach((pitch) => {
							if (pitch.startNodeId === idToDelete) pitch.startNodeId = null;
							if (pitch.endNodeId === idToDelete) pitch.endNodeId = null;
						});
					}
				});

				userState.ui.selectedFixpointId = null;
				selectedSymbolInstance = null;
				return;
			}
		}

		currentTool.onKeyDown(event);

		if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
			event.preventDefault();
			undo();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
			event.preventDefault();
			redo();
		}
	}

	function updateSymbolRotation(delta) {
		if (!selectedSymbolInstance) return;
		const symbol = userState.topo.fixPoints.find((s) => s.id === selectedSymbolInstance.id);
		if (symbol) {
			symbol.rotation2D = ((symbol.rotation2D || 0) + delta) % 360;
		}
	}

	function updateSymbolScale(delta) {
		if (!selectedSymbolInstance) return;
		const symbol = userState.topo.fixPoints.find((s) => s.id === selectedSymbolInstance.id);
		if (symbol) {
			symbol.scale2D = Math.max(0.2, Math.min(5, (symbol.scale2D || 1) + delta));
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', (event) => {
			if (event.key === 'Shift') {
				isShiftPressed = false;
			}
		});
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	// Get routes that have 2D points
	let routes2D = $derived(userState.topo.routes.filter((r) => r.points2D && r.points2D.length > 0));

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
			bgLayer
				.append('image')
				.attr('class', 'bg-image')
				.attr('href', userState.topo.image2D)
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('preserveAspectRatio', 'none');
		} else {
			bgLayer
				.append('rect')
				.attr('class', 'blank-bg')
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('fill', '#f9fafb');

			const defs = svg.select('defs');
			if (defs.empty()) svg.append('defs');
			if (svg.select('#grid-pattern').empty()) {
				svg
					.select('defs')
					.append('pattern')
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
			bgLayer
				.append('rect')
				.attr('class', 'grid-bg')
				.attr('width', baseWidth)
				.attr('height', baseHeight)
				.attr('fill', 'url(#grid-pattern)');
		}

		// 1.5 Rock Outlines Rendering
		userState.topo.outlines.forEach((outline) => {
			const itemSelected = isSelected('outline', outline.id);
			const pointsStr = outline.points2D
				.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`)
				.join(' ');

			outlinesLayer
				.append('polyline')
				.attr('points', pointsStr)
				.attr('fill', 'none')
				.attr('stroke', itemSelected ? '#b45309' : '#d97706') // Amber-700 / Amber-600
				.attr('stroke-width', itemSelected ? 4 : 3)
				.attr('class', 'cursor-move rock-outline')
				.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto')
				.on('mousedown', (e) => handleObjectMouseDown(e, { type: 'outline', id: outline.id }))
				.on('click', (e) => handleObjectClick(e, 'outline', outline.id));

			// Handles for selected outline
			if (
				itemSelected &&
				(activeTool === null || activeTool === 'eraser') &&
				selectedItems.size <= 1
			) {
				const handleSize = getTouchTargetSize(activeTool === 'eraser' ? 7 : 4);
				outline.points2D.forEach((p, i) => {
					handlesLayer
						.append('circle')
						.attr('cx', p[0] * baseWidth)
						.attr('cy', p[1] * baseHeight)
						.attr('r', handleSize)
						.attr('fill', activeTool === 'eraser' ? '#fee2e2' : '#b45309')
						.attr('stroke', activeTool === 'eraser' ? '#ef4444' : 'none')
						.attr('stroke-width', 2)
						.attr('class', 'cursor-move')
						.on('mousedown', (e) =>
							handlePointMouseDown(e, { outlineId: outline.id, pointIndex: i })
						)
						.on('click', (e) => e.stopPropagation());
				});

				// Midpoint handles for point insertion
				const midpointSize = getTouchTargetSize(3);
				for (let j = 0; j < outline.points2D.length - 1; j++) {
					const p1 = outline.points2D[j];
					const p2 = outline.points2D[j + 1];
					const midX = (p1[0] + p2[0]) / 2;
					const midY = (p1[1] + p2[1]) / 2;

					handlesLayer
						.append('circle')
						.attr('class', 'midpoint-handle cursor-pointer')
						.attr('cx', midX * baseWidth)
						.attr('cy', midY * baseHeight)
						.attr('r', midpointSize)
						.attr('fill', '#d97706')
						.attr('opacity', 0.6)
						.attr('stroke', 'white')
						.attr('stroke-width', 1)
						.on('mouseover', function () {
							select(this).attr('opacity', 1).attr('r', 4);
						})
						.on('mouseout', function () {
							select(this).attr('opacity', 0.6).attr('r', 2);
						})
						.on('click', (e) =>
							handleMidpointClick(e, {
								outlineId: outline.id,
								insertIndex: j + 1,
								point: { x: midX, y: midY }
							})
						);
				}
			}
		});

		// 2. Routes Rendering
		userState.topo.routes.forEach((route, i) => {
			const renderLine = (points, id, label, isPitch = false, parentRouteId = null) => {
				if (!points || points.length < 1) return;

				const group = routesLayer
					.append('g')
					.attr('class', isPitch ? 'pitch-group' : 'route-group');
				const pointsStr = points.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ');

				const lineSelected =
					isSelected('route', parentRouteId || id) ||
					(drawingTarget?.type === 'pitch' && drawingTarget.pitchId === id);

				const hitAreaSize = getHitAreaSize(7);
				group
					.append('polyline')
					.attr('class', 'hit-area cursor-pointer')
					.attr('points', pointsStr)
					.attr('fill', 'none')
					.attr('stroke', 'transparent')
					.attr('stroke-width', hitAreaSize)
					.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto')
					.on('mousedown', (e) => e.stopPropagation())
					.on('click', (e) => (isPitch ? null : handleObjectClick(e, 'route', id)));

				group
					.append('polyline')
					.attr('class', 'main-path cursor-move')
					.attr('points', pointsStr)
					.attr('fill', 'none')
					.attr('stroke', lineSelected ? '#3b82f6' : '#12538b')
					.attr('stroke-width', lineSelected ? 5 : 3)
					.attr('stroke-linecap', 'round')
					.attr('stroke-linejoin', 'round')
					.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto')
					.on('mousedown', (e) =>
						handleObjectMouseDown(e, {
							type: 'route',
							id: parentRouteId || id,
							pitchId: isPitch ? id : null
						})
					)
					.on('click', (e) => (isPitch ? null : handleObjectClick(e, 'route', id)));

				if (label) {
					const routeObj = isPitch ? route.pitches.find((p) => p.id === id) : route;
					const offsetX = routeObj?.labelOffset2D ? routeObj.labelOffset2D[0] : 0;
					const offsetY = routeObj?.labelOffset2D ? routeObj.labelOffset2D[1] : 10 / baseHeight;

					group
						.append('text')
						.attr('class', 'route-label cursor-move')
						.attr('x', (points[0][0] + offsetX) * baseWidth)
						.attr('y', (points[0][1] + offsetY) * baseHeight)
						.attr('font-size', '20')
						.attr('font-weight', 'bold')
						.attr('fill', lineSelected ? '#3b82f6' : '#12538b')
						.attr('text-anchor', 'middle')
						.style(
							'pointer-events',
							activeTool !== null && activeTool !== 'eraser' ? 'none' : 'all'
						)
						.style('user-select', 'none')
						.on('mousedown', (e) =>
							handleLabelMouseDown(e, {
								routeId: parentRouteId || id,
								pitchId: isPitch ? id : null
							})
						)
						.on('touchstart', (e) => {
							if (e.touches.length === 1) {
								e.stopPropagation();
								handleLabelMouseDown(e.touches[0], {
									routeId: parentRouteId || id,
									pitchId: isPitch ? id : null
								});
							}
						})
						.on('click', (e) => e.stopPropagation())
						.text(label);
				}

				// Midpoint handles for selected route/pitch
				if (lineSelected && activeTool === null && selectedItems.size <= 1) {
					if (points && points.length > 1) {
						const midpointSize = getTouchTargetSize(2);
						for (let j = 0; j < points.length - 1; j++) {
							const p1 = points[j];
							const p2 = points[j + 1];
							const midX = (p1[0] + p2[0]) / 2;
							const midY = (p1[1] + p2[1]) / 2;

							handlesLayer
								.append('circle')
								.attr('class', 'midpoint-handle cursor-pointer')
								.attr('cx', midX * baseWidth)
								.attr('cy', midY * baseHeight)
								.attr('r', midpointSize)
								.attr('fill', '#3b82f6')
								.attr('opacity', 0.6)
								.attr('stroke', 'white')
								.attr('stroke-width', 1)
								.on('mouseover', function () {
									select(this).attr('opacity', 1).attr('r', 4);
								})
								.on('mouseout', function () {
									select(this).attr('opacity', 0.6).attr('r', 2);
								})
								.on('click', (e) =>
									handleMidpointClick(e, {
										routeId: parentRouteId || id,
										pitchId: isPitch ? id : null,
										insertIndex: j + 1,
										point: { x: midX, y: midY }
									})
								);
						}
					}
				}
			};

			if (route.type === 'multi-pitch' && route.pitches) {
				route.pitches.forEach((pitch, pitchIdx) => {
					renderLine(pitch.points2D, pitch.id, null, true, route.id);
				});
				// Add a label for the whole route at the start of the first pitch
				if (route.pitches[0]?.points2D?.length > 0) {
					const offsetX = route.labelOffset2D ? route.labelOffset2D[0] : 0;
					const offsetY = route.labelOffset2D ? route.labelOffset2D[1] : 10 / baseHeight;

					routesLayer
						.append('text')
						.attr('class', 'route-label cursor-move')
						.attr('x', (route.pitches[0].points2D[0][0] + offsetX) * baseWidth)
						.attr('y', (route.pitches[0].points2D[0][1] + offsetY) * baseHeight)
						.attr('font-size', '20')
						.attr('font-weight', 'bold')
						.attr('fill', userState.ui.selectedRouteId === route.id ? '#3b82f6' : '#12538b')
						.attr('text-anchor', 'middle')
						.style('pointer-events', 'all')
						.style('user-select', 'none')
						.on('mousedown', (e) => handleLabelMouseDown(e, { routeId: route.id, pitchId: null }))
						.on('touchstart', (e) => {
							if (e.touches.length === 1) {
								e.stopPropagation();
								handleLabelMouseDown(e.touches[0], { routeId: route.id, pitchId: null });
							}
						})
						.on('click', (e) => e.stopPropagation())
						.text(i + 1);
				}
			} else {
				renderLine(route.points2D, route.id, i + 1);
			}
		});

		// 3. Current Drawing Rendering
		if (currentRoutePoints.length > 0) {
			currentLayer
				.append('polyline')
				.attr('class', 'current-path')
				.attr(
					'points',
					currentRoutePoints.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ')
				)
				.attr('fill', 'none')
				.attr('stroke', '#ff00ff')
				.attr('stroke-width', 3)
				.attr('stroke-linecap', 'round')
				.attr('stroke-linejoin', 'round');

			currentRoutePoints.forEach((p) => {
				currentLayer
					.append('circle')
					.attr('class', 'current-point')
					.attr('cx', p[0] * baseWidth)
					.attr('cy', p[1] * baseHeight)
					.attr('r', 3)
					.attr('fill', '#ff00ff');
			});
		}

		if (currentOutlinePoints.length > 0) {
			const pointsStr = currentOutlinePoints
				.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`)
				.join(' ');
			currentLayer
				.append('polyline')
				.attr('class', 'current-outline')
				.attr('points', pointsStr)
				.attr('fill', 'none')
				.attr('stroke', '#f59e0b') // Amber-500
				.attr('stroke-width', 2);

			currentOutlinePoints.forEach((p) => {
				currentLayer
					.append('circle')
					.attr('cx', p[0] * baseWidth)
					.attr('cy', p[1] * baseHeight)
					.attr('r', 3)
					.attr('fill', '#f59e0b');
			});
		}

		// 4. Handles Rendering (Selected Route)
		const renderHandles = (points, routeId, pitchId = null) => {
			if (!points) return;

			const isMultiSelected = selectedItems.size > 1;
			if (isMultiSelected) return;

			points.forEach((p, index) => {
				const handleSize = getTouchTargetSize(activeTool === 'eraser' ? 5 : 3);
				handlesLayer
					.append('circle')
					.attr('class', `handle ${activeTool === null ? 'cursor-move' : 'cursor-pointer'}`)
					.attr('cx', p[0] * baseWidth)
					.attr('cy', p[1] * baseHeight)
					.attr('r', handleSize)
					.attr('fill', activeTool === 'eraser' ? '#fee2e2' : 'white')
					.attr('stroke', activeTool === 'eraser' ? '#ef4444' : '#3b82f6')
					.attr('stroke-width', 2)
					.on('mousedown', (e) => handlePointMouseDown(e, { routeId, pitchId, pointIndex: index }))
					.on('click', (e) => e.stopPropagation())
					.on('touchstart', (e) => {
						if (e.touches.length === 1) {
							e.stopPropagation();
							handlePointMouseDown(e.touches[0], { routeId, pitchId, pointIndex: index });
						}
					});
			});
		};

		if (userState.ui.selectedRouteId && (activeTool === null || activeTool === 'eraser')) {
			const route = userState.topo.routes.find((r) => r.id === userState.ui.selectedRouteId);
			if (route && route.points2D) {
				renderHandles(route.points2D, route.id);
			}
		}

		if (activeTool === 'multipitch' && drawingTarget?.type === 'pitch') {
			const route = userState.topo.routes.find((r) => r.id === drawingTarget.routeId);
			if (route && route.pitches) {
				const pitch = route.pitches.find((p) => p.id === drawingTarget.pitchId);
				if (pitch && pitch.points2D) {
					renderHandles(pitch.points2D, route.id, pitch.id);
				}
			}
		}

		// 5. Symbols (FixPoints) Rendering
		userState.topo.fixPoints.forEach((symbol) => {
			if (!symbol.position2D) return; // Skip if it only has 3D position

			const isFixpoint = ['abseil', 'belay', 'bolt', 'piton'].includes(symbol.type);
			const baseSize = isFixpoint ? 6 : 40;
			const radius = baseSize / 2;
			const touchRadius = getTouchTargetSize(radius);

			const group = symbolsLayer
				.append('g')
				.attr('class', 'symbol-group cursor-move')
				.attr(
					'transform',
					`translate(${symbol.position2D[0] * baseWidth}, ${symbol.position2D[1] * baseHeight}) rotate(${symbol.rotation2D || 0}) scale(${symbol.scale2D || 1})`
				)
				.on('mousedown', (e) => handleObjectMouseDown(e, { type: 'symbol', id: symbol.id }))
				.on('touchstart', (e) => {
					if (e.touches.length === 1) {
						e.stopPropagation();
						handleObjectMouseDown(e.touches[0], { type: 'symbol', id: symbol.id });
					}
				});

			// Invisible hit area for easier selecting on mobile
			group
				.append('circle')
				.attr('r', touchRadius)
				.attr('fill', 'transparent')
				.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'all');

			group
				.append('image')
				.attr('width', baseSize)
				.attr('height', baseSize)
				.attr('x', -radius)
				.attr('y', -radius)
				.attr('href', `/icons/topo-symbols/${symbol.type}.svg`);

			const itemSelected =
				selectedSymbolInstance?.id === symbol.id || isSelected('symbol', symbol.id);
			group
				.attr('opacity', itemSelected ? 0.9 : 1)
				.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto')
				.on('click', (e) => {
					handleObjectClick(e, 'symbol', symbol.id);
				});

			if (itemSelected && activeTool === null) {
				const boxPadding = 5;
				const boxSize = baseSize + boxPadding * 2;
				const boxOffset = -(radius + boxPadding);

				// Bounding Box
				group
					.append('rect')
					.attr('x', boxOffset)
					.attr('y', boxOffset)
					.attr('width', boxSize)
					.attr('height', boxSize)
					.attr('fill', 'none')
					.attr('stroke', '#3b82f6')
					.attr('stroke-width', 1)
					.attr('stroke-dasharray', '2,2');

				// Rotation Stalk
				group
					.append('line')
					.attr('x1', 0)
					.attr('y1', boxOffset)
					.attr('x2', 0)
					.attr('y2', boxOffset - 20)
					.attr('stroke', '#3b82f6')
					.attr('stroke-width', 1);

				const gizmoSize = getTouchTargetSize(10);
				const unscaledGizmoSize = gizmoSize / (symbol.scale2D || 1);

				// Rotate gizmo (top)
				group
					.append('circle')
					.attr('class', 'gizmo rotate-gizmo cursor-alias')
					.attr('cx', 0)
					.attr('cy', boxOffset - 20)
					.attr('r', unscaledGizmoSize)
					.attr('fill', '#f59e0b')
					.attr('stroke', 'white')
					.attr('stroke-width', 2 / (symbol.scale2D || 1))
					.on('mousedown', (e) => handleRotateGizmoMouseDown(e, symbol))
					.on('click', (e) => e.stopPropagation())
					.on('touchstart', (e) => {
						if (e.touches.length === 1) {
							e.stopPropagation();
							handleRotateGizmoMouseDown(e.touches[0], symbol);
						}
					});

				// Scale gizmo (bottom right)
				group
					.append('circle')
					.attr('class', 'gizmo scale-gizmo cursor-nwse-resize')
					.attr('cx', -boxOffset)
					.attr('cy', -boxOffset)
					.attr('r', unscaledGizmoSize)
					.attr('fill', '#3b82f6')
					.attr('stroke', 'white')
					.attr('stroke-width', 2 / (symbol.scale2D || 1))
					.on('mousedown', (e) => handleScaleGizmoMouseDown(e, symbol))
					.on('click', (e) => e.stopPropagation())
					.on('touchstart', (e) => {
						if (e.touches.length === 1) {
							e.stopPropagation();
							handleScaleGizmoMouseDown(e.touches[0], symbol);
						}
					});
			}

			group
				.append('circle')
				.attr('class', 'selection-circle')
				.attr('cx', 0)
				.attr('cy', 0)
				.attr('r', radius + 10)
				.attr('fill', 'none')
				.attr('stroke', '#3b82f6')
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', '4')
				.style('display', itemSelected || isSelected('symbol', symbol.id) ? 'block' : 'none');
		});
	}

	// Trigger D3 render on state changes
	$effect(() => {
		// Explicitly track deep reactive dependencies for D3 rendering
		// Svelte 5 needs to see these accessed synchronously to track them
		for (const r of userState.topo.routes) {
			if (r.labelOffset2D) {
				r.labelOffset2D[0];
				r.labelOffset2D[1];
			}
			if (r.points2D) {
				for (const p of r.points2D) {
					p[0];
					p[1];
				}
			}
			if (r.pitches) {
				for (const pitch of r.pitches) {
					if (pitch.labelOffset2D) {
						pitch.labelOffset2D[0];
						pitch.labelOffset2D[1];
					}
					if (pitch.points2D) {
						for (const p of pitch.points2D) {
							p[0];
							p[1];
						}
					}
				}
			}
		}
		for (const o of userState.topo.outlines) {
			for (const p of o.points2D) {
				p[0];
				p[1];
			}
		}
		for (const s of userState.topo.fixPoints) {
			if (s.position2D) {
				s.position2D[0];
				s.position2D[1];
				s.rotation2D;
				s.scale2D;
			}
		}
		for (const p of currentRoutePoints) {
			p[0];
			p[1];
		}
		for (const p of currentOutlinePoints) {
			p[0];
			p[1];
		}

		// Map these as dependencies too
		const _deps = {
			active: activeTool,
			selectedRoute: userState.ui.selectedRouteId,
			selectedOutline: userState.ui.selectedOutlineId,
			selectedFixpoint: userState.ui.selectedFixpointId,
			selectedItems: selectedItems.size,
			transform: transform,
			base: { baseWidth, baseHeight }
		};

		updateD3Rendering();
	});
</script>

<div
	class="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden"
	style="touch-action: none;"
>
	<svg
		bind:this={svgElement}
		viewBox="0 0 {baseWidth} {baseHeight}"
		class="w-full h-full cursor-{activeTool === 'eraser' ? 'crosshair' : 'crosshair'}"
		style="touch-action: none;"
		onmousedown={handleSVGMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		ontouchcancel={handleTouchEnd}
		role="application"
		aria-label="Topo Editor"
	>
		<g bind:this={gElement}></g>
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
