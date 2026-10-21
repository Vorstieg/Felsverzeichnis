<script lang="ts">
	import { base } from '$app/paths';
	import { page, navigating } from '$app/stores';
	import { slide } from 'svelte/transition';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { slowRasterTileDecay } from '$lib/assets/js/map-raster-lod.js';
	import { searchSuggestionsActive } from '$lib/stores/search.js';
	import { getGeometryCenter } from '$lib/assets/js/topo-loader-utils.js';
	import { getGeometryBounds } from '$lib/assets/js/map-camera.js';
	import { colors } from '$lib/colors.js';
	import {
		createPlacesData,
		createTopoPathsData,
		getMapPadding as calculateMapPadding,
		selectionExpression
	} from '$lib/assets/js/climbing-map-utils.js';

	import type {
		LayerSpecification,
		ExpressionSpecification,
		GeoJSONSource,
		LngLatLike,
		PaddingOptions,
		MapGeoJSONFeature
	} from 'maplibre-gl';
	import type { FelsLocation } from '$lib/types/files';
	import type { AccessCollection, MapCameraTarget, MapFocusTarget } from '$lib/types/application';
	import type { PathFeature } from '@vorstieg/fels-types/types';
	let {
		locations = [],
		access = null,
		topoPaths = [],
		accessKey = '',
		cameraTarget = null,
		isHidden = false
	}: {
		locations?: FelsLocation[];
		access?: AccessCollection | null;
		topoPaths?: PathFeature[];
		accessKey?: string;
		cameraTarget?: MapCameraTarget | null;
		isHidden?: boolean;
	} = $props();

	let mapElement: HTMLDivElement;
	let map: maplibregl.Map;
	let mapReady = $state(false);
	let tileLayerMenuOpen = $state(false);
	let isTouchStyleMenu = false;
	let currentPathname = $derived($navigating?.to?.url?.pathname ?? $page.url.pathname);
	let detailsShown = $derived(
		currentPathname !== base + '/map' && currentPathname !== base + '/map/'
	);

	const placeType: ExpressionSpecification = [
		'case',
		['!=', ['coalesce', ['get', 'primaryType'], ''], ''],
		['get', 'primaryType'],
		['in', 'multi-pitch', ['coalesce', ['get', 'type'], ['literal', []]]],
		'multi-pitch',
		['in', 'sports-climbing', ['coalesce', ['get', 'type'], ['literal', []]]],
		'sports-climbing',
		['in', 'bouldering', ['coalesce', ['get', 'type'], ['literal', []]]],
		'bouldering',
		['in', 'trad', ['coalesce', ['get', 'type'], ['literal', []]]],
		'trad',
		['in', 'alpine-tour', ['coalesce', ['get', 'type'], ['literal', []]]],
		'alpine-tour',
		['in', 'via-ferrata', ['coalesce', ['get', 'type'], ['literal', []]]],
		'via-ferrata',
		['>', ['length', ['coalesce', ['get', 'type'], ['literal', []]]], 0],
		['at', 0, ['get', 'type']],
		''
	];
	const placeIcon: ExpressionSpecification = ['image', placeType];

	const placeTypeColor: ExpressionSpecification = [
		'match',
		placeType,
		'sports-climbing',
		colors.routeTypes['sports-climbing'],
		'multi-pitch',
		colors.routeTypes['multi-pitch'],
		'bouldering',
		colors.routeTypes.bouldering,
		'trad',
		colors.routeTypes.trad,
		'alpine-tour',
		colors.routeTypes['alpine-tour'],
		'via-ferrata',
		colors.routeTypes['via-ferrata'],
		colors.routeTypes['sports-climbing']
	];

	const defaultPlacesFilter: ExpressionSpecification = [
		'all',
		['!=', ['get', 'kind'], 'area'],
		['==', ['geometry-type'], 'Point'],
		['any', ['!=', ['get', 'kind'], 'sector'], ['>=', ['zoom'], 16]]
	];

	const placesLayer: LayerSpecification = {
		id: 'places',
		type: 'symbol',
		source: 'places',
		minzoom: 0,
		filter: defaultPlacesFilter,
		layout: {
			'icon-image': placeIcon,
			'icon-size': 0.55,
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'symbol-z-order': 'source',
			'text-optional': true,
			'text-field': ['get', 'name'],
			'text-offset': [0, 1.8],
			'text-anchor': 'top',
			'text-font': ['Noto Sans Bold'],
			'text-size': 14,
			visibility: 'visible',
			'text-max-width': 8
		},
		paint: {
			'text-color': colors.text.ink,
			'text-halo-blur': 0,
			'text-halo-color': colors.text.white,
			'text-halo-width': 3,
			'icon-opacity': ['step', ['zoom'], 0, 13.5, 1],
			'icon-opacity-transition': { duration: 400 },
			'text-opacity': ['step', ['zoom'], 0, 13.5, 1],
			'text-opacity-transition': { duration: 400 }
		}
	};

	const placesDotsLayer: LayerSpecification = {
		id: 'places-dots',
		type: 'circle',
		source: 'places',
		maxzoom: 14,
		filter: [
			'all',
			['==', ['geometry-type'], 'Point'],
			['==', ['get', 'kind'], 'crag'],
			['>=', ['zoom'], 0]
		],
		paint: {
			'circle-color': placeTypeColor,
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 12, 4.5],
			'circle-radius-transition': { duration: 400 },
			'circle-stroke-width': 15,
			'circle-stroke-color': 'rgba(0, 0, 0, 0)',
			'circle-opacity': ['step', ['zoom'], 1, 13.5, 0],
			'circle-opacity-transition': { duration: 400 },
			'circle-stroke-opacity': ['step', ['zoom'], 1, 13.5, 0],
			'circle-stroke-opacity-transition': { duration: 400 }
		}
	};

	const defaultAreaFilter: ExpressionSpecification = [
		'all',
		['==', ['geometry-type'], 'Polygon'],
		['==', ['get', 'kind'], 'area'],
		['==', ['get', 'filePath'], '']
	];

	const areaFillLayer: LayerSpecification = {
		id: 'area-fill',
		type: 'fill',
		source: 'places',
		filter: defaultAreaFilter,
		paint: { 'fill-color': colors.text.ink, 'fill-opacity': 0.04 }
	};

	const areaSelectedCasingLayer: LayerSpecification = {
		id: 'area-selected-casing',
		type: 'line',
		source: 'places',
		filter: defaultAreaFilter,
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': '#ffffff',
			'line-width': 4.5,
			'line-opacity': 0.8
		}
	};

	const areaLineLayer: LayerSpecification = {
		id: 'area-line',
		type: 'line',
		source: 'places',
		filter: defaultAreaFilter,
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': colors.text.ink,
			'line-width': 2,
			'line-opacity': 0.75,
			'line-dasharray': [3, 2]
		}
	};

	const defaultCragFilter: ExpressionSpecification = [
		'all',
		['==', ['geometry-type'], 'Polygon'],
		['==', ['get', 'kind'], 'crag'],
		['>=', ['zoom'], 13.5]
	];

	const cragFillLayer: LayerSpecification = {
		id: 'crag-fill',
		type: 'fill',
		source: 'places',
		filter: defaultCragFilter,
		paint: {
			'fill-color': placeTypeColor,
			'fill-opacity': ['step', ['zoom'], 0.12, 16, ['case', ['get', 'hasSectors'], 0, 0.12]]
		}
	};

	const cragSelectedCasingLayer: LayerSpecification = {
		id: 'crag-selected-casing',
		type: 'line',
		source: 'places',
		filter: [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'crag'],
			['==', ['get', 'filePath'], '']
		],
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': '#ffffff',
			'line-width': 4.5,
			'line-opacity': 0.8
		}
	};

	const cragLineLayer: LayerSpecification = {
		id: 'crag-line',
		type: 'line',
		source: 'places',
		filter: defaultCragFilter,
		paint: {
			'line-color': placeTypeColor,
			'line-width': 2,
			'line-opacity': 0.7,
			'line-dasharray': ['case', ['get', 'hasSectors'], ['literal', [2, 2]], ['literal', [1]]]
		}
	};

	const defaultSectorFilter: ExpressionSpecification = [
		'all',
		['==', ['geometry-type'], 'Polygon'],
		['==', ['get', 'kind'], 'sector'],
		['>=', ['zoom'], 16]
	];

	const sectorFillLayer: LayerSpecification = {
		id: 'sector-fill',
		type: 'fill',
		source: 'places',
		filter: defaultSectorFilter,
		paint: { 'fill-color': placeTypeColor, 'fill-opacity': 0.12 }
	};

	const sectorSelectedCasingLayer: LayerSpecification = {
		id: 'sector-selected-casing',
		type: 'line',
		source: 'places',
		filter: [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'sector'],
			['==', ['get', 'filePath'], '']
		],
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': '#ffffff',
			'line-width': 4.5,
			'line-opacity': 0.8
		}
	};

	const sectorLineLayer: LayerSpecification = {
		id: 'sector-line',
		type: 'line',
		source: 'places',
		filter: defaultSectorFilter,
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: { 'line-color': placeTypeColor, 'line-width': 2, 'line-opacity': 0.7 }
	};

	const sectorLabelsLayer: LayerSpecification = {
		id: 'sector-labels',
		type: 'symbol',
		source: 'places',
		filter: [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'sector'],
			['>=', ['zoom'], 16],
			['has', 'name']
		],
		layout: {
			'text-field': ['get', 'name'],
			'text-size': 12,
			'text-anchor': 'center',
			'text-allow-overlap': false
		},
		paint: {
			'text-color': colors.map.sectorText,
			'text-halo-color': colors.map.sectorTextHalo,
			'text-halo-width': 2
		}
	};

	const accessLineOutlineLayer: LayerSpecification = {
		id: 'access-lines-outline',
		type: 'line',
		source: 'access',
		filter: ['==', ['get', 'kind'], 'approach'],
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': colors.text.white,
			'line-width': 6.5,
			'line-opacity': 0.95
		}
	};

	const accessLineLayer: LayerSpecification = {
		id: 'access-lines',
		type: 'line',
		source: 'access',
		filter: ['==', ['get', 'kind'], 'approach'],
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': colors.gpxRoles.approach,
			'line-width': 4,
			'line-dasharray': [0.1, 1.8],
			'line-opacity': 0.95
		}
	};

	const accessPointColor: ExpressionSpecification = [
		'match',
		['get', 'kind'],
		'hut',
		colors.routeTypes.trad,
		'#000000'
	];

	const accessDotsLayer: LayerSpecification = {
		id: 'access-dots',
		type: 'circle',
		source: 'access',
		maxzoom: 14,
		filter: ['==', ['geometry-type'], 'Point'],
		paint: {
			'circle-color': accessPointColor,
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 12, 4.5],
			'circle-radius-transition': { duration: 400 },
			'circle-stroke-width': 15,
			'circle-stroke-color': 'rgba(0, 0, 0, 0)',
			'circle-opacity': ['step', ['zoom'], 1, 13.5, 0],
			'circle-opacity-transition': { duration: 400 },
			'circle-stroke-opacity': ['step', ['zoom'], 1, 13.5, 0],
			'circle-stroke-opacity-transition': { duration: 400 }
		}
	};

	const accessPointsLayer: LayerSpecification = {
		id: 'access-points',
		type: 'symbol',
		source: 'access',
		minzoom: 11.5,
		filter: ['==', ['geometry-type'], 'Point'],
		layout: {
			'icon-image': [
				'match',
				['get', 'kind'],
				'parking',
				'access-parking',
				'hut',
				'access-hut',
				'transit',
				[
					'match',
					['coalesce', ['get', 'mode'], 'bus'],
					'train',
					'access-train',
					'bus',
					'access-bus',
					'access-bus'
				],
				'access-bus'
			],
			'icon-size': 0.65,
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-offset': [
				'match',
				['get', 'kind'],
				'parking',
				['literal', [0, -8]],
				['literal', [0, 8]]
			],
			'text-optional': true,
			'text-field': ['get', 'name'],
			'text-offset': [0, 1.8],
			'text-anchor': 'top',
			'text-font': ['Noto Sans Bold'],
			'text-size': 14,
			'text-max-width': 8
		},
		paint: {
			'text-color': colors.text.ink,
			'text-halo-color': colors.text.white,
			'text-halo-width': 3,
			'icon-opacity': ['step', ['zoom'], 0, 13.5, 1],
			'icon-opacity-transition': { duration: 400 },
			'text-opacity': ['step', ['zoom'], 0, 13.5, 1],
			'text-opacity-transition': { duration: 400 }
		}
	};

	const topoPathsOutlineLayer: LayerSpecification = {
		id: 'topo-paths-outline',
		type: 'line',
		source: 'topo-paths',
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': colors.text.white,
			'line-width': 6.5,
			'line-opacity': 0.95
		}
	};

	const topoPathsLayer: LayerSpecification = {
		id: 'topo-paths',
		type: 'line',
		source: 'topo-paths',
		layout: { 'line-cap': 'round', 'line-join': 'round' },
		paint: {
			'line-color': [
				'case',
				['==', ['get', 'role'], 'main'],
				[
					'match',
					['get', 'routeType'],
					'sports-climbing',
					colors.routeTypes['sports-climbing'],
					'multi-pitch',
					colors.routeTypes['multi-pitch'],
					'bouldering',
					colors.routeTypes.bouldering,
					'trad',
					colors.routeTypes.trad,
					'alpine-tour',
					colors.routeTypes['alpine-tour'],
					'via-ferrata',
					colors.routeTypes['via-ferrata'],
					colors.topoPaths.main
				],
				[
					'match',
					['get', 'role'],
					'approach',
					colors.topoPaths.approach,
					'descent',
					colors.topoPaths.descent,
					'variant',
					colors.topoPaths.variant,
					'fixedRope',
					colors.topoPaths.fixedRope,
					colors.topoPaths.main
				]
			],
			'line-width': 4,
			'line-dasharray': [
				'case',
				['in', ['get', 'role'], ['literal', ['approach', 'descent']]],
				['literal', [0.1, 1.8]],
				['literal', [1]]
			],
			'line-opacity': 0.9
		}
	};

	onMount(async () => {
		map = new maplibregl.Map({
			container: mapElement,
			zoom: cameraTarget?.type === 'center' ? cameraTarget.zoom : 8,
			center: cameraTarget?.type === 'center' ? cameraTarget.center : [16.0, 48.0],
			pitch: 0,
			hash: true,
			style: base + '/terrain.json',
			maxZoom: 18,
			maxPitch: 75
		});
		if (import.meta.env.DEV && typeof window !== 'undefined') window.__climbingMap = map;

		map.addControl(
			new maplibregl.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true
				},
				trackUserLocation: true
			})
		);

		map.addControl(
			new maplibregl.NavigationControl({
				showZoom: false,
				visualizePitch: true
			})
		);

		map.getCanvas().style.cursor = 'default';

		map.on('click', 'places', (e) => {
			if ((e.originalEvent as unknown as Record<string, boolean> | undefined)?._felsHandled) return;
			if (e.point && map.queryRenderedFeatures?.(e.point, { layers: sectorLayerIds })?.length) {
				return;
			}
			if (e.originalEvent) {
				(e.originalEvent as unknown as Record<string, boolean>)._felsHandled = true;
			}
			if (map.getZoom() >= 12.0 && e.features?.[0]) {
				openFeature(e.features[0]);
			}
		});

		map.on('load', async () => {
			await drawLayers();
			applyCameraTarget();
			updateSelectionStyle($page.params.crag || '');
			slowRasterTileDecay(map);
		});
		map.on('style.load', async () => {
			if (map.getSource('places')) {
				return; // Places already exists, meaning this is not a fresh style load that wiped our sources
			}
			await drawLayers();
			slowRasterTileDecay(map);
			applyCameraTarget();
			updateSelectionStyle($page.params.crag || '');
		});

		map.on('mouseenter', 'places', function (e) {
			if (e.point && map.queryRenderedFeatures?.(e.point, { layers: sectorLayerIds })?.length) {
				return;
			}
			if (map.getZoom() >= 12.0) {
				map.getCanvas().style.cursor = 'pointer';
			}
		});

		map.on('mouseleave', 'places', function () {
			map.getCanvas().style.cursor = 'default';
		});

		map.on('mouseenter', 'places-dots', function () {
			if (map.getZoom() < 12.0) {
				map.getCanvas().style.cursor = 'pointer';
			}
		});

		map.on('mouseleave', 'places-dots', function () {
			map.getCanvas().style.cursor = 'default';
		});

		map.on('click', 'places-dots', (e) => {
			if ((e.originalEvent as unknown as Record<string, boolean> | undefined)?._felsHandled) return;
			if (e.originalEvent) {
				(e.originalEvent as unknown as Record<string, boolean>)._felsHandled = true;
			}
			if (map.getZoom() < 12.0 && e.features?.[0]) {
				openFeature(e.features[0]);
			}
		});

		const sectorLayerIds = ['sector-fill', 'sector-line', 'sector-labels'];
		map.on('mouseenter', sectorLayerIds, () => {
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', sectorLayerIds, () => {
			map.getCanvas().style.cursor = 'default';
		});
		map.on('click', sectorLayerIds, (e) => {
			if (e.originalEvent) {
				(e.originalEvent as unknown as Record<string, boolean>)._felsHandled = true;
			}
			const feature = e.features?.[0];
			if (feature) openFeature(feature);
		});

		map.on('mouseenter', 'sector-selected-casing', () => {
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', 'sector-selected-casing', () => {
			map.getCanvas().style.cursor = 'default';
		});
		map.on('click', 'sector-selected-casing', (e) => {
			if (e.originalEvent) {
				(e.originalEvent as unknown as Record<string, boolean>)._felsHandled = true;
			}
			const feature = e.features?.[0];
			if (feature) openFeature(feature);
		});

		map.on('mouseenter', 'crag-selected-casing', (e) => {
			if (e.point && map.queryRenderedFeatures?.(e.point, { layers: sectorLayerIds })?.length) {
				return;
			}
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', 'crag-selected-casing', () => {
			map.getCanvas().style.cursor = 'default';
		});
		map.on('click', 'crag-selected-casing', (e) => {
			if ((e.originalEvent as unknown as Record<string, boolean> | undefined)?._felsHandled) return;
			if (e.point && map.queryRenderedFeatures?.(e.point, { layers: sectorLayerIds })?.length) {
				return;
			}
			if (e.originalEvent) {
				(e.originalEvent as unknown as Record<string, boolean>)._felsHandled = true;
			}
			const feature = e.features?.[0];
			if (feature) openFeature(feature);
		});

		map.on('mouseenter', 'area-selected-casing', (e) => {
			if (
				e.point &&
				map.queryRenderedFeatures?.(e.point, {
					layers: [...sectorLayerIds, ...cragPolygonLayerIds]
				})?.length
			) {
				return;
			}
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', 'area-selected-casing', () => {
			map.getCanvas().style.cursor = 'default';
		});
		map.on('click', 'area-selected-casing', (e) => {
			if ((e.originalEvent as unknown as Record<string, boolean> | undefined)?._felsHandled) return;
			if (
				e.point &&
				map.queryRenderedFeatures?.(e.point, {
					layers: [...sectorLayerIds, ...cragPolygonLayerIds]
				})?.length
			) {
				return;
			}
			if (e.originalEvent) {
				(e.originalEvent as unknown as Record<string, boolean>)._felsHandled = true;
			}
			const feature = e.features?.[0];
			if (feature) openFeature(feature);
		});

		const cragPolygonLayerIds = ['crag-fill', 'crag-line'];
		map.on('mouseenter', cragPolygonLayerIds, (e) => {
			if (e.point && map.queryRenderedFeatures?.(e.point, { layers: sectorLayerIds })?.length) {
				return;
			}
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', cragPolygonLayerIds, () => {
			map.getCanvas().style.cursor = 'default';
		});
		map.on('click', cragPolygonLayerIds, (e) => {
			if ((e.originalEvent as unknown as Record<string, boolean> | undefined)?._felsHandled) return;
			if (e.point && map.queryRenderedFeatures?.(e.point, { layers: sectorLayerIds })?.length) {
				return;
			}
			if (e.originalEvent) {
				(e.originalEvent as unknown as Record<string, boolean>)._felsHandled = true;
			}
			const feature = e.features?.[0];
			if (feature) openFeature(feature);
		});

		const areaPolygonLayerIds = ['area-fill', 'area-line'];
		map.on('mouseenter', areaPolygonLayerIds, (e) => {
			if (
				e.point &&
				map.queryRenderedFeatures?.(e.point, {
					layers: [...sectorLayerIds, ...cragPolygonLayerIds]
				})?.length
			) {
				return;
			}
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', areaPolygonLayerIds, () => {
			map.getCanvas().style.cursor = 'default';
		});
		map.on('click', areaPolygonLayerIds, (e) => {
			if ((e.originalEvent as unknown as Record<string, boolean> | undefined)?._felsHandled) return;
			if (
				e.point &&
				map.queryRenderedFeatures?.(e.point, {
					layers: [...sectorLayerIds, ...cragPolygonLayerIds]
				})?.length
			) {
				return;
			}
			if (e.originalEvent) {
				(e.originalEvent as unknown as Record<string, boolean>)._felsHandled = true;
			}
			const feature = e.features?.[0];
			if (feature) openFeature(feature);
		});

		window.addEventListener('crag-review:focus-map-target', handleFocusMapTarget);
	});

	function getMapPadding() {
		if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 };
		return calculateMapPadding({ width: window.innerWidth, height: window.innerHeight });
	}

	function handleFocusMapTarget(e: CustomEvent<MapFocusTarget>) {
		if (!map) return;
		const target = e.detail;
		if (target && target.center) {
			map.flyTo({
				center: target.center,
				zoom: target.zoom ?? 18,
				padding: getMapPadding(),
				duration: 1200
			});
		}
		if (target && target.path) {
			updateSelectionStyle(target.path);
		}
	}

	$effect(() => {
		return () => {
			window.removeEventListener('crag-review:focus-map-target', handleFocusMapTarget);
		};
	});

	function openFeature(feature: MapGeoJSONFeature) {
		const properties = feature.properties as { filePath: string };
		const location = locations.find((item) => item.path === properties.filePath);
		if (!location) return;
		const center = getGeometryCenter(location.entry.geometry);
		if (!center) return;
		updateSelectionStyle(location.path);
		openPlace(location.path, center, location.entry);
	}

	async function openPlace(
		path: string,
		coordinates: [number, number],
		entry?: FelsLocation['entry']
	) {
		if ($page.params.crag !== path) {
			await goto(`${base}/map/crag/${path}`);
		}

		if (!map || !coordinates) return;
		const uiPadding = getMapPadding();

		if (entry?.properties?.kind === 'area' && entry.geometry?.type !== 'Point') {
			const bounds = getGeometryBounds(entry.geometry);
			if (bounds) {
				isManuallyPanning = true;
				map.fitBounds(bounds, {
					padding: {
						top: uiPadding.top + 40,
						bottom: uiPadding.bottom + 40,
						left: uiPadding.left + 40,
						right: uiPadding.right + 40
					},
					maxZoom: 14,
					duration: 1200
				});
				map.once('moveend', () => {
					isManuallyPanning = false;
				});
				return;
			}
		}

		if (!isTargetVisibleAndZoomed(coordinates, uiPadding, 16)) {
			isManuallyPanning = true;
			map.flyTo({
				center: coordinates,
				zoom: Math.max(map.getZoom(), 16),
				padding: uiPadding,
				duration: 1200
			});
			map.once('moveend', () => {
				isManuallyPanning = false;
			});
		}
	}

	async function drawLayers() {
		if (!map) return;
		try {
			await Promise.all([
				generateSelectedMarker(),
				addMapImage('sports-climbing', base + '/icons/sports-climbing.png'),
				addMapImage('multi-pitch', base + '/icons/multi-pitch.png'),
				addMapImage('bouldering', base + '/icons/bouldering.png'),
				addMapImage('alpine-tour', base + '/icons/alpine-tour.png'),
				addMapImage('via-ferrata', base + '/icons/via-ferrata.png'),
				addMapImage('access-parking', base + '/icons/parking.png'),
				addMapImage('access-train', base + '/icons/train.png'),
				addMapImage('access-bus', base + '/icons/bus.png'),
				addMapImage('access-hut', base + '/icons/hut.png')
			]);
			mapReady = true;
			syncAccessLayers();
			syncTopoPathLayers();
			addPlacesLayers();
		} catch (error) {
			console.error('Failed to restore map layers after style change', error);
		}
	}

	function getPlacesData() {
		return createPlacesData(locations);
	}

	const LAYER_ORDER = [
		'area-fill',
		'area-selected-casing',
		'area-line',
		'crag-fill',
		'crag-selected-casing',
		'crag-line',
		'sector-fill',
		'sector-selected-casing',
		'sector-line',
		'sector-labels',
		'access-lines-outline',
		'access-lines',
		'topo-paths-outline',
		'topo-paths',
		'access-dots',
		'places-dots',
		'access-points',
		'places'
	];

	function addPlacesLayers() {
		if (!map.getSource('places')) {
			map.addSource('places', { type: 'geojson', cluster: false, data: getPlacesData() });
		}
		addLayerInOrder(areaFillLayer);
		addLayerInOrder(areaSelectedCasingLayer);
		addLayerInOrder(areaLineLayer);
		addLayerInOrder(cragFillLayer);
		addLayerInOrder(cragSelectedCasingLayer);
		addLayerInOrder(cragLineLayer);
		addLayerInOrder(sectorFillLayer);
		addLayerInOrder(sectorSelectedCasingLayer);
		addLayerInOrder(sectorLineLayer);
		addLayerInOrder(sectorLabelsLayer);
		addLayerInOrder(placesDotsLayer);
		addLayerInOrder(placesLayer);
	}

	function addLayerInOrder(layer: LayerSpecification) {
		if (map.getLayer(layer.id)) return;
		const layerIndex = LAYER_ORDER.indexOf(layer.id);
		let beforeId: string | undefined;
		if (layerIndex !== -1) {
			for (let i = layerIndex + 1; i < LAYER_ORDER.length; i++) {
				if (map.getLayer(LAYER_ORDER[i])) {
					beforeId = LAYER_ORDER[i];
					break;
				}
			}
		}
		if (beforeId) {
			map.addLayer(layer, beforeId);
		} else {
			map.addLayer(layer);
		}
	}

	function getAccessData() {
		return {
			type: 'FeatureCollection' as const,
			features: access?.features || []
		};
	}

	function getTopoPathsData() {
		return createTopoPathsData(topoPaths);
	}

	function addTopoPathLayers() {
		if (!map || !mapReady) return;
		if (!map.getSource('topo-paths')) {
			map.addSource('topo-paths', { type: 'geojson', data: getTopoPathsData() });
		}
		addLayerInOrder(topoPathsOutlineLayer);
		addLayerInOrder(topoPathsLayer);
	}

	function syncTopoPathLayers() {
		if (!map || !mapReady) return;
		if (topoPaths?.length) {
			addTopoPathLayers();
			map.getSource<GeoJSONSource>('topo-paths')?.setData(getTopoPathsData());
		} else {
			removeTopoPathLayers();
		}
	}

	function removeTopoPathLayers() {
		if (!map || !mapReady) return;
		if (map.getLayer('topo-paths')) map.removeLayer('topo-paths');
		if (map.getLayer('topo-paths-outline')) map.removeLayer('topo-paths-outline');
		if (map.getSource('topo-paths')) map.removeSource('topo-paths');
	}

	function addAccessLayers() {
		if (!map || !mapReady || !access?.features?.length) return;
		if (!map.getSource('access'))
			map.addSource('access', { type: 'geojson', data: getAccessData() });
		addLayerInOrder(accessLineOutlineLayer);
		addLayerInOrder(accessLineLayer);
		addLayerInOrder(accessDotsLayer);
		addLayerInOrder(accessPointsLayer);
	}

	function syncAccessLayers() {
		if (!map || !mapReady) return;
		if (access?.features?.length) {
			addAccessLayers();
			map.getSource<GeoJSONSource>('access')?.setData(getAccessData());
		} else {
			removeAccessLayers();
		}
	}

	function removeAccessLayers() {
		if (!map || !mapReady) return;
		if (map.getLayer('access-points')) map.removeLayer('access-points');
		if (map.getLayer('access-dots')) map.removeLayer('access-dots');
		if (map.getLayer('access-lines')) map.removeLayer('access-lines');
		if (map.getLayer('access-lines-outline')) map.removeLayer('access-lines-outline');
		if (map.getSource('access')) map.removeSource('access');
	}

	$effect(() => {
		const placesData = getPlacesData();
		if (!map || !mapReady) return;
		const source = map.getSource<GeoJSONSource>('places');
		if (source) {
			source.setData(placesData);
			updateSelectionStyle($page.params.crag || '');
		}
	});

	$effect(() => {
		topoPaths;
		if (!mapReady) return;
		syncTopoPathLayers();
	});

	$effect(() => {
		accessKey;
		access;
		if (!mapReady) return;
		syncAccessLayers();
	});

	$effect(() => {
		cameraTarget;
		if (!mapReady) return;
		applyCameraTarget();
	});

	$effect(() => {
		const selectedPath = $page.params.crag || '';
		updateSelectionStyle(selectedPath);

		let timer: ReturnType<typeof setTimeout> | undefined;
		if (selectedPath) {
			timer = setTimeout(() => updateSelectionStyle(selectedPath), 150);
		}

		return () => {
			if (timer) clearTimeout(timer);
		};
	});

	function updateSelectionStyle(selectedPath: string) {
		if (!map) return;

		const setLayerFilter = (id: string, filter: ExpressionSpecification) => {
			if (map.getLayer(id)) map.setFilter?.(id, filter);
		};
		const setLayerPaint = (id: string, name: string, value: unknown) => {
			if (map.getLayer(id)) map.setPaintProperty?.(id, name, value);
		};
		const setLayerLayout = (id: string, name: string, value: unknown) => {
			if (map.getLayer(id)) map.setLayoutProperty?.(id, name, value);
		};

		if (!selectedPath) {
			setLayerFilter('places', defaultPlacesFilter);
			setLayerFilter('crag-fill', defaultCragFilter);
			setLayerFilter('crag-selected-casing', [
				'all',
				['==', ['geometry-type'], 'Polygon'],
				['==', ['get', 'kind'], 'crag'],
				['==', ['get', 'filePath'], '']
			]);
			setLayerFilter('crag-line', defaultCragFilter);
			setLayerFilter('sector-fill', defaultSectorFilter);
			setLayerFilter('sector-selected-casing', [
				'all',
				['==', ['geometry-type'], 'Polygon'],
				['==', ['get', 'kind'], 'sector'],
				['==', ['get', 'filePath'], '']
			]);
			setLayerFilter('sector-line', defaultSectorFilter);
			setLayerFilter('sector-labels', [
				'all',
				['==', ['geometry-type'], 'Polygon'],
				['==', ['get', 'kind'], 'sector'],
				['>=', ['zoom'], 16],
				['has', 'name']
			]);
			setLayerFilter('area-fill', defaultAreaFilter);
			setLayerFilter('area-selected-casing', defaultAreaFilter);
			setLayerFilter('area-line', defaultAreaFilter);

			setLayerPaint('area-fill', 'fill-color', colors.text.ink);
			setLayerPaint('area-fill', 'fill-opacity', 0.04);
			setLayerPaint('area-line', 'line-color', colors.text.ink);
			setLayerPaint('area-line', 'line-width', 2);
			setLayerPaint('area-line', 'line-opacity', 0.75);
			setLayerPaint('area-line', 'line-dasharray', [3, 2]);

			setLayerPaint('crag-fill', 'fill-color', placeTypeColor);
			setLayerPaint('crag-fill', 'fill-opacity', [
				'step',
				['zoom'],
				0.12,
				16,
				['case', ['get', 'hasSectors'], 0, 0.12]
			]);
			setLayerPaint('crag-line', 'line-color', placeTypeColor);
			setLayerPaint('crag-line', 'line-width', 2);
			setLayerPaint('crag-line', 'line-opacity', 0.7);
			setLayerPaint('crag-line', 'line-dasharray', [
				'case',
				['get', 'hasSectors'],
				['literal', [2, 2]],
				['literal', [1]]
			]);

			setLayerPaint('sector-fill', 'fill-color', placeTypeColor);
			setLayerPaint('sector-fill', 'fill-opacity', 0.12);
			setLayerPaint('sector-line', 'line-color', placeTypeColor);
			setLayerPaint('sector-line', 'line-width', 2);
			setLayerPaint('sector-line', 'line-opacity', 0.7);
			setLayerPaint('sector-labels', 'text-color', colors.map.sectorText);
			setLayerLayout('sector-labels', 'text-size', 12);
			setLayerPaint('places-dots', 'circle-color', placeTypeColor);
			setLayerPaint('places-dots', 'circle-opacity', ['step', ['zoom'], 1, 13.5, 0]);
			setLayerPaint('places-dots', 'circle-stroke-opacity', ['step', ['zoom'], 1, 13.5, 0]);
			setLayerPaint('places', 'text-color', 'rgba(47,57,72,1)');
			setLayerPaint('places', 'icon-opacity', ['step', ['zoom'], 0, 13.5, 1]);
			setLayerPaint('places', 'text-opacity', ['step', ['zoom'], 0, 13.5, 1]);
			setLayerLayout('places', 'symbol-sort-key', 0);
			setLayerLayout('places', 'icon-image', placeIcon);
			return;
		}

		const isSelected = selectionExpression(selectedPath);
		if (!isSelected) return;
		const decodedPath = decodeURIComponent(selectedPath);
		const isExactMatch: ExpressionSpecification = ['==', ['get', 'filePath'], decodedPath];
		const isPolygonExactMatch = isExactMatch;

		setLayerFilter('places', [
			'all',
			['!=', ['get', 'kind'], 'area'],
			['==', ['geometry-type'], 'Point'],
			['any', isExactMatch, ['!=', ['get', 'kind'], 'sector'], ['>=', ['zoom'], 16]]
		]);

		setLayerFilter('crag-fill', [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'crag'],
			['any', isSelected, ['>=', ['zoom'], 13.5]]
		]);
		setLayerFilter('crag-selected-casing', [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'crag'],
			isPolygonExactMatch
		]);
		setLayerFilter('crag-line', [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'crag'],
			['any', isSelected, ['>=', ['zoom'], 13.5]]
		]);

		const sectorSelectionFilter: ExpressionSpecification = [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'sector'],
			['any', isSelected, ['>=', ['zoom'], 16]]
		];
		setLayerFilter('sector-fill', sectorSelectionFilter);
		setLayerFilter('sector-selected-casing', [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'sector'],
			isPolygonExactMatch
		]);
		setLayerFilter('sector-line', sectorSelectionFilter);
		setLayerFilter('sector-labels', [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'sector'],
			['has', 'name'],
			['any', isSelected, ['>=', ['zoom'], 16]]
		]);

		const areaSelectionFilter: ExpressionSpecification = [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['==', ['get', 'kind'], 'area'],
			isPolygonExactMatch
		];
		setLayerFilter('area-fill', areaSelectionFilter);
		setLayerFilter('area-selected-casing', areaSelectionFilter);
		setLayerFilter('area-line', areaSelectionFilter);

		setLayerPaint('area-fill', 'fill-color', colors.text.ink);
		setLayerPaint('area-fill', 'fill-opacity', ['case', isPolygonExactMatch, 0.08, 0.04]);
		setLayerPaint('area-line', 'line-color', [
			'case',
			isPolygonExactMatch,
			'#dc2626',
			colors.text.ink
		]);
		setLayerPaint('area-line', 'line-width', ['case', isPolygonExactMatch, 2.5, 2]);
		setLayerPaint('area-line', 'line-opacity', ['case', isPolygonExactMatch, 0.9, 0.75]);
		setLayerPaint('area-line', 'line-dasharray', [
			'case',
			isPolygonExactMatch,
			['literal', [1]],
			['literal', [3, 2]]
		]);

		setLayerPaint('crag-fill', 'fill-color', placeTypeColor);
		setLayerPaint('crag-fill', 'fill-opacity', [
			'step',
			['zoom'],
			['case', isPolygonExactMatch, 0.18, 0.12],
			16,
			['case', isPolygonExactMatch, 0.18, ['case', ['get', 'hasSectors'], 0, 0.12]]
		]);
		setLayerPaint('crag-line', 'line-color', [
			'case',
			isPolygonExactMatch,
			'#dc2626',
			placeTypeColor
		]);
		setLayerPaint('crag-line', 'line-width', ['case', isPolygonExactMatch, 2.5, 2]);
		setLayerPaint('crag-line', 'line-opacity', ['case', isPolygonExactMatch, 0.9, 0.7]);
		setLayerPaint('crag-line', 'line-dasharray', [
			'case',
			isPolygonExactMatch,
			['literal', [1]],
			['case', ['get', 'hasSectors'], ['literal', [2, 2]], ['literal', [1]]]
		]);

		setLayerPaint('sector-fill', 'fill-color', placeTypeColor);
		setLayerPaint('sector-fill', 'fill-opacity', ['case', isPolygonExactMatch, 0.18, 0.12]);
		setLayerPaint('sector-line', 'line-color', [
			'case',
			isPolygonExactMatch,
			'#dc2626',
			placeTypeColor
		]);
		setLayerPaint('sector-line', 'line-width', ['case', isPolygonExactMatch, 2.5, 2]);
		setLayerPaint('sector-line', 'line-opacity', ['case', isPolygonExactMatch, 0.9, 0.7]);
		setLayerPaint('sector-labels', 'text-color', [
			'case',
			isPolygonExactMatch,
			'#dc2626',
			colors.map.sectorText
		]);
		setLayerLayout('sector-labels', 'text-size', ['case', isPolygonExactMatch, 13, 12]);

		// For dots, we set opacity to 0 when selected to avoid bleed-through
		setLayerPaint('places-dots', 'circle-opacity', [
			'step',
			['zoom'],
			['case', isExactMatch, 0, 1], // Zoom < 13.5
			13.5,
			0 // Zoom >= 13.5
		]);
		setLayerPaint('places-dots', 'circle-stroke-opacity', [
			'step',
			['zoom'],
			['case', isExactMatch, 0, 1],
			13.5,
			0
		]);

		// Change text color to red instantly
		setLayerPaint('places', 'text-color', ['case', isExactMatch, '#dc2626', 'rgba(47,57,72,1)']);

		// For icons and text, make sure the selected marker is visible at all zoom levels
		setLayerPaint('places', 'icon-opacity', [
			'step',
			['zoom'],
			['case', isExactMatch, 1, 0], // Zoom < 13.5 (show ONLY selected marker)
			13.5,
			1 // Zoom >= 13.5 (show all markers)
		]);
		setLayerPaint('places', 'text-opacity', [
			'step',
			['zoom'],
			['case', isExactMatch, 1, 0], // Zoom < 13.5 (show ONLY selected marker label)
			13.5,
			1 // Zoom >= 13.5 (show all marker labels)
		]);

		// Render selected marker above all other markers
		setLayerLayout('places', 'symbol-sort-key', ['case', isExactMatch, 10, 0]);

		// Swap the icon image instantly
		setLayerLayout('places', 'icon-image', [
			'case',
			isExactMatch,
			['image', 'selected-marker'],
			placeIcon
		]);
	}

	async function generateSelectedMarker() {
		if (map && !map.hasImage('selected-marker')) {
			const svg = `<svg width="48" height="48" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg"><path fill="#ffffff" d="M930.3,392.4c0,175.5-234.9,487.9-337.9,616.8-24.7,30.7-70.5,30.7-95.2,0-103-128.9-337.9-441.3-337.9-616.8S332,6.9,544.9,6.9s385.5,172.7,385.5,385.5h-.1Z"/><path fill="#dc2626" d="M894.1,393.9c0,158.3-212.2,440.1-305.2,556.4-22.3,27.7-63.6,27.7-85.9,0-93-116.3-305.2-398.1-305.2-556.4S353.7,46.1,546,46.1s348.1,155.8,348.1,347.7h0v.1Z"/><circle cx="546" cy="385" r="100" fill="#ffffff" /></svg>`;
			const img = new Image();
			await new Promise((resolve) => {
				img.onload = resolve;
				img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
			});
			if (map && !map.hasImage('selected-marker')) {
				map.addImage('selected-marker', img);
			}
		}
	}

	let isManuallyPanning = false;

	function isTargetVisibleAndZoomed(
		centerLngLat: LngLatLike,
		padding: Required<PaddingOptions>,
		targetZoom = 15
	) {
		if (!map) return false;
		if (map.getZoom() < targetZoom - 0.5) return false;
		const point = map.project(centerLngLat);
		const container = map.getContainer();
		const width = container.clientWidth;
		const height = container.clientHeight;
		const marginX = 40;
		const marginY = 60;
		return (
			point.x >= padding.left + marginX &&
			point.x <= width - padding.right - marginX &&
			point.y >= padding.top + marginY &&
			point.y <= height - padding.bottom - marginY
		);
	}

	function applyCameraTarget() {
		if (!map || !mapReady || !cameraTarget || isManuallyPanning) return;

		const uiPadding = getMapPadding();

		if (cameraTarget.type === 'bounds' && cameraTarget.bounds) {
			const base = cameraTarget.padding;
			map.fitBounds(cameraTarget.bounds, {
				padding: {
					top: uiPadding.top + base,
					bottom: uiPadding.bottom + base,
					left: uiPadding.left + base,
					right: uiPadding.right + base
				},
				maxZoom: cameraTarget.maxZoom ?? 18,
				duration: 900
			});
		} else if (cameraTarget.type === 'center') {
			if (isTargetVisibleAndZoomed(cameraTarget.center, uiPadding, cameraTarget.zoom)) {
				return;
			}

			map.flyTo({
				center: [cameraTarget.center[0] + 0.00001, cameraTarget.center[1]],
				zoom: Math.max(map.getZoom(), cameraTarget.zoom),
				padding: uiPadding,
				duration: 1200
			});
		}
	}

	async function addMapImage(name: string, url: string) {
		try {
			const img = await map.loadImage(url);
			if (!map.hasImage(name)) {
				map.addImage(name, img.data);
			}
		} catch (e) {
			console.error('Failed to load image', name, e);
		}
	}

	function setTransportTileLayer() {
		mapReady = false;
		map.setStyle(base + '/transport.json');
		tileLayerMenuOpen = false;
	}

	function setSatelliteTileLayer() {
		mapReady = false;
		map.setStyle(base + '/satellite.json');
		tileLayerMenuOpen = false;
	}

	function setTerrainTileLayer() {
		mapReady = false;
		map.setStyle(base + '/terrain.json');
		tileLayerMenuOpen = false;
	}
</script>

<div
	class="fixed top-0 right-0 bottom-0 left-0 h-screen w-full transition-opacity duration-300 {detailsShown
		? 'details-shown'
		: ''} {isHidden ? 'pointer-events-none z-[-1] opacity-0' : 'opacity-100'}"
	bind:this={mapElement}
	style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;"
></div>
<div
	class="style-selector-btn fixed right-4 z-[1000] flex flex-col items-center gap-2 transition-opacity duration-300 sm:right-auto sm:left-8 {isHidden
		? 'pointer-events-none opacity-0'
		: 'opacity-100'}"
	role="group"
	aria-label="Map style selector"
	onmouseleave={() => (tileLayerMenuOpen = false)}
	style="--dropdown-offset: {$searchSuggestionsActive > 0
		? $searchSuggestionsActive + 16
		: 0}px; {isHidden ? '--controls-opacity: 0; --controls-pointer: none;' : ''}"
>
	<button
		aria-label="Choose map style"
		class="hover:bg-ink flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border-1 border-gray-200 bg-white text-gray-600 shadow-md transition-all hover:text-white max-sm:h-11 max-sm:w-11"
		ontouchstart={() => {
			isTouchStyleMenu = true;
		}}
		onmouseenter={() => {
			if (!isTouchStyleMenu) tileLayerMenuOpen = !tileLayerMenuOpen;
		}}
		onclick={() => {
			if (isTouchStyleMenu) tileLayerMenuOpen = !tileLayerMenuOpen;
		}}><i class="fa-solid fa-layer-group text-lg"></i></button
	>
	{#if tileLayerMenuOpen}
		<div
			class="flex flex-col justify-center gap-2"
			in:slide={{ duration: 200 }}
			out:slide={{ duration: 200 }}
		>
			<button
				aria-label="Show transport map"
				class="hover:bg-ink flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border-1 border-gray-200 bg-white text-gray-600 shadow-md hover:text-white max-sm:h-11 max-sm:w-11"
				onclick={setTransportTileLayer}
			>
				<i class="fa-solid fa-bus-simple"></i>
			</button>
			<button
				aria-label="Show satellite map"
				class="hover:bg-ink flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border-1 border-gray-200 bg-white text-gray-600 shadow-md hover:text-white max-sm:h-11 max-sm:w-11"
				onclick={setSatelliteTileLayer}
			>
				<i class="fa-solid fa-satellite"></i>
			</button>
			<button
				aria-label="Show terrain map"
				class="hover:bg-ink flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border-1 border-gray-200 bg-white text-gray-600 shadow-md hover:text-white max-sm:h-11 max-sm:w-11"
				onclick={setTerrainTileLayer}
			>
				<i class="fa-solid fa-mountain"></i>
			</button>
		</div>
	{/if}
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
	@import 'tailwindcss';

	.style-selector-btn {
		top: 11.25rem;
		@media (width > 40rem) {
			top: calc(11rem + var(--dropdown-offset, 0px));
		}
		@media (width <= 40rem) {
			bottom: auto;
			transition:
				opacity 0.2s ease-out,
				transform 0.2s ease-out,
				top 0.2s ease-out;
			opacity: var(--controls-opacity, 1);
			transform: scale(var(--controls-scale, 1));
			transform-origin: center;
			pointer-events: var(--controls-pointer, auto);
		}
	}

	:global(.details-shown) ~ .style-selector-btn {
		@media (width <= 40rem) {
			top: 8rem;
		}
	}

	:global(.maplibregl-ctrl-group) {
		display: flex;
		height: calc(var(--spacing) * 10);
		width: calc(var(--spacing) * 10);
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-2xl);
		border: 1px solid var(--color-gray-200);
		background-color: var(--color-white);
		transition: all var(--default-transition-duration) var(--default-transition-timing-function);
		margin: 0 0 0.5rem 0 !important;
	}

	:global(.maplibregl-ctrl-group) {
		@media (width <= 40rem) {
			height: calc(var(--spacing) * 11);
			width: calc(var(--spacing) * 11);
			transition:
				opacity 0.2s ease-out,
				transform 0.2s ease-out;
			opacity: var(--controls-opacity, 1);
			transform: scale(var(--controls-scale, 1));
			transform-origin: center;
			pointer-events: var(--controls-pointer, auto);
		}
	}

	:global(.maplibregl-ctrl-group button) {
		height: 100%;
		width: 100%;
		border-radius: var(--radius-2xl);
	}

	:global(.maplibregl-ctrl-group:not(:empty)) {
		box-shadow: var(--shadow-md);
	}

	:global(.maplibregl-ctrl-bottom-right) {
		right: calc(var(--spacing) * 2);
		bottom: calc(var(--spacing) * 2);
	}

	:global(.maplibregl-ctrl-bottom-right) {
		@media (width <= 40rem) {
			right: auto;
			left: calc(var(--spacing) * 2);
			bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);
		}
	}

	:global(.maplibregl-ctrl-top-right) {
		position: fixed;
		right: auto;
		left: calc(var(--spacing) * 8);
		z-index: 1000;
		margin: 0 !important;
		top: calc(5rem + var(--dropdown-offset, 0px));
	}

	:global(.maplibregl-ctrl-top-right) {
		@media (width <= 40rem) {
			top: auto;
			right: calc(var(--spacing) * 4);
			left: auto;
			top: 8rem;
			bottom: auto;
			transition: top 0.2s ease-out;
		}
	}

	:global(.details-shown .maplibregl-ctrl-top-right) {
		@media (width <= 40rem) {
			top: 4.75rem;
		}
	}

	:global(.maplibregl-ctrl-group:has(.maplibregl-ctrl-geolocate)) {
		@media (width <= 40rem) {
			position: fixed;
			right: 1rem;
			bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);
			top: auto !important;
			margin: 0 !important;
			transition:
				var(--info-panel-transition, bottom 0.2s ease-out),
				opacity 0.2s ease-out,
				transform 0.2s ease-out;
		}
	}

	:global(.details-shown .maplibregl-ctrl-group:has(.maplibregl-ctrl-geolocate)) {
		@media (width <= 40rem) {
			bottom: calc(var(--info-panel-height, 50vh) + 16px) !important;
		}
	}

	/* Blends white out of the raster tile container */
	:global(.maplibregl-style-layer-regional-imagery) {
		mix-blend-mode: multiply;
	}

	/* Lock MapLibre attribution font size to prevent automatic browser upscaling on all devices (desktop and mobile) */
	:global(.maplibregl-ctrl-attrib),
	:global(.maplibregl-ctrl-attrib a) {
		font-size: 12px !important;
		line-height: 1.5 !important;
		-webkit-text-size-adjust: 100% !important;
		text-size-adjust: 100% !important;
	}
</style>
