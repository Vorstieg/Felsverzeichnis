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
	import { initializeIdCounters } from '$lib/assets/js/id-utils.js';
	import {
		isTouchDevice,
		getTouchTargetSize,
		getHitAreaSize,
		getTouchPoint,
		createLongPressDetector,
		vibrateOnAction
	} from '$lib/assets/js/mobile-utils.js';

	let {
		activeTool = $bindable(null),
		selectedSymbol = 'bolt',
		drawingTarget = null,
		hasPendingChanges = $bindable(false)
	} = $props();

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

	$effect(() => {
		hasPendingChanges =
			(currentRoutePoints?.length || 0) > 0 || (currentOutlinePoints?.length || 0) > 0;
	});
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
					// 2+ fingers always allow zoom/pan
					if (event.touches && event.touches.length >= 2) return true;
					// 1 finger: Only allow zoom (pan) if no tool is active
					return activeTool === null && event.touches && event.touches.length === 1;
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
		if (zoomBehavior) {
			svg.call(zoomBehavior);
		}

		// Initialize ID counters from existing data to avoid collisions
		initializeIdCounters(userState.topo);

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
			const point = getTouchPoint(event, svgElement, transform, baseWidth, baseHeight);
			if (point) {
				// If no tool is active, let d3-zoom handle the single-finger pan
				// We don't track activeTouch here so handleTouchMove skips custom logic
				if (activeTool === null) {
					// Still call this to clear selection on background tap
					handleSVGMouseDown({
						clientX: touch.clientX,
						clientY: touch.clientY,
						button: 0,
						touches: event.touches
					});
					return;
				}

				event.preventDefault();

				activeTouch = touch.identifier;

				// Start long press detection
				longPressDetector.start(event);

				// Simulate mouse event for tool and SVG interaction
				const mouseEvent = {
					clientX: touch.clientX,
					clientY: touch.clientY,
					stopPropagation: () => event.stopPropagation(),
					preventDefault: () => event.preventDefault(),
					altKey: false,
					shiftKey: false,
					touches: event.touches // Pass touches to identify as touch event in handleSVGMouseDown
				};
				handleSVGMouseDown(mouseEvent);
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
		if (event.touches.length >= 2) {
			event.preventDefault(); // d3-zoom handles multi-touch pan/zoom
			return;
		}

		// Single touch movement
		longPressDetector.cancel();

		if (event.touches.length === 1 && activeTouch !== null) {
			event.preventDefault(); // Prevent browser scroll when drawing or dragging objects
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

	$effect(() => {
		if (!svgElement) return;

		const options = { passive: false };
		svgElement.addEventListener('touchstart', handleTouchStart, options);
		svgElement.addEventListener('touchmove', handleTouchMove, options);
		svgElement.addEventListener('touchend', handleTouchEnd, options);
		svgElement.addEventListener('touchcancel', handleTouchEnd, options);

		return () => {
			svgElement.removeEventListener('touchstart', handleTouchStart);
			svgElement.removeEventListener('touchmove', handleTouchMove);
			svgElement.removeEventListener('touchend', handleTouchEnd);
			svgElement.removeEventListener('touchcancel', handleTouchEnd);
		};
	});

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

		event?.stopPropagation?.();

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
		event?.stopPropagation?.();
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
		// Set dragging state to allow immediate dragging after click
		draggingPoint = { routeId, pitchId, outlineId, pointIndex: insertIndex };
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
		event?.stopPropagation?.();
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
		if (event?.stopPropagation) event.stopPropagation();
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
		event?.stopPropagation?.();
		draggingLabel = { routeId, pitchId };
	}

	function handleRotateGizmoMouseDown(event, symbol) {
		event?.stopPropagation?.();
		rotatingSymbol = { id: symbol.id };
	}

	function handleScaleGizmoMouseDown(event, symbol) {
		event?.stopPropagation?.();
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

		// Interaction state check for suppressing handles/gizmos
		// We suppress handles when moving OBJECTS, but NOT when moving POINTS
		const isAnyInteractionActive =
			draggingSelection || draggingLabel || rotatingSymbol || scalingSymbol;

		// Ensure layer groups exist and are stable
		function getOrCreateLayer(className, touchActionNone = false) {
			let layer = mainG.select(`g.${className}`);
			if (layer.empty()) {
				layer = mainG.append('g').attr('class', className);
				if (touchActionNone) layer.style('touch-action', 'none');
			}
			return layer;
		}

		const bgLayer = getOrCreateLayer('background-layer');
		const outlinesLayer = getOrCreateLayer('outlines-layer', true);
		const routesLayer = getOrCreateLayer('routes-layer');
		const currentLayer = getOrCreateLayer('current-layer');
		const handlesLayer = getOrCreateLayer('handles-layer', true);
		const symbolsLayer = getOrCreateLayer('symbols-layer');

		// 1. Background Rendering
		bgLayer
			.selectAll('image.bg-image')
			.data(userState.topo.image2D ? [userState.topo.image2D] : [])
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

		bgLayer
			.selectAll('rect.blank-bg')
			.data(userState.topo.image2D ? [] : [1])
			.join(
				(enter) => enter.append('rect').attr('class', 'blank-bg'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('width', baseWidth)
			.attr('height', baseHeight)
			.attr('fill', '#f9fafb');

		// Grid pattern (only if no image)
		if (!userState.topo.image2D) {
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
		}

		bgLayer
			.selectAll('rect.grid-bg')
			.data(!userState.topo.image2D ? [1] : [])
			.join(
				(enter) => enter.append('rect').attr('class', 'grid-bg'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('width', baseWidth)
			.attr('height', baseHeight)
			.attr('fill', 'url(#grid-pattern)');

		// 1.5 Rock Outlines Rendering
		// Hit Area
		const outlineSelection = outlinesLayer
			.selectAll('polyline.hit-area')
			.data(userState.topo.outlines, (d) => d.id);

		outlineSelection
			.join(
				(enter) =>
					enter
						.append('polyline')
						.attr('class', 'hit-area cursor-pointer')
						.attr('fill', 'none')
						.attr('stroke', 'transparent')
						.on('mousedown', (e, d) => {
							e?.stopPropagation?.();
							handleObjectMouseDown(e, { type: 'outline', id: d.id });
						})
						.on('touchstart', (e, d) => {
							if (e.touches.length === 1) {
								e.preventDefault();
								e.stopPropagation();
								activeTouch = e.touches[0].identifier;
								handleObjectMouseDown(e.touches[0], { type: 'outline', id: d.id });
							}
						})
						.on('click', (e, d) => handleObjectClick(e, 'outline', d.id)),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('points', (d) =>
				d.points2D.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ')
			)
			.attr('stroke-width', getHitAreaSize(8))
			.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto');

		// Main Path
		const outlineMainSelection = outlinesLayer
			.selectAll('polyline.rock-outline')
			.data(userState.topo.outlines, (d) => d.id);

		outlineMainSelection
			.join(
				(enter) =>
					enter.append('polyline').attr('class', 'cursor-move rock-outline').attr('fill', 'none'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('points', (d) =>
				d.points2D.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' ')
			)
			.attr('stroke', (d) => (isSelected('outline', d.id) ? '#b45309' : '#d97706'))
			.attr('stroke-width', (d) => (isSelected('outline', d.id) ? 4 : 3))
			.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto');

		// Rock Outline Handles
		const outlineHandlesData = [];
		const outlineMidpointsData = [];

		userState.topo.outlines.forEach((outline) => {
			const itemSelected = isSelected('outline', outline.id);
			if (
				!isAnyInteractionActive &&
				itemSelected &&
				(activeTool === null || activeTool === 'eraser') &&
				selectedItems.size <= 1
			) {
				const handleSize = getTouchTargetSize(activeTool === 'eraser' ? 7 : 4);
				outline.points2D.forEach((p, i) => {
					outlineHandlesData.push({ outlineId: outline.id, index: i, p, handleSize });
				});

				const midpointSize = getTouchTargetSize(3);
				for (let j = 0; j < outline.points2D.length - 1; j++) {
					const p1 = outline.points2D[j];
					const p2 = outline.points2D[j + 1];
					outlineMidpointsData.push({
						outlineId: outline.id,
						insertIndex: j + 1,
						midX: (p1[0] + p2[0]) / 2,
						midY: (p1[1] + p2[1]) / 2,
						midpointSize
					});
				}
			}
		});

		const outlineHandleSelection = handlesLayer
			.selectAll('circle.outline-handle')
			.data(outlineHandlesData, (d) => `outline-${d.outlineId}-handle-${d.index}`);

		outlineHandleSelection
			.join(
				(enter) => enter.append('circle').attr('class', 'outline-handle cursor-move'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('cx', (d) => d.p[0] * baseWidth)
			.attr('cy', (d) => d.p[1] * baseHeight)
			.attr('r', (d) => d.handleSize)
			.attr('fill', activeTool === 'eraser' ? '#fee2e2' : '#b45309')
			.attr('stroke', activeTouch === 'eraser' ? '#ef4444' : 'none')
			.attr('stroke-width', 2)
			.on('mousedown', (e, d) =>
				handlePointMouseDown(e, { outlineId: d.outlineId, pointIndex: d.index })
			)
			.on('touchstart', (e, d) => {
				if (e.touches.length === 1) {
					e.preventDefault(); // Prevent emulated mousedown
					e.stopPropagation();
					activeTouch = e.touches[0].identifier;
					handlePointMouseDown(e.touches[0], { outlineId: d.outlineId, pointIndex: d.index });
				}
			})
			.on('click', (e) => e.stopPropagation());

		const outlineMidpointSelection = handlesLayer
			.selectAll('circle.outline-midpoint')
			.data(outlineMidpointsData, (d) => `outline-${d.outlineId}-mid-${d.insertIndex}`);

		outlineMidpointSelection
			.join(
				(enter) =>
					enter
						.append('circle')
						.attr('class', 'outline-midpoint cursor-pointer')
						.attr('opacity', 0.6)
						.attr('stroke', 'white')
						.attr('stroke-width', 1)
						.on('mouseover', function () {
							select(this).attr('opacity', 1).attr('r', 4);
						})
						.on('mouseout', function () {
							select(this).attr('opacity', 0.6).attr('r', 2);
						}),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('cx', (d) => d.midX * baseWidth)
			.attr('cy', (d) => d.midY * baseHeight)
			.attr('r', (d) => d.midpointSize)
			.attr('fill', '#d97706')
			.on('touchstart', (e, d) => {
				if (e.touches.length === 1) {
					e.preventDefault(); // Prevent emulated mousedown
					e.stopPropagation();
					activeTouch = e.touches[0].identifier;
					handleMidpointClick(e, {
						outlineId: d.outlineId,
						insertIndex: d.insertIndex,
						point: { x: d.midX, y: d.midY }
					});
				}
			})
			.on('mousedown', (e, d) =>
				handleMidpointClick(e, {
					outlineId: d.outlineId,
					insertIndex: d.insertIndex,
					point: { x: d.midX, y: d.midY }
				})
			);

		// 2. Routes Rendering
		const routesData = [];
		const routeLabelsData = [];
		const routeMidpointsData = [];

		userState.topo.routes.forEach((route, i) => {
			const processLine = (points, id, label, isPitch = false, parentRouteId = null) => {
				if (!points || points.length < 1) return;

				const lineSelected =
					isSelected('route', parentRouteId || id) ||
					(drawingTarget?.type === 'pitch' && drawingTarget.pitchId === id);

				routesData.push({
					id: parentRouteId || id,
					pitchId: isPitch ? id : null,
					isPitch,
					points,
					pointsStr: points.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`).join(' '),
					lineSelected,
					label,
					index: i
				});

				if (label) {
					const routeObj = isPitch ? route.pitches.find((p) => p.id === id) : route;
					routeLabelsData.push({
						id: parentRouteId || id,
						pitchId: isPitch ? id : null,
						isPitch,
						label,
						points,
						routeObj,
						lineSelected
					});
				}

				if (
					!isAnyInteractionActive &&
					lineSelected &&
					activeTool === null &&
					selectedItems.size <= 1
				) {
					if (points && points.length > 1) {
						const midpointSize = getTouchTargetSize(2);
						for (let j = 0; j < points.length - 1; j++) {
							const p1 = points[j];
							const p2 = points[j + 1];
							routeMidpointsData.push({
								routeId: parentRouteId || id,
								pitchId: isPitch ? id : null,
								insertIndex: j + 1,
								midX: (p1[0] + p2[0]) / 2,
								midY: (p1[1] + p2[1]) / 2,
								midpointSize
							});
						}
					}
				}
			};

			if (route.type === 'multi-pitch' && route.pitches) {
				route.pitches.forEach((pitch) => {
					processLine(pitch.points2D, pitch.id, null, true, route.id);
				});
				if (route.pitches[0]?.points2D?.length > 0) {
					processLine(route.pitches[0].points2D, route.id, i + 1, false);
				}
			} else {
				processLine(route.points2D, route.id, i + 1);
			}
		});

		const routeGroupSelection = routesLayer
			.selectAll('g.route-container')
			.data(routesData, (d) => `route-${d.id}-${d.pitchId || 'main'}`);

		const routeGroups = routeGroupSelection
			.join(
				(enter) => enter.append('g').attr('class', 'route-container').style('touch-action', 'none'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('class', (d) => `route-container ${d.isPitch ? 'pitch-group' : 'route-group'}`);

		// Hit Area
		routeGroups
			.selectAll('polyline.hit-area')
			.data((d) => [d])
			.join(
				(enter) =>
					enter
						.append('polyline')
						.attr('class', 'hit-area cursor-pointer')
						.attr('fill', 'none')
						.attr('stroke', 'transparent')
						.on('mousedown', (e, d) => {
							e?.stopPropagation?.();
							handleObjectMouseDown(e, {
								type: 'route',
								id: d.id,
								pitchId: d.pitchId
							});
						})
						.on('touchstart', (e, d) => {
							if (e.touches.length === 1) {
								e.preventDefault(); // Prevent emulated mousedown
								e.stopPropagation();
								activeTouch = e.touches[0].identifier;
								handleObjectMouseDown(e.touches[0], {
									type: 'route',
									id: d.id,
									pitchId: d.pitchId
								});
							}
						})
						.on('click', (e, d) => (d.isPitch ? null : handleObjectClick(e, 'route', d.id))),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('points', (d) => d.pointsStr)
			.attr('stroke-width', getHitAreaSize(7))
			.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto');

		// Main Path
		routeGroups
			.selectAll('polyline.main-path')
			.data((d) => [d])
			.join(
				(enter) =>
					enter
						.append('polyline')
						.attr('class', 'main-path cursor-move')
						.attr('fill', 'none')
						.attr('stroke-linecap', 'round')
						.attr('stroke-linejoin', 'round')
						.on('mousedown', (e, d) =>
							handleObjectMouseDown(e, {
								type: 'route',
								id: d.id,
								pitchId: d.pitchId
							})
						)
						.on('touchstart', (e, d) => {
							if (e.touches.length === 1) {
								e.preventDefault(); // Prevent emulated mousedown
								e.stopPropagation();
								activeTouch = e.touches[0].identifier;
								handleObjectMouseDown(e.touches[0], {
									type: 'route',
									id: d.id,
									pitchId: d.pitchId
								});
							}
						})
						.on('click', (e, d) => (d.isPitch ? null : handleObjectClick(e, 'route', d.id))),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('points', (d) => d.pointsStr)
			.attr('stroke', (d) => (d.lineSelected ? '#3b82f6' : '#12538b'))
			.attr('stroke-width', (d) => (d.lineSelected ? 5 : 3))
			.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto');

		// Route Labels
		const labelSelection = routesLayer
			.selectAll('text.route-label')
			.data(routeLabelsData, (d) => `label-${d.id}-${d.pitchId || 'main'}`);

		labelSelection
			.join(
				(enter) =>
					enter
						.append('text')
						.attr('class', 'route-label cursor-move')
						.attr('font-size', '20')
						.attr('font-weight', 'bold')
						.attr('text-anchor', 'middle')
						.style('user-select', 'none')
						.on('mousedown', (e, d) =>
							handleLabelMouseDown(e, {
								routeId: d.id,
								pitchId: d.pitchId
							})
						)
						.on('touchstart', (e, d) => {
							if (e.touches.length === 1) {
								e.preventDefault(); // Prevent emulated mousedown
								e.stopPropagation();
								activeTouch = e.touches[0].identifier;
								handleLabelMouseDown(e.touches[0], {
									routeId: d.id,
									pitchId: d.pitchId
								});
							}
						})
						.on('click', (e) => e?.stopPropagation?.()),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('x', (d) => {
				const offsetX = d.routeObj?.labelOffset2D ? d.routeObj.labelOffset2D[0] : 0;
				return (d.points[0][0] + offsetX) * baseWidth;
			})
			.attr('y', (d) => {
				const offsetY = d.routeObj?.labelOffset2D ? d.routeObj.labelOffset2D[1] : 10 / baseHeight;
				return (d.points[0][1] + offsetY) * baseHeight;
			})
			.attr('fill', (d) => (d.lineSelected ? '#3b82f6' : '#12538b'))
			.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'all')
			.text((d) => d.label);

		// Route Midpoints
		const routeMidpointSelection = handlesLayer
			.selectAll('circle.route-midpoint')
			.data(
				routeMidpointsData,
				(d) => `route-${d.routeId}-mid-${d.pitchId || 'main'}-${d.insertIndex}`
			);

		routeMidpointSelection
			.join(
				(enter) =>
					enter
						.append('circle')
						.attr('class', 'route-midpoint cursor-pointer')
						.attr('opacity', 0.6)
						.attr('stroke', 'white')
						.attr('stroke-width', 1)
						.on('mouseover', function () {
							select(this).attr('opacity', 1).attr('r', 4);
						})
						.on('mouseout', function () {
							select(this).attr('opacity', 0.6).attr('r', 2);
						}),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('cx', (d) => d.midX * baseWidth)
			.attr('cy', (d) => d.midY * baseHeight)
			.attr('r', (d) => d.midpointSize)
			.attr('fill', '#3b82f6')
			.on('touchstart', (e, d) => {
				if (e.touches.length === 1) {
					e.preventDefault(); // Prevent emulated mousedown
					e.stopPropagation();
					activeTouch = e.touches[0].identifier;
					handleMidpointClick(e, {
						routeId: d.routeId,
						pitchId: d.pitchId,
						insertIndex: d.insertIndex,
						point: { x: d.midX, y: d.midY }
					});
				}
			})
			.on('mousedown', (e, d) =>
				handleMidpointClick(e, {
					routeId: d.routeId,
					pitchId: d.pitchId,
					insertIndex: d.insertIndex,
					point: { x: d.midX, y: d.midY }
				})
			);

		// 3. Current Drawing Rendering
		const currentPathData =
			currentRoutePoints.length > 0
				? [
						{
							points: currentRoutePoints,
							pointsStr: currentRoutePoints
								.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`)
								.join(' ')
						}
					]
				: [];

		currentLayer
			.selectAll('polyline.current-path')
			.data(currentPathData)
			.join(
				(enter) =>
					enter
						.append('polyline')
						.attr('class', 'current-path')
						.attr('fill', 'none')
						.attr('stroke', '#ff00ff')
						.attr('stroke-width', 3)
						.attr('stroke-linecap', 'round')
						.attr('stroke-linejoin', 'round'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('points', (d) => d.pointsStr);

		currentLayer
			.selectAll('circle.current-point')
			.data(currentRoutePoints)
			.join(
				(enter) =>
					enter
						.append('circle')
						.attr('class', 'current-point')
						.attr('r', 3)
						.attr('fill', '#ff00ff'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('cx', (p) => p[0] * baseWidth)
			.attr('cy', (p) => p[1] * baseHeight);

		const currentOutlineData =
			currentOutlinePoints.length > 0
				? [
						{
							points: currentOutlinePoints,
							pointsStr: currentOutlinePoints
								.map((p) => `${p[0] * baseWidth},${p[1] * baseHeight}`)
								.join(' ')
						}
					]
				: [];

		currentLayer
			.selectAll('polyline.current-outline')
			.data(currentOutlineData)
			.join(
				(enter) =>
					enter
						.append('polyline')
						.attr('class', 'current-outline')
						.attr('fill', 'none')
						.attr('stroke', '#f59e0b')
						.attr('stroke-width', 2),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('points', (d) => d.pointsStr);

		currentLayer
			.selectAll('circle.current-outline-point')
			.data(currentOutlinePoints)
			.join(
				(enter) =>
					enter
						.append('circle')
						.attr('class', 'current-outline-point')
						.attr('r', 3)
						.attr('fill', '#f59e0b'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('cx', (p) => p[0] * baseWidth)
			.attr('cy', (p) => p[1] * baseHeight);

		// 4. Handles Rendering (Selected Route)
		const routePointHandlesData = [];

		if (!isAnyInteractionActive) {
			if (userState.ui.selectedRouteId && (activeTool === null || activeTool === 'eraser')) {
				const route = userState.topo.routes.find((r) => r.id === userState.ui.selectedRouteId);
				if (route && route.points2D && selectedItems.size <= 1) {
					route.points2D.forEach((p, index) => {
						routePointHandlesData.push({
							routeId: route.id,
							pitchId: null,
							index,
							p,
							handleSize: getTouchTargetSize(activeTool === 'eraser' ? 5 : 3)
						});
					});
				}
			}

			if (activeTool === 'multipitch' && drawingTarget?.type === 'pitch') {
				const route = userState.topo.routes.find((r) => r.id === drawingTarget.routeId);
				if (route && route.pitches) {
					const pitch = route.pitches.find((p) => p.id === drawingTarget.pitchId);
					if (pitch && pitch.points2D) {
						pitch.points2D.forEach((p, index) => {
							routePointHandlesData.push({
								routeId: route.id,
								pitchId: pitch.id,
								index,
								p,
								handleSize: getTouchTargetSize(activeTool === 'eraser' ? 5 : 3)
							});
						});
					}
				}
			}
		}

		const routePointHandleSelection = handlesLayer
			.selectAll('circle.route-point-handle')
			.data(routePointHandlesData, (d) => `handle-${d.routeId}-${d.pitchId || 'main'}-${d.index}`);

		routePointHandleSelection
			.join(
				(enter) =>
					enter
						.append('circle')
						.attr('class', 'route-point-handle cursor-move')
						.attr('stroke-width', 2)
						.on('mousedown', (e, d) =>
							handlePointMouseDown(e, {
								routeId: d.routeId,
								pitchId: d.pitchId,
								pointIndex: d.index
							})
						)
						.on('click', (e) => e?.stopPropagation?.())
						.on('touchstart', (e, d) => {
							if (e.touches.length === 1) {
								e.preventDefault(); // Prevent emulated mousedown
								e.stopPropagation();
								activeTouch = e.touches[0].identifier;
								handlePointMouseDown(e.touches[0], {
									routeId: d.routeId,
									pitchId: d.pitchId,
									pointIndex: d.index
								});
							}
						}),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('cx', (d) => d.p[0] * baseWidth)
			.attr('cy', (d) => d.p[1] * baseHeight)
			.attr('r', (d) => d.handleSize)
			.attr('fill', activeTool === 'eraser' ? '#fee2e2' : 'white')
			.attr('stroke', activeTool === 'eraser' ? '#ef4444' : '#3b82f6')
			.attr(
				'class',
				(d) => `route-point-handle ${activeTool === null ? 'cursor-move' : 'cursor-pointer'}`
			);

		// 5. Symbols (FixPoints) Rendering
		const symbolGroupSelection = symbolsLayer
			.selectAll('g.symbol-group')
			.data(userState.topo.fixPoints, (d) => d.id);

		const symbolGroups = symbolGroupSelection
			.join(
				(enter) =>
					enter
						.append('g')
						.attr('class', 'symbol-group cursor-move')
						.style('touch-action', 'none')
						.on('mousedown', (e, d) => handleObjectMouseDown(e, { type: 'symbol', id: d.id }))
						.on('touchstart', (e, d) => {
							if (e.touches.length === 1) {
								e.preventDefault(); // Prevent emulated mousedown
								e.stopPropagation();
								activeTouch = e.touches[0].identifier;
								handleObjectMouseDown(e.touches[0], { type: 'symbol', id: d.id });
							}
						}),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr(
				'transform',
				(d) =>
					`translate(${d.position2D[0] * baseWidth}, ${d.position2D[1] * baseHeight}) rotate(${d.rotation2D || 0}) scale(${d.scale2D || 1})`
			)
			.attr('opacity', (d) =>
				selectedSymbolInstance?.id === d.id || isSelected('symbol', d.id) ? 0.9 : 1
			)
			.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'auto')
			.on('click', (e, d) => {
				handleObjectClick(e, 'symbol', d.id);
			});

		// Invisible hit area for easier selecting on mobile
		symbolGroups
			.selectAll('circle.hit-area')
			.data((d) => [d])
			.join(
				(enter) => enter.append('circle').attr('class', 'hit-area').attr('fill', 'transparent'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('r', (d) => {
				const isFixpoint = ['abseil', 'belay', 'bolt', 'piton'].includes(d.type);
				const radius = (isFixpoint ? 6 : 40) / 2;
				return getTouchTargetSize(radius);
			})
			.style('pointer-events', activeTool !== null && activeTool !== 'eraser' ? 'none' : 'all');

		// Symbol Icon
		symbolGroups
			.selectAll('image.symbol-icon')
			.data((d) => [d])
			.join(
				(enter) => enter.append('image').attr('class', 'symbol-icon'),
				(update) => update,
				(exit) => exit.remove()
			)
			.attr('width', (d) => (['abseil', 'belay', 'bolt', 'piton'].includes(d.type) ? 6 : 40))
			.attr('height', (d) => (['abseil', 'belay', 'bolt', 'piton'].includes(d.type) ? 6 : 40))
			.attr('x', (d) => -(['abseil', 'belay', 'bolt', 'piton'].includes(d.type) ? 6 : 40) / 2)
			.attr('y', (d) => -(['abseil', 'belay', 'bolt', 'piton'].includes(d.type) ? 6 : 40) / 2)
			.attr('href', (d) => `/icons/topo-symbols/${d.type}.svg`);

		// Selection/Gizmo Overlay
		symbolGroups.each(function (symbol) {
			const group = select(this);
			const itemSelected =
				selectedSymbolInstance?.id === symbol.id || isSelected('symbol', symbol.id);

			const isFixpoint = ['abseil', 'belay', 'bolt', 'piton'].includes(symbol.type);
			const baseSize = isFixpoint ? 6 : 40;
			const radius = baseSize / 2;

			if (itemSelected && activeTool === null) {
				const boxPadding = 5;
				const boxSize = baseSize + boxPadding * 2;
				const boxOffset = -(radius + boxPadding);

				// Bounding Box
				group
					.selectAll('rect.bounding-box')
					.data([symbol])
					.join(
						(enter) =>
							enter
								.append('rect')
								.attr('class', 'bounding-box')
								.attr('fill', 'none')
								.attr('stroke', '#3b82f6')
								.attr('stroke-width', 1)
								.attr('stroke-dasharray', '2,2'),
						(update) => update,
						(exit) => exit.remove()
					)
					.attr('x', boxOffset)
					.attr('y', boxOffset)
					.attr('width', boxSize)
					.attr('height', boxSize);

				// Rotation Stalk
				group
					.selectAll('line.rotation-stalk')
					.data([symbol])
					.join(
						(enter) =>
							enter
								.append('line')
								.attr('class', 'rotation-stalk')
								.attr('stroke', '#3b82f6')
								.attr('stroke-width', 1),
						(update) => update,
						(exit) => exit.remove()
					)
					.attr('x1', 0)
					.attr('y1', boxOffset)
					.attr('x2', 0)
					.attr('y2', boxOffset - 20);

				const gizmoSize = boxSize / 4;

				// Rotate gizmo (top)
				group
					.selectAll('circle.rotate-gizmo')
					.data([symbol])
					.join(
						(enter) =>
							enter
								.append('circle')
								.attr('class', 'gizmo rotate-gizmo cursor-alias')
								.attr('fill', '#f59e0b')
								.attr('stroke', 'white')
								.on('mousedown', (e, d) => handleRotateGizmoMouseDown(e, d))
								.on('click', (e) => e?.stopPropagation?.())
								.on('touchstart', (e, d) => {
									if (e.touches.length === 1) {
										e.preventDefault(); // Prevent emulated mousedown
										e.stopPropagation();
										activeTouch = e.touches[0].identifier;
										handleRotateGizmoMouseDown(e.touches[0], d);
									}
								}),
						(update) => update,
						(exit) => exit.remove()
					)
					.attr('cx', 0)
					.attr('cy', boxOffset - 20)
					.attr('r', gizmoSize)
					.attr('stroke-width', 2 / (symbol.scale2D || 1));

				// Scale gizmo (bottom right)
				group
					.selectAll('circle.scale-gizmo')
					.data([symbol])
					.join(
						(enter) =>
							enter
								.append('circle')
								.attr('class', 'gizmo scale-gizmo cursor-nwse-resize')
								.attr('fill', '#3b82f6')
								.attr('stroke', 'white')
								.on('mousedown', (e, d) => handleScaleGizmoMouseDown(e, d))
								.on('click', (e) => e?.stopPropagation?.())
								.on('touchstart', (e, d) => {
									if (e.touches.length === 1) {
										e.preventDefault(); // Prevent emulated mousedown
										e.stopPropagation();
										activeTouch = e.touches[0].identifier;
										handleScaleGizmoMouseDown(e.touches[0], d);
									}
								}),
						(update) => update,
						(exit) => exit.remove()
					)
					.attr('cx', -boxOffset)
					.attr('cy', -boxOffset)
					.attr('r', gizmoSize)
					.attr('stroke-width', 2 / (symbol.scale2D || 1));
			} else {
				group.selectAll('.bounding-box, .rotation-stalk, .rotate-gizmo, .scale-gizmo').remove();
			}

			// Selection Circle (dashed circle always present but hidden when not selected)
			group
				.selectAll('circle.selection-circle')
				.data([symbol])
				.join(
					(enter) =>
						enter
							.append('circle')
							.attr('class', 'selection-circle')
							.attr('fill', 'none')
							.attr('stroke', '#3b82f6')
							.attr('stroke-width', 2)
							.attr('stroke-dasharray', '4'),
					(update) => update,
					(exit) => exit.remove()
				)
				.attr('cx', 0)
				.attr('cy', 0)
				.attr('r', radius + 10)
				.style('display', itemSelected ? 'block' : 'none');
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
