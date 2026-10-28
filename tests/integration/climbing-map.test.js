import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import ClimbingMap from '$lib/components/ClimbingMap.svelte';
import { createExpression, latest } from '@maplibre/maplibre-gl-style-spec';

const mapState = vi.hoisted(() => ({ instance: null }));

vi.mock('maplibre-gl', () => {
	class MockMap {
		constructor(options) {
			this.options = options;
			this.handlers = new Map();
			this.zoom = options.zoom;
			this.canvas = { style: {} };
			this.container = { clientWidth: 1440, clientHeight: 900 };
			this.controls = [];
			this.paintCalls = [];
			this.layoutCalls = [];
			this.sources = new Map();
			this.layers = new Map();
			this.images = new Map();
			mapState.instance = this;
		}

		on(event, layerOrHandler, maybeHandler) {
			const key = maybeHandler ? `${event}:${JSON.stringify(layerOrHandler)}` : event;
			this.handlers.set(key, maybeHandler || layerOrHandler);
			return this;
		}
		once(event, handler) {
			this.handlers.set(event, handler);
			return this;
		}

		addControl(control) {
			this.controls.push(control);
		}
		getCanvas() {
			return this.canvas;
		}
		getContainer() {
			return this.container;
		}
		project() {
			return { x: 100, y: 100 };
		}
		getZoom() {
			return this.zoom;
		}
		setZoom(zoom) {
			this.zoom = zoom;
		}
		isStyleLoaded() {
			return true;
		}
		getLayer(id) {
			return this.layers.get(id) || null;
		}
		getSource(id) {
			return this.sources.get(id) || null;
		}
		addSource(id, source) {
			this.sources.set(id, { ...source, setData: vi.fn() });
		}
		addLayer(layer, beforeId) {
			if (beforeId && this.layers.has(beforeId)) {
				const next = new Map();
				for (const [k, v] of this.layers.entries()) {
					if (k === beforeId) next.set(layer.id, layer);
					next.set(k, v);
				}
				this.layers = next;
			} else {
				this.layers.set(layer.id, layer);
			}
		}
		removeLayer(id) {
			this.layers.delete(id);
		}
		removeSource(id) {
			this.sources.delete(id);
		}
		setFilter(id, filter) {
			const layer = this.layers.get(id);
			if (layer) layer.filter = filter;
		}
		setPaintProperty(...args) {
			this.paintCalls.push(args);
		}
		setLayoutProperty(...args) {
			this.layoutCalls.push(args);
		}
		loadImage(url) {
			return Promise.resolve({ data: { url } });
		}
		hasImage(name) {
			return this.images.has(name);
		}
		addImage(name, image) {
			this.images.set(name, image);
		}
		setStyle(style) {
			this.style = style;
		}
		setTerrain(terrain) {
			this.terrain = terrain;
		}
		easeTo(options) {
			this.ease = options;
		}
		flyTo(options) {
			this.fly = options;
		}
		fitBounds(bounds, options) {
			this.bounds = { bounds, options };
		}
	}

	class MockControl {}
	return {
		Map: MockMap,
		GeolocateControl: MockControl,
		NavigationControl: MockControl,
		setWorkerUrl: vi.fn()
	};
});

const locations = [
	{
		path: 'areas/alpine-crag',
		entry: {
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [16, 48] },
			properties: {
				id: 'alpine-crag',
				kind: 'crag',
				name: 'Alpine Crag',
				type: ['sports-climbing']
			}
		}
	},
	{
		path: 'areas/alpine-crag/north',
		entry: {
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [16.01, 48.01] },
			properties: { id: 'north', kind: 'sector', name: 'North' }
		}
	}
];

describe('ClimbingMap', () => {
	afterEach(() => cleanup());

	async function renderMap(props = {}) {
		render(ClimbingMap, { props: { locations, ...props } });
		await waitFor(() => expect(mapState.instance).toBeTruthy());
		return mapState.instance;
	}

	it('initializes MapLibre with the requested camera target', async () => {
		const map = await renderMap({ cameraTarget: { type: 'center', center: [10, 20], zoom: 12 } });

		expect(map.options.center).toEqual([10, 20]);
		expect(map.options.zoom).toBe(12);
		expect(map.options.style).toBe('/terrain.json');
	});

	it('loads places, topo paths, and access features into MapLibre sources and layers', async () => {
		const originalImage = globalThis.Image;
		globalThis.Image = class {
			set src(value) {
				this._src = value;
				queueMicrotask(() => this.onload?.());
			}
		};
		const topoPath = {
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [
					[16, 48],
					[16.01, 48.01]
				]
			},
			properties: { role: 'approach' }
		};
		const accessFeatures = [
			{
				type: 'Feature',
				geometry: {
					type: 'LineString',
					coordinates: [
						[16, 48],
						[16.02, 48.02]
					]
				},
				properties: { kind: 'approach' }
			},
			{
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [16.02, 48.02] },
				properties: { kind: 'parking', name: 'Parking' }
			}
		];

		try {
			const map = await renderMap({
				topoPaths: [topoPath],
				access: { type: 'FeatureCollection', features: accessFeatures },
				accessKey: 'fixture-access'
			});
			await map.handlers.get('load')();

			expect(map.getSource('places').data.features).toHaveLength(2);
			expect(map.getSource('topo-paths').data.features).toEqual([topoPath]);
			expect(map.getSource('access').data.features).toEqual(accessFeatures);
			expect(map.getLayer('places-dots')).toBeTruthy();
			expect(map.getLayer('places')).toBeTruthy();
			expect(map.getLayer('topo-paths')).toBeTruthy();
			expect(map.getLayer('access-lines')).toBeTruthy();
			expect(map.getLayer('access-points')).toBeTruthy();

			const placesFilter = createExpression(map.getLayer('places').filter, { type: 'boolean' });
			expect(placesFilter.result).toBe('success');
			const matchesPlace = (zoom, type, kind) =>
				placesFilter.value.evaluateWithoutErrorHandling({ zoom }, { type, properties: { kind } });
			expect(matchesPlace(15, 'Point', 'sector')).toBe(false);
			expect(matchesPlace(16, 'Point', 'sector')).toBe(true);
			expect(matchesPlace(18, 'Point', 'sector')).toBe(true);
			expect(matchesPlace(16, 'Polygon', 'sector')).toBe(false);
			expect(matchesPlace(14, 'Point', 'crag')).toBe(true);
			expect(matchesPlace(14, 'Polygon', 'crag')).toBe(false);
			expect(matchesPlace(14, 'Polygon', 'area')).toBe(false);

			const placesDotsFilter = createExpression(map.getLayer('places-dots').filter, {
				type: 'boolean'
			});
			expect(placesDotsFilter.result).toBe('success');
			const matchesPlacesDots = (zoom, type, kind) =>
				placesDotsFilter.value.evaluateWithoutErrorHandling(
					{ zoom },
					{ type, properties: { kind } }
				);
			expect(matchesPlacesDots(10, 'Point', 'crag')).toBe(true);
			expect(matchesPlacesDots(10, 'Polygon', 'crag')).toBe(false);
			expect(matchesPlacesDots(10, 'Point', 'sector')).toBe(false);
			expect(matchesPlacesDots(10, 'Polygon', 'sector')).toBe(false);
			expect(matchesPlacesDots(10, 'Point', 'area')).toBe(false);
			expect(matchesPlacesDots(10, 'Polygon', 'area')).toBe(false);

			map.setZoom(16);
			map.handlers.get('click:"places"')({
				features: [{ properties: { filePath: 'areas/alpine-crag/north' } }]
			});
			expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag/north');

			const evaluateIcon = (expression, properties) => {
				const compiled = createExpression(expression, latest.layout_symbol['icon-image']);
				expect(compiled.result).toBe('success');
				return compiled.value.evaluateWithoutErrorHandling(
					{ zoom: 14 },
					{ type: 'Point', properties },
					{},
					undefined,
					[...map.images.keys()]
				);
			};
			const iconExpression = map.getLayer('places').layout['icon-image'];
			expect(evaluateIcon(iconExpression, { type: ['sports-climbing'] }).name).toBe(
				'sports-climbing'
			);
			expect(evaluateIcon(iconExpression, { type: ['multi-pitch', 'sports-climbing'] }).name).toBe(
				'multi-pitch'
			);
			expect(evaluateIcon(iconExpression, { type: ['sports-climbing', 'multi-pitch'] }).name).toBe(
				'multi-pitch'
			);
			expect(evaluateIcon(iconExpression, { type: ['bouldering', 'sports-climbing'] }).name).toBe(
				'sports-climbing'
			);
			expect(evaluateIcon(iconExpression, { type: ['bouldering', 'multi-pitch'] }).name).toBe(
				'multi-pitch'
			);
			expect(
				evaluateIcon(iconExpression, { primaryType: 'multi-pitch', type: ['sports-climbing'] }).name
			).toBe('multi-pitch');
			expect(evaluateIcon(iconExpression, { type: [] })).toBeNull();
			expect(evaluateIcon(iconExpression, { kind: 'area' })).toBeNull();
			const resetExpression = map.layoutCalls.findLast((call) => call[1] === 'icon-image')[2];
			expect(evaluateIcon(resetExpression, { type: ['sports-climbing'] }).name).toBe(
				'sports-climbing'
			);

			map.setZoom(8);
			map.handlers.get('click:"places-dots"')({
				features: [{ properties: { filePath: 'areas/alpine-crag' } }]
			});
			const selectedExpression = map.layoutCalls.findLast((call) => call[1] === 'icon-image')[2];
			expect(
				evaluateIcon(selectedExpression, {
					type: ['sports-climbing'],
					filePath: 'areas/alpine-crag'
				}).name
			).toBe('selected-marker');
			expect(
				evaluateIcon(selectedExpression, {
					type: ['sports-climbing'],
					filePath: 'areas/other-crag'
				}).name
			).toBe('sports-climbing');

			const accessIconExpression = map.getLayer('access-points').layout['icon-image'];
			expect(evaluateIcon(accessIconExpression, { kind: 'parking' }).name).toBe('access-parking');
			expect(evaluateIcon(accessIconExpression, { kind: 'hut' }).name).toBe('access-hut');
			expect(evaluateIcon(accessIconExpression, { kind: 'transit', mode: 'train' }).name).toBe(
				'access-train'
			);
			expect(evaluateIcon(accessIconExpression, { kind: 'transit', mode: 'bus' }).name).toBe(
				'access-bus'
			);
			expect(map.images.has('parking')).toBe(false);
		} finally {
			globalThis.Image = originalImage;
		}
	});

	it('continues syncing topo paths and access features when map.isStyleLoaded() returns false during tile loads or source updates', async () => {
		const originalImage = globalThis.Image;
		globalThis.Image = class {
			set src(value) {
				this._src = value;
				queueMicrotask(() => this.onload?.());
			}
		};
		const topoPath = {
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [
					[16, 48],
					[16.01, 48.01]
				]
			},
			properties: { role: 'approach' }
		};
		const accessFeatures = [
			{
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [16.02, 48.02] },
				properties: { kind: 'parking', name: 'Parking' }
			}
		];

		try {
			const view = render(ClimbingMap, {
				props: {
					locations,
					topoPaths: [],
					access: null,
					accessKey: ''
				}
			});
			await waitFor(() => expect(mapState.instance).toBeTruthy());
			const map = mapState.instance;
			await map.handlers.get('load')();

			// Simulate MapLibre returning false from isStyleLoaded() while flying / loading tiles / dirty sources
			map.isStyleLoaded = () => false;

			await view.rerender({
				locations,
				topoPaths: [topoPath],
				access: { type: 'FeatureCollection', features: accessFeatures },
				accessKey: 'areas/alpine-crag'
			});

			expect(map.getLayer('topo-paths-outline')).toBeTruthy();
			expect(map.getLayer('topo-paths')).toBeTruthy();
			expect(map.getSource('topo-paths').setData).toHaveBeenCalledWith({
				type: 'FeatureCollection',
				features: [topoPath]
			});
			expect(map.getLayer('access-lines-outline')).toBeTruthy();
			expect(map.getLayer('access-lines')).toBeTruthy();
			expect(map.getLayer('access-dots')).toBeTruthy();
			expect(map.getLayer('access-points')).toBeTruthy();
			expect(map.getLayer('places').minzoom).toBe(0);
			expect(map.getSource('access').setData).toHaveBeenCalledWith({
				type: 'FeatureCollection',
				features: accessFeatures
			});

			const layerIds = [...map.layers.keys()];
			expect(layerIds.indexOf('access-lines-outline')).toBeLessThan(
				layerIds.indexOf('access-lines')
			);
			expect(layerIds.indexOf('access-lines')).toBeLessThan(layerIds.indexOf('access-dots'));
			expect(layerIds.indexOf('topo-paths-outline')).toBeLessThan(layerIds.indexOf('topo-paths'));
			expect(layerIds.indexOf('topo-paths')).toBeLessThan(layerIds.indexOf('access-dots'));
			expect(layerIds.indexOf('access-dots')).toBeLessThan(layerIds.indexOf('places-dots'));
			expect(layerIds.indexOf('places-dots')).toBeLessThan(layerIds.indexOf('access-points'));
			expect(layerIds.indexOf('access-points')).toBeLessThan(layerIds.indexOf('places'));
		} finally {
			globalThis.Image = originalImage;
		}
	});

	it('switches tile styles from the accessible style controls', async () => {
		const map = await renderMap();
		await fireEvent.mouseEnter(screen.getByRole('button', { name: 'Choose map style' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Show satellite map' }));
		expect(map.style).toBe('/satellite.json');
	});

	it('navigates from low-zoom place dots and high-zoom place labels', async () => {
		const map = await renderMap();
		const lowZoomClick = map.handlers.get('click:"places-dots"');
		const highZoomClick = map.handlers.get('click:"places"');
		const event = {
			features: [
				{ properties: { filePath: 'areas/alpine-crag' }, geometry: { coordinates: [16, 48] } }
			]
		};

		map.setZoom(8);
		lowZoomClick(event);
		expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag');

		vi.mocked(goto).mockClear();
		map.setZoom(13);
		highZoomClick(event);
		expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag');
	});

	it('waits for navigation before the camera can update the URL hash', async () => {
		const map = await renderMap();
		let finishNavigation;
		vi.mocked(goto).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishNavigation = resolve;
				})
		);

		map.handlers.get('click:"places-dots"')({
			features: [{ properties: { filePath: 'areas/alpine-crag' } }]
		});
		expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag');
		expect(map.fly).toBeUndefined();

		finishNavigation();
		await waitFor(() => expect(map.fly).toMatchObject({ center: [16, 48], zoom: 16 }));
	});

	it('navigates from sector layers and focuses the map on a custom event', async () => {
		const map = await renderMap();
		const sectorClick = map.handlers.get('click:["sector-fill","sector-line"]');
		sectorClick({
			features: [{ properties: { filePath: 'areas/alpine-crag/north' } }],
			lngLat: { toArray: () => [16.01, 48.01] }
		});
		expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag/north');

		window.dispatchEvent(
			new CustomEvent('crag-review:focus-map-target', {
				detail: { center: [16, 48], zoom: 15, path: 'areas/alpine-crag' }
			})
		);
		expect(map.fly.center).toEqual([16, 48]);
		expect(map.fly.zoom).toBe(15);

		window.dispatchEvent(
			new CustomEvent('crag-review:focus-map-target', {
				detail: {
					bounds: [
						[15.9, 47.9],
						[16.1, 48.1]
					],
					padding: 80,
					maxZoom: 14,
					path: 'areas/alpine-crag'
				}
			})
		);
		expect(map.bounds.bounds).toEqual([
			[15.9, 47.9],
			[16.1, 48.1]
		]);
		expect(map.bounds.options.maxZoom).toBe(14);
	});

	it('renders crag and area polygon layers and handles area fitBounds', async () => {
		const originalImage = globalThis.Image;
		globalThis.Image = class {
			set src(value) {
				this._src = value;
				queueMicrotask(() => this.onload?.());
			}
		};

		const customLocations = [
			{
				path: 'areas/val-valley',
				entry: {
					type: 'Feature',
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[15.9, 47.9],
								[16.1, 47.9],
								[16.1, 48.1],
								[15.9, 48.1],
								[15.9, 47.9]
							]
						]
					},
					properties: { id: 'val-valley', kind: 'area', name: 'Val Valley' }
				}
			},
			{
				path: 'areas/val-valley/rock',
				entry: {
					type: 'Feature',
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[16.0, 48.0],
								[16.02, 48.0],
								[16.02, 48.02],
								[16.0, 48.02],
								[16.0, 48.0]
							]
						]
					},
					properties: {
						id: 'rock',
						kind: 'crag',
						name: 'Rock',
						type: ['sports-climbing']
					}
				}
			},
			{
				path: 'areas/val-valley/rock/wall',
				entry: {
					type: 'Feature',
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[16.005, 48.005],
								[16.015, 48.005],
								[16.015, 48.015],
								[16.005, 48.015],
								[16.005, 48.005]
							]
						]
					},
					properties: {
						id: 'wall',
						kind: 'sector',
						name: 'Wall',
						type: ['multi-pitch']
					}
				}
			}
		];

		try {
			const map = await renderMap({ locations: customLocations });
			await map.handlers.get('load')();

			expect(map.getLayer('area-fill')).toBeTruthy();
			expect(map.getLayer('area-selected-casing')).toBeTruthy();
			expect(map.getLayer('area-line')).toBeTruthy();
			expect(map.getLayer('crag-fill')).toBeTruthy();
			expect(map.getLayer('crag-selected-casing')).toBeTruthy();
			expect(map.getLayer('crag-line')).toBeTruthy();
			expect(map.getLayer('sector-selected-casing')).toBeTruthy();

			// Clicking a crag polygon navigates to the crag
			const cragPolyClick = map.handlers.get('click:["crag-fill","crag-line"]');
			cragPolyClick({
				features: [{ properties: { filePath: 'areas/val-valley/rock' } }]
			});
			expect(goto).toHaveBeenCalledWith('/map/crag/areas/val-valley/rock');

			// Clicking an area polygon fits the map to the area bounds
			const areaPolyClick = map.handlers.get('click:["area-fill","area-line"]');
			areaPolyClick({
				features: [{ properties: { filePath: 'areas/val-valley' } }]
			});
			expect(goto).toHaveBeenCalledWith('/map/crag/areas/val-valley');
			await waitFor(() => expect(map.bounds).toBeTruthy());
			expect(map.bounds.options.maxZoom).toBe(14);

			// Test click priority: sectors take precedence over crags
			vi.mocked(goto).mockClear();
			const originalEvent = {};
			const sectorClick = map.handlers.get('click:["sector-fill","sector-line"]');
			sectorClick({
				originalEvent,
				features: [{ properties: { filePath: 'areas/val-valley/rock/wall' } }]
			});
			expect(goto).toHaveBeenCalledWith('/map/crag/areas/val-valley/rock/wall');

			// Crag handler ignores click because sector already handled it
			cragPolyClick({
				originalEvent,
				features: [{ properties: { filePath: 'areas/val-valley/rock' } }]
			});
			// Should still be sector, NOT crag
			expect(goto).not.toHaveBeenCalledWith('/map/crag/areas/val-valley/rock');

			const cragFillOpacityCall = map.paintCalls.findLast(
				(call) => call[0] === 'crag-fill' && call[1] === 'fill-opacity'
			);
			if (cragFillOpacityCall) {
				const compiled = createExpression(
					cragFillOpacityCall[2],
					latest.paint_fill['fill-opacity']
				);
				expect(compiled.result).toBe('success');
			}
		} finally {
			globalThis.Image = originalImage;
		}
	});

	it('handles clicks on main route paths and highlights selected route main path', async () => {
		const originalImage = globalThis.Image;
		globalThis.Image = class {
			onload = null;
			set src(_) {
				this.onload?.();
			}
		};

		const routePath = {
			type: 'Feature',
			id: 'main-1',
			geometry: {
				type: 'LineString',
				coordinates: [
					[16.0, 48.0],
					[16.01, 48.01]
				]
			},
			properties: {
				role: 'main',
				routeId: 'route-123',
				targetPath: 'areas/alpine-crag/north',
				routeType: 'sports-climbing'
			}
		};

		try {
			const view = render(ClimbingMap, {
				props: {
					locations: [],
					topoPaths: [routePath],
					access: null,
					accessKey: 'test',
					selectedRouteId: null
				}
			});
			await waitFor(() => expect(mapState.instance).toBeTruthy());
			const map = mapState.instance;
			await map.handlers.get('load')();

			expect(map.getLayer('topo-paths-selected-glow')).toBeTruthy();
			expect(map.getLayer('topo-paths-selected-casing')).toBeTruthy();
			expect(map.getLayer('topo-paths-selected')).toBeTruthy();
			expect(map.getLayer('topo-paths-selected').paint['line-color']).toBe('#dc2626');
			expect(map.getLayer('topo-paths-selected-glow').paint['line-color']).toBe('#dc2626');

			// When selectedRouteId is null, highlight filter matches nothing
			expect(map.getLayer('topo-paths-selected').filter).toEqual([
				'==',
				['get', 'role'],
				'impossible_none'
			]);

			// Test click on topo path
			vi.mocked(goto).mockClear();
			const topoPathClick = map.handlers.get(
				'click:' +
					JSON.stringify([
						'topo-paths',
						'topo-paths-outline',
						'topo-paths-selected',
						'topo-paths-selected-casing',
						'topo-paths-selected-glow'
					])
			);
			expect(topoPathClick).toBeTruthy();

			const clickEvent = {
				originalEvent: {},
				features: [routePath]
			};
			topoPathClick(clickEvent);
			expect(clickEvent.originalEvent._felsHandled).toBe(true);
			expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag/north/route-123');

			// Rerender with selectedRouteId
			await view.rerender({
				locations: [],
				topoPaths: [routePath],
				access: null,
				accessKey: 'test',
				selectedRouteId: 'route-123'
			});

			// Now highlight filter targets route-123
			const selectedFilter = map.getLayer('topo-paths-selected').filter;
			expect(selectedFilter).toEqual([
				'all',
				['==', ['get', 'role'], 'main'],
				['any', ['==', ['get', 'routeId'], 'route-123'], ['==', ['get', 'routeId'], '']]
			]);
		} finally {
			globalThis.Image = originalImage;
		}
	});

	it('adds topo paths when navigating from an empty state to a route with topo paths', async () => {
		const originalImage = globalThis.Image;
		globalThis.Image = class {
			onload = null;
			set src(_) {
				this.onload?.();
			}
		};

		const routePath = {
			type: 'Feature',
			id: 'main-1',
			geometry: {
				type: 'LineString',
				coordinates: [
					[16.0, 48.0],
					[16.01, 48.01]
				]
			},
			properties: {
				role: 'main',
				routeId: 'route-123',
				targetPath: 'areas/alpine-crag/north',
				routeType: 'sports-climbing'
			}
		};

		try {
			const view = render(ClimbingMap, {
				props: {
					locations: [],
					topoPaths: [],
					topoPathsKey: '',
					access: null,
					accessKey: '',
					selectedRouteId: null
				}
			});
			await waitFor(() => expect(mapState.instance).toBeTruthy());
			const map = mapState.instance;
			await map.handlers.get('load')();

			expect(map.getLayer('topo-paths')).toBeNull();

			await view.rerender({
				locations: [],
				topoPaths: [routePath],
				topoPathsKey: 'map/crag/areas/alpine-crag/north/route-123:route-123:main-1',
				access: null,
				accessKey: '',
				selectedRouteId: 'route-123'
			});

			expect(map.getLayer('topo-paths')).toBeTruthy();
			expect(map.getSource('topo-paths')).toBeTruthy();
		} finally {
			globalThis.Image = originalImage;
		}
	});
});
