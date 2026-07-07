<script>
	import { base } from '$app/paths';
	import { slide } from 'svelte/transition';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { slowRasterTileDecay } from '$lib/assets/js/map-raster-lod.js';
	import { fsApiUrl } from '$lib/config';
	import * as turf from '@turf/turf';

	afterNavigate((_navigation) => {
		fillLayers(locations);
		if (zoomToLocations) {
			const markerTarget = nextMarkerTarget || cameraTarget;
			nextMarkerTarget = null;
			if (markerTarget?.center) {
				focusMarker(markerTarget.center, markerTarget.zoom);
				return;
			}
			const requestedMinZoom = cameraTarget?.zoom || null;
			const coordinates = places.features.map((it) => it.geometry.coordinates);
			const bounds = coordinates.reduce(
				(bounds, coord) => {
					return bounds.extend(coord);
				},
				new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
			);
			const mediaQuery = '(min-width: 40rem)';
			const queries = window.matchMedia(mediaQuery);
			if (detailsShown) {
				if (queries.matches) {
					fitBounds(bounds, requestedMinZoom, {
						pitch,
						padding: { left: 200, top: 200, bottom: 200, right: 1000 }
					});
				} else {
					fitBounds(bounds, requestedMinZoom, {
						pitch,
						padding: { left: 50, top: 100, bottom: 600, right: 50 }
					});
				}
			} else {
				if (queries.matches) {
					fitBounds(bounds, requestedMinZoom, { pitch, padding: 200 });
				} else {
					fitBounds(bounds, requestedMinZoom, { pitch, padding: 100 });
				}
			}
		}
	});

	/** @type {{locations?: any, tracks?: any, zoom?: number, center?: any, pitch?: number}} */
	let {
		locations = [],
		tracks = [],
		zoom = 8,
		center = [16.0, 48],
		pitch = 50,
		detailsShown = false,
		zoomToLocations = false,
		cameraTarget = null
	} = $props();

	let mapElement = $state();
	let map;
	let tileLayerMenuOpen = $state(false);
	let places;
	let routes;
	let sectorShapes;
	let cragFeatures = [];
	let sectorPointFeatures = [];
	let poiFeatures = [];
	let poiRoutes = [];
	let nextMarkerTarget = null;
	let lastCameraTargetKey = null;

	// Module-level cache to persist POIs across navigations
	const poiCache = new Map();

	const sectorDetailZoom = 16.5;
	const poiDetailZoom = 14;

	$effect(() => {
		if (!map || !zoomToLocations || !cameraTarget?.center) return;

		const cameraTargetKey = JSON.stringify(cameraTarget);
		if (cameraTargetKey === lastCameraTargetKey) return;
		lastCameraTargetKey = cameraTargetKey;

		focusMarker(cameraTarget.center, cameraTarget.zoom);
	});

	function updateMarkerVisibility() {
		if (!map || !map.getLayer('places') || !map.getLayer('places-dots')) return;

		if (zoomToLocations) {
			map.setLayerZoomRange('places', 0, 24);
			map.setPaintProperty('places', 'icon-opacity', 1);
			map.setPaintProperty('places', 'text-opacity', 1);
			map.setPaintProperty('places-dots', 'circle-opacity', 0);
			map.setPaintProperty('places-dots', 'circle-stroke-opacity', 0);
		} else {
			map.setLayerZoomRange('places', 11.5, 24);
			map.setPaintProperty('places', 'icon-opacity', ['step', ['zoom'], 0.0, 12.0, 1.0]);
			map.setPaintProperty('places', 'text-opacity', ['step', ['zoom'], 0.0, 12.0, 1.0]);
			map.setPaintProperty('places-dots', 'circle-opacity', ['step', ['zoom'], 1.0, 12.0, 0.0]);
			map.setPaintProperty('places-dots', 'circle-stroke-opacity', ['step', ['zoom'], 1.0, 12.0, 0.0]);
		}
	}

	$effect(() => {
		updateMarkerVisibility();
	});

	onMount(() => {
		function onFocusMapTarget(event) {
			nextMarkerTarget = event.detail;
		}

		window.addEventListener('crag-review:focus-map-target', onFocusMapTarget);

		return () => {
			window.removeEventListener('crag-review:focus-map-target', onFocusMapTarget);
		};
	});

	onMount(async () => {
		map = new maplibregl.Map({
			container: mapElement,
			zoom: zoom,
			center: center,
			pitch: 0,
			hash: true,
			style: base + '/transport.json',
			maxZoom: 18,
			maxPitch: 75
		});

		map.addControl(
			new maplibregl.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true
				},
				trackUserLocation: true
			})
		);

		map.getCanvas().style.cursor = 'default';

		map.on('click', 'places', (e) => {
			if (map.getZoom() >= 12.0 && e.features[0]?.properties?.path)
				openPlace(e.features[0].properties.path, e.features[0].geometry.coordinates);
		});

		map.on('load', async () => {
			await drawLayers();
			map.on('styledata', async () => drawLayers());
			checkAndLoadVisiblePois();
		});
		map.on('style.load', () => slowRasterTileDecay(map));
		map.on('zoom', updateVisiblePlaces);
		map.on('moveend', checkAndLoadVisiblePois);

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
			if (map.getZoom() < 12.0 && e.features[0]?.properties?.path)
				openPlace(e.features[0].properties.path, e.features[0].geometry.coordinates);
		});
	});

	function openPlace(path, coordinates) {
		nextMarkerTarget = { center: coordinates };
		goto(`${base}/map/crag/${path}`);
	}

	function focusMarker(markerCenter, requestedMinZoom = null) {
		map.easeTo({
			center: markerCenter,
			zoom: Math.max(map.getZoom(), requestedMinZoom || zoom),
			pitch
		});
	}

	function fitBounds(bounds, requestedMinZoom, options) {
		if (!requestedMinZoom) {
			map.fitBounds(bounds, options);
			return;
		}

		const camera = map.cameraForBounds(bounds, options);
		if (!camera) {
			map.fitBounds(bounds, options);
			return;
		}

		map.easeTo({
			...camera,
			zoom: Math.max(camera.zoom, requestedMinZoom),
			pitch: options.pitch ?? pitch
		});
	}

	function fillLayers(locations) {
		places = {
			type: 'FeatureCollection',
			features: []
		};
		routes = {
			type: 'FeatureCollection',
			features: []
		};
		sectorShapes = {
			type: 'FeatureCollection',
			features: []
		};
		cragFeatures = [];
		sectorPointFeatures = [];
		poiFeatures = [];
		poiRoutes = [];
		
		locations.forEach((location) => {
			const processedLocation = JSON.parse(JSON.stringify(location));
			if (['parking-space', 'bus', 'train'].includes(processedLocation.properties?.type)) {
				poiFeatures.push(processedLocation);
				return;
			}
			
			if (Array.isArray(processedLocation.properties.type)) {
				processedLocation.properties.type = processedLocation.properties.type[0];
			}
			const sectors = processedLocation.properties.sectors || [];
			processedLocation.properties.hasSectors = sectors.length > 0;
			cragFeatures.push(processedLocation);
			
			const path = processedLocation.properties.path;
			if (path && !poiCache.has(path)) {
				poiCache.set(path, {
					parking: processedLocation.properties.parking,
					transit: processedLocation.properties.transit,
					transitTrack: processedLocation.properties.transitTrack
				});
			} else if (path && poiCache.has(path)) {
				const cached = poiCache.get(path);
				if (!processedLocation.properties.parking && cached.parking) processedLocation.properties.parking = cached.parking;
				if (!processedLocation.properties.transit && cached.transit) processedLocation.properties.transit = cached.transit;
				if (!processedLocation.properties.transitTrack && cached.transitTrack) processedLocation.properties.transitTrack = cached.transitTrack;
			}
			
			if (processedLocation.properties.parking) {
				poiFeatures.push(processedLocation.properties.parking);
			}
			if (processedLocation.properties.transit) {
				poiFeatures.push(processedLocation.properties.transit);
			}
			if (processedLocation.properties.transitTrack) {
				poiRoutes.push(processedLocation.properties.transitTrack);
			}

			sectors.forEach((sector) => {
				const sectorCoordinates = getSectorCoordinates(sector.geometry);
				if (!sectorCoordinates) return;
				const sectorProperties = {
					name: sector.name,
					path: `${processedLocation.properties.path}/${sector.id}`,
					type: processedLocation.properties.type,
					parentCrag: processedLocation.properties.name,
					isSector: true
				};

				if (isPolygonGeometry(sector.geometry)) {
					const feature = {
						type: 'Feature',
						geometry: sector.geometry,
						properties: sectorProperties
					};
					try {
						// Morphological opening: shrink then expand to round convex corners without increasing the size
						const shrunk = turf.buffer(feature, -1.5, { units: 'meters', steps: 16 });
						if (shrunk && shrunk.geometry && shrunk.geometry.type) {
							const rounded = turf.buffer(shrunk, 1.5, { units: 'meters', steps: 16 });
							sectorShapes.features.push(rounded && rounded.geometry ? rounded : feature);
						} else {
							// If the polygon is too small and disappears when shrunk, keep the original
							sectorShapes.features.push(feature);
						}
					} catch (e) {
						sectorShapes.features.push(feature);
					}
				}

				sectorPointFeatures.push({
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: sectorCoordinates
					},
					properties: sectorProperties
				});
			});
		});
		updateVisiblePlaces();
		if (map?.loaded) drawLayers();
	}

	function updateVisiblePlaces() {
		if (!places) return;

		const showSectorDetail = (map?.getZoom() || 0) >= sectorDetailZoom;
		const showPoiDetail = (map?.getZoom() || 0) >= poiDetailZoom || detailsShown;

		const visibleCrags = showSectorDetail
			? cragFeatures.filter((feature) => !feature.properties.hasSectors)
			: cragFeatures;

		places.features = [
			...visibleCrags,
			...(showSectorDetail ? sectorPointFeatures : []),
			...(showPoiDetail ? poiFeatures : [])
		];

		map?.getSource('places')?.setData(places);
		
		if (routes) {
			routes.features = [
				...tracks,
				...(showPoiDetail ? poiRoutes : [])
			];
			map?.getSource('routes')?.setData(routes);
		}
	}

	function isPolygonGeometry(geometry) {
		return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
	}

	function getSectorCoordinates(geometry) {
		if (!geometry?.coordinates) return null;
		if (geometry.type === 'Point') return geometry.coordinates;

		const coordinates = getGeometryCoordinates(geometry);

		if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

		const usableCoordinates =
			coordinates.length > 1 &&
			coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
			coordinates[0][1] === coordinates[coordinates.length - 1][1]
				? coordinates.slice(0, -1)
				: coordinates;

		const sums = usableCoordinates.reduce(
			(acc, coordinate) => [acc[0] + coordinate[0], acc[1] + coordinate[1]],
			[0, 0]
		);

		return [sums[0] / usableCoordinates.length, sums[1] / usableCoordinates.length];
	}

	function getGeometryCoordinates(geometry) {
		if (geometry.type === 'Polygon') return geometry.coordinates?.[0];
		if (geometry.type === 'MultiPolygon')
			return geometry.coordinates?.flatMap((polygon) => polygon[0]);
		return geometry.coordinates;
	}
	
	const loadedPoisForCrags = new Set();

	async function checkAndLoadVisiblePois() {
		if (!map) return;
		const showPoiDetail = (map.getZoom() || 0) >= poiDetailZoom || detailsShown;
		if (!showPoiDetail) return;
		
		const bounds = map.getBounds();
		const visibleCrags = cragFeatures.filter(feature => {
			if (!feature.properties || !feature.properties.path) return false;
			const path = feature.properties.path;
			if (loadedPoisForCrags.has(path) || (poiCache.has(path) && poiCache.get(path).fetched)) return false;
			
			// Only load for actual crags
			const type = feature.properties.type;
			if (type !== 'sports-climbing' && type !== 'bouldering' && type !== 'trad' && type !== 'multi-pitch') return false;
			
			let coord;
			if (feature.geometry?.type === 'Point') {
				coord = feature.geometry.coordinates;
			} else if (feature.geometry?.type === 'Polygon') {
				coord = feature.geometry.coordinates[0]?.[0];
			} else if (feature.geometry?.type === 'MultiPolygon') {
				coord = feature.geometry.coordinates[0]?.[0]?.[0];
			} else {
				return false;
			}
			
			return bounds.contains(coord);
		});

		if (visibleCrags.length === 0) return;

		for (const crag of visibleCrags) {
			loadedPoisForCrags.add(crag.properties.path);
		}

		let added = false;
		await Promise.all(visibleCrags.map(async (crag) => {
			const cragPath = crag.properties.path;
			const cragSlug = cragPath.split('/').at(-1);
			const cached = poiCache.get(cragPath) || {};

			try {
				const parkingRes = await fetch(`${fsApiUrl}/${cragPath}/${cragSlug}-parking.json`);
				if (parkingRes.ok) {
					const parking = await parkingRes.json();
					crag.properties.parking = parking;
					poiFeatures.push(parking);
					cached.parking = parking;
					added = true;
				}
			} catch (e) {}

			try {
				const transitRes = await fetch(`${fsApiUrl}/${cragPath}/${cragSlug}-transit.json`);
				if (transitRes.ok) {
					const transit = await transitRes.json();
					crag.properties.transit = transit;
					poiFeatures.push(transit);
					cached.transit = transit;
					added = true;
				}
			} catch (e) {}

			try {
				const trackRes = await fetch(`${fsApiUrl}/${cragPath}/${cragSlug}-transit-track.json`);
				if (trackRes.ok) {
					const track = await trackRes.json();
					crag.properties.transitTrack = track;
					poiRoutes.push(track);
					cached.transitTrack = track;
					added = true;
				}
			} catch (e) {}
			
			cached.fetched = true;
			poiCache.set(cragPath, cached);
		}));

		if (added) {
			updateVisiblePlaces();
		}
	}

	async function drawLayers() {
		await addMapImage('sports-climbing', base + '/icons/sports-climbing.png');
		await addMapImage('multi-pitch', base + '/icons/multi-pitch.png');
		await addMapImage('bouldering', base + '/icons/bouldering.png');
		await addMapImage('train', base + '/icons/train.png');
		await addMapImage('bus', base + '/icons/bus.png');
		await addMapImage('parking-space', base + '/icons/parking.png');
		addSectorShapeLayers();
		updateVisiblePlaces();
		map.getSource('places').setData(places);
		map.getSource('routes').setData(routes);
		map.getSource('sector-shapes').setData(sectorShapes);

		updateMarkerVisibility();
	}

	async function addMapImage(name, url) {
		if (map.hasImage(name)) return;
		map.addImage(name, (await map.loadImage(url)).data);
	}

	function addSectorShapeLayers() {
		if (!map.getSource('sector-shapes')) {
			map.addSource('sector-shapes', {
				type: 'geojson',
				data: sectorShapes
			});
		}

		if (!map.getLayer('sector-shapes-fill')) {
			map.addLayer(
				{
					id: 'sector-shapes-fill',
					type: 'fill',
					source: 'sector-shapes',
					minzoom: sectorDetailZoom,
					paint: {
						'fill-color': [
							'match',
							['get', 'type'],
							'sports-climbing',
							'#3b82f6',
							'multi-pitch',
							'#10b981',
							'bouldering',
							'#f97316',
							'trad',
							'#eab308',
							'bus',
							'#6366f1',
							'train',
							'#8b5cf6',
							'parking-space',
							'#6b7280',
							'#3b82f6'
						],
						'fill-opacity': 0.18
					}
				},
				'places'
			);
		}

		if (!map.getLayer('sector-shapes-outline')) {
			map.addLayer(
				{
					id: 'sector-shapes-outline',
					type: 'line',
					source: 'sector-shapes',
					minzoom: sectorDetailZoom,
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': [
							'match',
							['get', 'type'],
							'sports-climbing',
							'#3b82f6',
							'multi-pitch',
							'#10b981',
							'bouldering',
							'#f97316',
							'trad',
							'#eab308',
							'bus',
							'#6366f1',
							'train',
							'#8b5cf6',
							'parking-space',
							'#6b7280',
							'#3b82f6'
						],
						'line-width': 2.5,
						'line-opacity': 0.9
					}
				},
				'places'
			);
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
</script>

<div class="sticky h-screen w-screen top-0 bottom-0 left-0 right-0" bind:this={mapElement} class:details-shown={detailsShown}></div>
<div
	class="fixed sm:left-15 sm:right-auto right-4 sm:top-37 z-[1000] flex sm:flex-col flex-col-reverse items-center style-selector-btn"
	style={detailsShown ? `--dynamic-bottom: calc(var(--info-panel-height, 50vh) + 84px);` : ''}
	onmouseleave={() => (tileLayerMenuOpen = false)}
>
	<button
		class="cursor-pointer bg-white w-12 h-12 max-sm:w-13 max-sm:h-13 flex items-center justify-center hover:text-white hover:bg-ink rounded-full border-1 border-gray-200 transition-all shadow-md text-gray-600"
		onmouseenter={() => (tileLayerMenuOpen = !tileLayerMenuOpen)}
		class:sm:rounded-b-none={tileLayerMenuOpen}
		class:max-sm:rounded-t-none={tileLayerMenuOpen}><i class="fa-solid fa-layer-group text-lg"></i></button
	>
	{#if tileLayerMenuOpen}
		<div
			class="flex flex-col justify-center"
			in:slide={{ duration: 200 }}
			out:slide={{ duration: 200 }}
		>
			<button
				class="cursor-pointer w-12 h-12 max-sm:w-13 max-sm:h-13 flex items-center justify-center hover:text-white hover:bg-ink bg-white border-1 border-gray-200 sm:rounded-t-none max-sm:rounded-t-full text-gray-600"
				onclick={setTransportTileLayer}
			>
				<i class="fa-solid fa-bus-simple"></i>
			</button>
			<button
				class="cursor-pointer w-12 h-12 max-sm:w-13 max-sm:h-13 flex items-center justify-center hover:text-white hover:bg-ink bg-white border-1 border-gray-200 text-gray-600"
				onclick={setSatelliteTileLayer}
			>
				<i class="fa-solid fa-satellite"></i>
			</button>
			<button
				class="cursor-pointer w-12 h-12 max-sm:w-13 max-sm:h-13 flex items-center justify-center hover:text-white hover:bg-ink bg-white border-1 border-gray-200 sm:rounded-b-full max-sm:rounded-b-none text-gray-600"
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

	:global(.maplibregl-ctrl-top-right) {
		@apply fixed left-15 top-20 right-auto z-[1000] !m-0;
	}

	:global(.maplibregl-ctrl-top-right) {
		@media (width <= 40rem) {
			@apply left-auto right-4 top-auto;
			bottom: 5rem;
			transition: var(--info-panel-transition, bottom 0.2s ease-out);
		}
	}

	:global(.details-shown .maplibregl-ctrl-top-right) {
		@media (width <= 40rem) {
			bottom: calc(var(--info-panel-height, 50vh) + 16px) !important;
		}
	}

	.style-selector-btn {
		@media (width <= 40rem) {
			bottom: var(--dynamic-bottom, 9.25rem);
			transition: var(--info-panel-transition, bottom 0.2s ease-out);
		}
	}

	:global(.maplibregl-ctrl-group) {
		@apply cursor-pointer bg-white rounded-full w-12 h-12 border-1 border-gray-200 transition-all flex items-center justify-center !m-0;
	}

	:global(.maplibregl-ctrl-group) {
		@media (width <= 40rem) {
			@apply w-13 h-13;
		}
	}

	:global(.maplibregl-ctrl-group button) {
		@apply w-full h-full rounded-full;
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
		@media (width > 40rem) {
			top: 5.75rem;
		}
	}
</style>
