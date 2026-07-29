<script>
	import { base } from '$app/paths';
	import { slide } from 'svelte/transition';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { slowRasterTileDecay } from '$lib/assets/js/map-raster-lod.js';

	/** @type {{locations?: any, access?: any, accessKey?: string, tracks?: any, pitch?: number}} */
	let {
		locations = [],
		access = null,
		accessKey = '',
		cameraTarget = {type: 'center', center: [16.0, 48.0], zoom: 8 }
	} = $props();

	let mapElement = $state();
	let map;
	let tileLayerMenuOpen = $state(false);
	const placeTypeColor = ['match', ['get', 'type'],
		'sports-climbing', '#3b82f6', 'multi-pitch', '#10b981', 'bouldering', '#f97316',
		'trad', '#eab308', 'alpine-tour', '#8b5cf6', 'via-ferrata', '#ec4899',
		'bus', '#6366f1', 'train', '#8b5cf6', 'parking-space', '#6b7280', '#3b82f6'];

	const placesLayer = {
		id: 'places', type: 'symbol', source: 'places', minzoom: 11.5,
		filter: [
			'all',
			['!=', ['geometry-type'], 'Polygon'],
			['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 0]]
		],
		layout: {
			'icon-image': ['get', 'type'], 'icon-size': 0.55, 'icon-allow-overlap': true,
			'text-optional': true, 'text-field': ['get', 'name'], 'text-offset': [0, 1.8],
			'text-anchor': 'top', 'text-font': ['Noto Sans Bold'], 'text-size': 14,
			'visibility': 'visible', 'text-max-width': 8
		},
		paint: {
			'text-color': 'rgba(47,57,72,1)', 'text-halo-blur': 0,
			'text-halo-color': 'rgba(255,255,255,1)', 'text-halo-width': 3,
			'icon-opacity': ['step', ['zoom'], 0, 13.5, 1],
			'icon-opacity-transition': { duration: 400 },
			'text-opacity': ['step', ['zoom'], 0, 13.5, 1],
			'text-opacity-transition': { duration: 400 }
		}
	};

	const placesDotsLayer = {
		id: 'places-dots', type: 'circle', source: 'places', maxzoom: 14,
		filter: ['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 0]],
		paint: {
			'circle-color': placeTypeColor,
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 12, 4.5],
			'circle-radius-transition': { duration: 400 }, 'circle-stroke-width': 0,
			'circle-stroke-color': '#ffffff', 'circle-opacity': ['step', ['zoom'], 1, 13.5, 0],
			'circle-opacity-transition': { duration: 400 },
			'circle-stroke-opacity': ['step', ['zoom'], 1, 13.5, 0],
			'circle-stroke-opacity-transition': { duration: 400 }
		}
	};

	const sectorFillLayer = {
		id: 'sector-fill', type: 'fill', source: 'places',
		filter: [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 13]]
		],
		paint: { 'fill-color': placeTypeColor, 'fill-opacity': 0.12 }
	};

	const sectorLineLayer = {
		id: 'sector-line', type: 'line', source: 'places',
		filter: [
			'all',
			['==', ['geometry-type'], 'Polygon'],
			['>=', ['zoom'], ['coalesce', ['to-number', ['get', 'minzoom']], 13]]
		],
		paint: { 'line-color': placeTypeColor, 'line-width': 2, 'line-opacity': 0.7 }
	};

	const sectorLabelsLayer = {
		id: 'sector-labels', type: 'symbol', source: 'places',
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
			'text-color': '#000',
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}
	};

	const accessLineLayer = {
		id: 'access-lines',
		type: 'line',
		source: 'access',
		filter: ['==', ['get', 'kind'], 'approach'],
		paint: {
			'line-color': '#10b981',
			'line-width': 4,
			'line-opacity': 0.9
		}
	};

	const accessPointsLayer = {
		id: 'access-points',
		type: 'symbol',
		source: 'access',
		filter: ['==', ['geometry-type'], 'Point'],
		layout: {
			'icon-image': [
				'match',
				['get', 'kind'],
				'parking', 'parking',
				['coalesce', ['get', 'mode'], 'bus']
			],
			'icon-size': 0.65,
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-offset': [
				'match',
				['get', 'kind'],
				'parking', ['literal', [0, -8]],
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
			'text-color': '#2f3948',
			'text-halo-color': '#fff',
			'text-halo-width': 3
		}
	};

	onMount(async () => {
		map = new maplibregl.Map({
			container: mapElement,
			zoom: cameraTarget.zoom,
			center: cameraTarget.center,
			pitch: 0,
			hash: true,
			style: base + '/terrain.json',
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
			applyCameraTarget();
			slowRasterTileDecay(map);
		});
		map.on('style.load', async () => {
			slowRasterTileDecay(map);
			map.once('idle', async () => {
				await drawLayers();
				applyCameraTarget();
			});
		});

		map.on('mouseenter', 'places', function() {
			if (map.getZoom() >= 12.0) {
				map.getCanvas().style.cursor = 'pointer';
			}
		});

		map.on('mouseleave', 'places', function() {
			map.getCanvas().style.cursor = 'default';
		});

		map.on('mouseenter', 'places-dots', function() {
			if (map.getZoom() < 12.0) {
				map.getCanvas().style.cursor = 'pointer';
			}
		});

		map.on('mouseleave', 'places-dots', function() {
			map.getCanvas().style.cursor = 'default';
		});

		map.on('click', 'places-dots', (e) => {
			if (map.getZoom() < 12.0 && e.features[0]?.properties?.path)
				openPlace(e.features[0].properties.path, e.features[0].geometry.coordinates);
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
	});

	function openPlace(path, coordinates) {
		goto(`${base}/map/crag/${path}`);
	}


	async function drawLayers() {
		if (!map || !map.isStyleLoaded()) return;
		try {
			await addMapImage('sports-climbing', base + '/icons/sports-climbing.png');
			await addMapImage('multi-pitch', base + '/icons/multi-pitch.png');
			await addMapImage('bouldering', base + '/icons/bouldering.png');
			await addMapImage('alpine-tour', '/icons/alpine-tour.png');
			await addMapImage('via-ferrata', '/icons/via-ferrata.png');
			await addMapImage('train', base + '/icons/train.png');
			await addMapImage('bus', base + '/icons/bus.png');
			await addMapImage('parking', base + '/icons/parking.png');
			await addMapImage('parking-space', base + '/icons/parking.png');
			if (access?.features?.length) addAccessLayers();
			addPlacesLayers();
		} catch (error) {
			console.error('Failed to restore map layers after style change', error);
		}
	}

	function getPlacesData() {
		const placeFeatures = Array.isArray(locations)
			? locations.map((feature) => {
				const properties = feature?.properties || {};
				const rawType = properties.type;
				const type = Array.isArray(rawType)
					? rawType[0] || null
					: typeof rawType === 'string'
						? rawType.split(',')[0].trim() || null
						: rawType;

				return {
					...feature,
					properties: { ...properties, type }
				};
			})
			: [];
		return {
			type: 'FeatureCollection',
			features: placeFeatures
		};
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

	function addAccessLayers() {
		if (!map?.isStyleLoaded() || !access?.features?.length) return;
		if (!map.getSource('access')) map.addSource('access', { type: 'geojson', data: getAccessData() });
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
		if (source && Array.isArray(locations)) source.setData(getPlacesData());
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

	function applyCameraTarget() {
		if (!map || !map.isStyleLoaded() || !cameraTarget) return;

		if (cameraTarget.type === 'bounds' && cameraTarget.bounds) {
			map.fitBounds(cameraTarget.bounds, {
				padding: cameraTarget.padding ?? 80,
				maxZoom: cameraTarget.maxZoom ?? 18,
				duration: 900
			});
		} else if (cameraTarget.center) {
			map.easeTo({ center: cameraTarget.center, zoom: cameraTarget.zoom, duration: 900 });
		}
	}

	async function addMapImage(name, url) {
		try {
			const img = await map.loadImage(url);
			if (!map.hasImage(name)) map.addImage(name, img.data);
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
</script>

<div
	class="fixed top-0 right-0 bottom-0 left-0 h-screen w-full"
	bind:this={mapElement}
></div>
<div
	class="fixed sm:left-15 sm:right-auto right-4 sm:top-37 z-[1000] flex sm:flex-col flex-col-reverse items-center style-selector-btn"
	onmouseleave={() => (tileLayerMenuOpen = false)}
>
	<button
		class="cursor-pointer bg-white w-12 h-12 max-sm:w-13 max-sm:h-13 flex items-center justify-center hover:text-white hover:bg-ink rounded-full border-1 border-gray-200 transition-all shadow-md text-gray-600"
		onmouseenter={() => (tileLayerMenuOpen = !tileLayerMenuOpen)}
		class:sm:rounded-b-none={tileLayerMenuOpen}
		class:max-sm:rounded-t-none={tileLayerMenuOpen}
	><i class="fa-solid fa-layer-group text-lg"></i></button
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

    .style-selector-btn {
        @media (width <= 40rem) {
            bottom: var(--dynamic-bottom, 9.25rem);
            transition: var(--info-panel-transition, bottom 0.2s ease-out),
            opacity 0.2s ease-out,
            transform 0.2s ease-out;
            opacity: var(--controls-opacity, 1);
            transform: scale(var(--controls-scale, 1));
            transform-origin: center;
            pointer-events: var(--controls-pointer, auto);
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
        @apply fixed left-15 top-20 right-auto z-[1000] !m-0;
    }

    :global(.maplibregl-ctrl-top-right) {
        @media (width <= 40rem) {
            @apply left-auto right-4 top-auto;
            bottom: 5rem;
            transition: var(--info-panel-transition, bottom 0.2s ease-out),
            opacity 0.2s ease-out,
            transform 0.2s ease-out;
            opacity: var(--controls-opacity, 1);
            transform: scale(var(--controls-scale, 1));
            transform-origin: center;
            pointer-events: var(--controls-pointer, auto);
        }
    }

    :global(.details-shown .maplibregl-ctrl-top-right) {
        @media (width <= 40rem) {
            bottom: calc(var(--info-panel-height, 50vh) + 16px) !important;
        }
    }

    :global(.maplibregl-ctrl-top-right) {
        @media (width > 40rem) {
            top: 5.75rem;
        }
    }
</style>
