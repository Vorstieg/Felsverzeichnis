import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import ClimbingMap from '$lib/components/ClimbingMap.svelte';

const mapState = vi.hoisted(() => ({ instance: null }));

vi.mock('maplibre-gl', () => {
	class MockMap {
		constructor(options) {
			this.options = options;
			this.handlers = new Map();
			this.zoom = options.zoom;
			this.canvas = { style: {} };
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

		addControl(control) {
			this.controls.push(control);
		}
		getCanvas() {
			return this.canvas;
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
		addLayer(layer) {
			this.layers.set(layer.id, layer);
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
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [16, 48] },
		properties: { path: 'areas/alpine-crag', type: 'sports-climbing' }
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
		const map = await renderMap({ cameraTarget: { center: [10, 20], zoom: 12 } });

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
			geometry: { type: 'LineString', coordinates: [[16, 48], [16.01, 48.01]] },
			properties: { role: 'approach' }
		};
		const accessFeatures = [
			{
				type: 'Feature',
				geometry: { type: 'LineString', coordinates: [[16, 48], [16.02, 48.02]] },
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

			expect(map.getSource('places').data.features).toHaveLength(1);
			expect(map.getSource('topo-paths').data.features).toEqual([topoPath]);
			expect(map.getSource('access').data.features).toEqual(accessFeatures);
			expect(map.getLayer('places-dots')).toBeTruthy();
			expect(map.getLayer('places')).toBeTruthy();
			expect(map.getLayer('topo-paths')).toBeTruthy();
			expect(map.getLayer('access-lines')).toBeTruthy();
			expect(map.getLayer('access-points')).toBeTruthy();
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

	it('toggles terrain and pitch through the 3D control', async () => {
		const map = await renderMap();
		const toggle = screen.getByRole('button', { name: '2D' });
		await fireEvent.click(toggle);
		expect(map.terrain).toEqual({ source: 'globalTerrainSource', exaggeration: 1 });
		expect(map.ease).toEqual({ pitch: 60 });
		expect(screen.getByRole('button', { name: '3D' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: '3D' }));
		expect(map.terrain).toBeNull();
		expect(map.ease).toEqual({ pitch: 0 });
	});

	it('navigates from low-zoom place dots and high-zoom place labels', async () => {
		const map = await renderMap();
		const lowZoomClick = map.handlers.get('click:"places-dots"');
		const highZoomClick = map.handlers.get('click:"places"');
		const event = {
			features: [{ properties: { path: 'areas/alpine-crag' }, geometry: { coordinates: [16, 48] } }]
		};

		map.setZoom(8);
		lowZoomClick(event);
		expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag');

		vi.mocked(goto).mockClear();
		map.setZoom(13);
		highZoomClick(event);
		expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag');
	});

	it('navigates from sector layers and focuses the map on a custom event', async () => {
		const map = await renderMap();
		const sectorClick = map.handlers.get('click:["sector-fill","sector-line","sector-labels"]');
		sectorClick({
			features: [{ properties: { path: 'areas/alpine-crag/north' } }],
			lngLat: { toArray: () => [16.01, 48.01] }
		});
		expect(goto).toHaveBeenCalledWith('/map/crag/areas/alpine-crag/north');

		window.dispatchEvent(
			new CustomEvent('crag-review:focus-map-target', {
				detail: { center: [16, 48], zoom: 15, path: 'areas/alpine-crag' }
			})
		);
		expect(map.ease.center).toEqual([16, 48]);
		expect(map.ease.zoom).toBe(15);
	});
});
