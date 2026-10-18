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
		default: {
			Map: MockMap,
			GeolocateControl: MockControl,
			NavigationControl: MockControl
		}
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
		const sectorClick = map.handlers.get('click:["sector-fill","sector-line","sector-labels"]');
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
	});
});
