<script>
	import { base } from '$app/paths';
	import { page, navigating } from '$app/stores';
	import { slide } from 'svelte/transition';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { slowRasterTileDecay } from '$lib/assets/js/map-raster-lod.js';
	import { searchSuggestionsActive } from '$lib/stores/search.js';
	import { colors } from '$lib/colors.js';
	import {
		createPlacesData,
		createTopoPathsData,
		getMapPadding as calculateMapPadding,
		selectionExpression
	} from '$lib/assets/js/climbing-map-utils.js';

	/** @typedef {import('@vorstieg/fels-data/types').TopoPathFeature} TopoPathFeature */
	/** @type {{locations?: any, access?: any, topoPaths?: TopoPathFeature[], accessKey?: string, tracks?: any, pitch?: number}} */
	let {
		locations = [],
		access = null,
		topoPaths = [],
		accessKey = '',
		cameraTarget = null
	} = $props();

	let mapElement = $state();
	let map;
	let tileLayerMenuOpen = $state(false);
	let styleLoaded = $state(false);
	let hasFilter = $derived(
		!(
			$page.url.pathname.startsWith(`${base}/map/crag`) ||
			$navigating?.to?.url?.pathname?.startsWith(`${base}/map/crag`)
		)
	);
	const placeTypeColor = [
		'match',
		['get', 'type'],
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
		'bus',
		colors.map.bus,
		'train',
		colors.map.train,
		'parking-space',
		colors.map.parking,
		colors.routeTypes['sports-climbing']
	];

	const placesLayer = {
		id: 'places',
		type: 'symbol',
		source: 'places',
		minzoom: 11.5,
		filter: [
			'all',
			['!=', ['geometry-type'], 'Polygon'],
			['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 0]]
		],
		layout: {
			'icon-image': ['get', 'type'],
			'icon-size': 0.55,
			'icon-allow-overlap': true,
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

	const placesDotsLayer = {
		id: 'places-dots',
		type: 'circle',
		source: 'places',
		maxzoom: 14,
		filter: ['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 0]],
		paint: {
			'circle-color': placeTypeColor,
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 12, 4.5],
			'circle-radius-transition': { duration: 400 },
			'circle-stroke-width': 0,
			'circle-stroke-color': colors.text.white,
			'circle-opacity': ['step', ['zoom'], 1, 13.5, 0],
			'circle-opacity-transition': { duration: 400 },
			'circle-stroke-opacity': ['step', ['zoom'], 1, 13.5, 0],
			'circle-stroke-opacity-transition': { duration: 400 }
		}
	};

	const sectorFillLayer = {
		id: 'sector-fill',
		type: 'fill',
		source: 'places',
		filter: [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 13]]
		],
		paint: { 'fill-color': placeTypeColor, 'fill-opacity': 0.12 }
	};

	const sectorLineLayer = {
		id: 'sector-line',
		type: 'line',
		source: 'places',
		filter: [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 13]]
		],
		paint: { 'line-color': placeTypeColor, 'line-width': 2, 'line-opacity': 0.7 }
	};

	const sectorLabelsLayer = {
		id: 'sector-labels',
		type: 'symbol',
		source: 'places',
		filter: [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 13]],
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

	const accessLineLayer = {
		id: 'access-lines',
		type: 'line',
		source: 'access',
		filter: ['==', ['get', 'kind'], 'approach'],
		paint: {
			'line-color': colors.gpxRoles.approach,
			'line-width': 4,
			'line-opacity': 0.9
		}
	};

	const accessPointsLayer = {
		id: 'access-points',
		type: 'symbol',
		source: 'access',
		minzoom: 0,
		filter: ['==', ['geometry-type'], 'Point'],
		layout: {
			'icon-image': [
				'match',
				['get', 'kind'],
				'parking', 'parking',
				'hut', 'access-hut',
				'transit', [
					'match',
					['coalesce', ['get', 'mode'], 'bus'],
					'train', 'train',
					'bus', 'bus',
					'bus'
				],
				'bus'
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
			'text-halo-width': 3
		}
	};

	const topoPathsLayer = {
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
					'sports-climbing', colors.routeTypes['sports-climbing'],
					'multi-pitch', colors.routeTypes['multi-pitch'],
					'bouldering', colors.routeTypes.bouldering,
					'trad', colors.routeTypes.trad,
					'alpine-tour', colors.routeTypes['alpine-tour'],
					'via-ferrata', colors.routeTypes['via-ferrata'],
					colors.topoPaths.main
				],
				[
					'match',
					['get', 'role'],
					'approach', colors.topoPaths.approach,
					'descent', colors.topoPaths.descent,
					'variant', colors.topoPaths.variant,
					'fixedRope', colors.topoPaths.fixedRope,
					colors.topoPaths.main
				]
			],
			'line-width': 4,
			'line-opacity': 0.85
		}
	};

	onMount(async () => {
		map = new maplibregl.Map({
			container: mapElement,
			zoom: cameraTarget?.zoom ?? 8,
			center: cameraTarget?.center ?? [16.0, 48.0],
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
			if (map.getZoom() >= 12.0 && e.features[0]?.properties?.path) {
				updateSelectionStyle(e.features[0].properties.path);
				openPlace(e.features[0].properties.path, e.features[0].geometry.coordinates);
			}
		});

		map.on('load', async () => {
			syncTopoPathLayers();
			await generateSelectedMarker();
			await drawLayers();
			applyCameraTarget();
			if (is3D) {
				map.setTerrain({ source: 'globalTerrainSource', exaggeration: 1 });
			}
			updateSelectionStyle($page.params.crag || '');
			slowRasterTileDecay(map);
		});
		map.on('style.load', async () => {
			if (map.getSource('places')) {
				return; // Places already exists, meaning this is not a fresh style load that wiped our sources
			}
			await generateSelectedMarker();
			await drawLayers();
			if (is3D) {
				map.setTerrain({ source: 'globalTerrainSource', exaggeration: 1 });
			}
			slowRasterTileDecay(map);
			syncTopoPathLayers();
			map.once('idle', async () => {
				await generateSelectedMarker();
				await drawLayers();
				applyCameraTarget();
				updateSelectionStyle($page.params.crag || '');
				styleLoaded = true;
			});
		});

		map.on('mouseenter', 'places', function () {
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
			if (map.getZoom() < 12.0 && e.features[0]?.properties?.path) {
				updateSelectionStyle(e.features[0].properties.path);
				openPlace(e.features[0].properties.path, e.features[0].geometry.coordinates);
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
			const feature = e.features?.[0];
			const path = feature?.properties?.path;
			if (path) openPlace(path, e.lngLat.toArray());
		});

		window.addEventListener('crag-review:focus-map-target', handleFocusMapTarget);
	});

	function getMapPadding() {
		if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 };
		return calculateMapPadding({ width: window.innerWidth, height: window.innerHeight });
	}

	function handleFocusMapTarget(e) {
		if (!map || !map.isStyleLoaded()) return;
		const target = e.detail;
		if (target && target.center) {
			map.easeTo({
				center: target.center,
				zoom: target.zoom ?? 18,
				padding: getMapPadding(),
				duration: 900
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

	function openPlace(path, coordinates) {
		goto(`${base}/map/crag/${path}`);
	}

	async function drawLayers() {
		if (!map || !map.isStyleLoaded()) return;
		try {
			syncTopoPathLayers();
			await addMapImage('sports-climbing', base + '/icons/sports-climbing.png');
			await addMapImage('multi-pitch', base + '/icons/multi-pitch.png');
			await addMapImage('bouldering', base + '/icons/bouldering.png');
			await addMapImage('alpine-tour', '/icons/alpine-tour.png');
			await addMapImage('via-ferrata', '/icons/via-ferrata.png');
			await addMapImage('train', base + '/icons/train.png');
			await addMapImage('bus', base + '/icons/bus.png');
			await addMapImage('parking', base + '/icons/parking.png');
			await addMapImage('parking-space', base + '/icons/parking.png');
			await addMapImage('access-hut', base + '/icons/hut.png');
			if (access?.features?.length) addAccessLayers();
			addTopoPathLayers();
			addPlacesLayers();
		} catch (error) {
			console.error('Failed to restore map layers after style change', error);
		}
	}

	function getPlacesData() {
		return createPlacesData(locations);
	}

	function addPlacesLayers() {
		if (!map.getSource('places')) {
			map.addSource('places', { type: 'geojson', cluster: false, data: getPlacesData() });
		}
		if (!map.getLayer('sector-fill')) map.addLayer(sectorFillLayer);
		if (!map.getLayer('sector-line')) map.addLayer(sectorLineLayer);
		if (!map.getLayer('sector-labels')) map.addLayer(sectorLabelsLayer);
		if (!map.getLayer('places-dots')) map.addLayer(placesDotsLayer);
		if (!map.getLayer('places')) map.addLayer(placesLayer);
	}

	function getAccessData() {
		return {
			type: 'FeatureCollection',
			features: access?.features || []
		};
	}

	function getTopoPathsData() {
		return createTopoPathsData(topoPaths);
	}

	function addTopoPathLayers() {
		if (!map?.isStyleLoaded()) return;
		if (!map.getSource('topo-paths')) {
			map.addSource('topo-paths', { type: 'geojson', data: getTopoPathsData() });
		}
		if (!map.getLayer('topo-paths')) map.addLayer(topoPathsLayer);
	}

	function syncTopoPathLayers() {
		if (!map?.isStyleLoaded()) return;
		if (topoPaths?.length) {
			addTopoPathLayers();
			map.getSource('topo-paths')?.setData(getTopoPathsData());
		} else {
			removeTopoPathLayers();
		}
	}

	function removeTopoPathLayers() {
		if (!map?.isStyleLoaded()) return;
		if (map.getLayer('topo-paths')) map.removeLayer('topo-paths');
		if (map.getSource('topo-paths')) map.removeSource('topo-paths');
	}

	function addAccessLayers() {
		if (!map?.isStyleLoaded() || !access?.features?.length) return;
		if (!map.getSource('access'))
			map.addSource('access', { type: 'geojson', data: getAccessData() });
		if (!map.getLayer('access-lines')) map.addLayer(accessLineLayer);
		if (!map.getLayer('access-points')) map.addLayer(accessPointsLayer);
	}

	function removeAccessLayers() {
		if (!map?.isStyleLoaded()) return;
		if (map.getLayer('access-points')) map.removeLayer('access-points');
		if (map.getLayer('access-lines')) map.removeLayer('access-lines');
		if (map.getSource('access')) map.removeSource('access');
	}

	$effect(() => {
		const source = map?.getSource('places');
		if (source && Array.isArray(locations)) {
			source.setData(getPlacesData());
			const selectedPath = $page.params.crag || '';
			updateSelectionStyle(selectedPath);
			setTimeout(() => updateSelectionStyle(selectedPath), 150);
		}
	});

	$effect(() => {
		const lifecycleKey = topoPaths;
		if (!lifecycleKey) return;
		syncTopoPathLayers();
	});

	$effect(() => {
		const lifecycleKey = accessKey;
		if (!lifecycleKey) return;
		if (!map?.isStyleLoaded()) return;
		if (access?.features?.length) {
			addAccessLayers();
			map.getSource('access')?.setData(getAccessData());
		} else {
			removeAccessLayers();
		}
	});

	$effect(() => {
		cameraTarget;
		applyCameraTarget();
	});

	$effect(() => {
		const selectedPath = $page.params.crag || '';
		updateSelectionStyle(selectedPath);

		let active = true;
		// Bomb-proof polling to ensure it catches MapLibre's canvas renderer regardless of async tile/layer lag
		if (selectedPath) {
			setTimeout(() => { if (active) updateSelectionStyle(selectedPath); }, 50);
			setTimeout(() => { if (active) updateSelectionStyle(selectedPath); }, 200);
			setTimeout(() => { if (active) updateSelectionStyle(selectedPath); }, 600);
			setTimeout(() => { if (active) updateSelectionStyle(selectedPath); }, 1200);
		}

		return () => {
			active = false;
		};
	});

	function updateSelectionStyle(selectedPath) {
		if (!map || !map.getLayer('places-dots')) return;

		if (!selectedPath) {
			map.setPaintProperty('places-dots', 'circle-color', placeTypeColor);
			map.setPaintProperty('places-dots', 'circle-opacity', ['step', ['zoom'], 1, 13.5, 0]);
			map.setPaintProperty('places-dots', 'circle-stroke-opacity', ['step', ['zoom'], 1, 13.5, 0]);
			map.setPaintProperty('places', 'text-color', 'rgba(47,57,72,1)');
			map.setPaintProperty('places', 'icon-opacity', ['step', ['zoom'], 0, 13.5, 1]);
			map.setLayoutProperty('places', 'icon-image', ['get', 'type']);
			return;
		}

		const isSelected = selectionExpression(selectedPath);

		// For dots, we set opacity to 0 when selected to avoid bleed-through
		map.setPaintProperty('places-dots', 'circle-opacity', [
			'step',
			['zoom'],
			['case', isSelected, 0, 1], // Zoom < 13.5
			13.5,
			0 // Zoom >= 13.5
		]);
		map.setPaintProperty('places-dots', 'circle-stroke-opacity', [
			'step',
			['zoom'],
			['case', isSelected, 0, 1],
			13.5,
			0
		]);

		// Change text color to red instantly
		map.setPaintProperty('places', 'text-color', [
			'case',
			isSelected,
			'#dc2626',
			'rgba(47,57,72,1)'
		]);

		// For icons, make sure the teardrop is visible even at low zoom levels!
		map.setPaintProperty('places', 'icon-opacity', [
			'step',
			['zoom'],
			['case', isSelected, 1, 0], // Zoom < 13.5 (show ONLY selected marker)
			13.5,
			1 // Zoom >= 13.5 (show all markers)
		]);

		// Swap the icon image instantly
		map.setLayoutProperty('places', 'icon-image', [
			'case',
			isSelected,
			'selected-marker',
			['get', 'type']
		]);
	}

	async function generateSelectedMarker() {
		if (map && !map.hasImage('selected-marker')) {
			const svg = `<svg width="48" height="72" viewBox="0 0 48 72" xmlns="http://www.w3.org/2000/svg"><path d="M24 2C13 2 4 11 4 22C4 37 24 48 24 48C24 48 44 37 44 22C44 11 35 2 24 2Z" fill="#dc2626" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="22" r="8" fill="#ffffff" /></svg>`;
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

	function applyCameraTarget() {
		if (!map || !map.isStyleLoaded() || !cameraTarget) return;

		const uiPadding = getMapPadding();

		if (cameraTarget.type === 'bounds' && cameraTarget.bounds) {
			const base = typeof cameraTarget.padding === 'number' ? cameraTarget.padding : 40;
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
		} else if (cameraTarget.center) {
			map.easeTo({
				center: cameraTarget.center,
				zoom: cameraTarget.zoom,
				padding: uiPadding,
				duration: 900
			});
		}
	}

	async function addMapImage(name, url) {
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
		map.setStyle(base + '/transport.json');
		tileLayerMenuOpen = false;
	}

	function setSatelliteTileLayer() {
		map.setStyle(base + '/satellite.json');
		tileLayerMenuOpen = false;
	}

	function setTerrainTileLayer() {
		map.setStyle(base + '/terrain.json');
		tileLayerMenuOpen = false;
	}

	let is3D = $state(false);

	function toggle3D() {
		is3D = !is3D;
		if (is3D) {
			map.setTerrain({ source: 'globalTerrainSource', exaggeration: 1 });
			map.easeTo({ pitch: 60 });
		} else {
			map.setTerrain(null);
			map.easeTo({ pitch: 0 });
		}
	}
</script>

<div
	class="fixed top-0 right-0 bottom-0 left-0 h-screen w-full {hasFilter
		? 'has-filter'
		: 'details-shown'}"
	bind:this={mapElement}
	style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;"
></div>
<div
	class="fixed sm:left-15 sm:right-auto right-4 z-[1000] flex flex-col items-center style-selector-btn gap-2 {hasFilter
		? 'has-filter'
		: ''}"
	role="group"
	aria-label="Map style selector"
	onmouseleave={() => (tileLayerMenuOpen = false)}
	style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;"
>
	<button
		aria-label="Choose map style"
		class="cursor-pointer bg-white w-10 h-10 max-sm:w-11 max-sm:h-11 flex items-center justify-center hover:text-white hover:bg-ink rounded-2xl border-1 border-gray-200 transition-all shadow-md text-gray-600"
		onmouseenter={() => (tileLayerMenuOpen = !tileLayerMenuOpen)}
		><i class="fa-solid fa-layer-group text-lg"></i></button
	>
	{#if tileLayerMenuOpen}
		<div
			class="flex flex-col justify-center gap-2"
			in:slide={{ duration: 200 }}
			out:slide={{ duration: 200 }}
		>
			<button
				aria-label="Show transport map"
				class="cursor-pointer w-10 h-10 max-sm:w-11 max-sm:h-11 flex items-center justify-center hover:text-white hover:bg-ink bg-white border-1 border-gray-200 rounded-2xl shadow-md text-gray-600"
				onclick={setTransportTileLayer}
			>
				<i class="fa-solid fa-bus-simple"></i>
			</button>
			<button
				aria-label="Show satellite map"
				class="cursor-pointer w-10 h-10 max-sm:w-11 max-sm:h-11 flex items-center justify-center hover:text-white hover:bg-ink bg-white border-1 border-gray-200 rounded-2xl shadow-md text-gray-600"
				onclick={setSatelliteTileLayer}
			>
				<i class="fa-solid fa-satellite"></i>
			</button>
			<button
				aria-label="Show terrain map"
				class="cursor-pointer w-10 h-10 max-sm:w-11 max-sm:h-11 flex items-center justify-center hover:text-white hover:bg-ink bg-white border-1 border-gray-200 rounded-2xl shadow-md text-gray-600"
				onclick={setTerrainTileLayer}
			>
				<i class="fa-solid fa-mountain"></i>
			</button>
		</div>
	{/if}
</div>

<div
	class="fixed sm:left-15 sm:right-auto right-4 z-[1000] flex flex-col items-center btn-3d-toggle gap-2 {hasFilter
		? 'has-filter'
		: ''}"
	style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;"
>
	<button
		class="cursor-pointer w-10 h-10 max-sm:w-11 max-sm:h-11 flex items-center justify-center rounded-2xl border-1 transition-all shadow-md {is3D
			? 'text-white bg-ink border-ink hover:opacity-90'
			: 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'}"
		onclick={toggle3D}><span class="font-bold text-sm">{is3D ? '3D' : '2D'}</span></button
	>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
	@import 'tailwindcss';

	.style-selector-btn {
		@media (width > 40rem) {
			top: calc(14.75rem + var(--dropdown-offset, 0px));
		}
		@media (width <= 40rem) {
			top: calc(11.25rem + var(--dropdown-offset, 0px));
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

	.style-selector-btn.has-filter {
		@media (width <= 40rem) {
			top: calc(14.5rem + var(--dropdown-offset, 0px));
		}
	}

	.btn-3d-toggle {
		@media (width > 40rem) {
			top: calc(11.75rem + var(--dropdown-offset, 0px));
		}
		@media (width <= 40rem) {
			top: calc(8rem + var(--dropdown-offset, 0px));
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

	.btn-3d-toggle.has-filter {
		@media (width <= 40rem) {
			top: calc(11.25rem + var(--dropdown-offset, 0px));
		}
	}

	:global(.maplibregl-ctrl-group) {
		@apply cursor-pointer bg-white rounded-2xl w-10 h-10 border-1 border-gray-200 transition-all flex items-center justify-center;
		margin: 0 0 0.5rem 0 !important;
	}

	:global(.maplibregl-ctrl-group) {
		@media (width <= 40rem) {
			@apply w-11 h-11;
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
		@apply w-full h-full rounded-2xl;
	}

	:global(.maplibregl-ctrl-group:not(:empty)) {
		@apply shadow-md;
	}

	:global(.maplibregl-ctrl-bottom-right) {
		@apply bottom-2 right-2;
	}

	:global(.maplibregl-ctrl-bottom-right) {
		@media (width <= 40rem) {
			@apply left-2 right-auto;
			bottom: 4.5rem;
		}
	}

	:global(.maplibregl-ctrl-top-right) {
		@apply fixed left-15 right-auto z-[1000] !m-0;
		top: calc(5rem + var(--dropdown-offset, 0px));
	}

	:global(.maplibregl-ctrl-top-right) {
		@media (width <= 40rem) {
			@apply left-auto right-4 top-auto;
			top: calc(4.75rem + var(--dropdown-offset, 0px));
			bottom: auto;
			transition: top 0.2s ease-out;
		}
	}

	:global(.has-filter .maplibregl-ctrl-top-right) {
		@media (width <= 40rem) {
			top: calc(8rem + var(--dropdown-offset, 0px));
		}
	}

	:global(.maplibregl-ctrl-top-right) {
		@media (width > 40rem) {
			top: calc(5.75rem + var(--dropdown-offset, 0px));
		}
	}

	:global(.maplibregl-ctrl-group:has(.maplibregl-ctrl-geolocate)) {
		@media (width <= 40rem) {
			position: fixed;
			right: 1rem;
			bottom: 5rem;
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
