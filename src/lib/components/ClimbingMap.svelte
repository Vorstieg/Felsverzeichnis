<script>
	import { base } from '$app/paths';
	import { slide } from 'svelte/transition';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';

	afterNavigate((_navigation) => {
		fillLayers(locations);
		if (zoomToLocations) {
			const coordinates = places.features.map(it => it.geometry.coordinates);
			const bounds = coordinates.reduce((bounds, coord) => {
				return bounds.extend(coord);
			}, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
			const mediaQuery = '(min-width: 40rem)';
			const queries = window.matchMedia(mediaQuery);
			if (detailsShown) {
				if (queries.matches) {
					map.fitBounds(bounds, { pitch, padding: { left: 200, top: 200, bottom: 200, right: 1000 } });
				} else {
					map.fitBounds(bounds, { pitch, padding: { left: 50, top: 100, bottom: 600, right: 50 } });
				}
			} else {
				if (queries.matches) {
					map.fitBounds(bounds, { pitch, padding: 200 });
				} else {
					map.fitBounds(bounds, { pitch, padding: 100 });
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
		zoomToLocations = false
	} = $props();

	let mapElement = $state();
	let map;
	let tileLayerMenuOpen = $state(false);
	let places;
	let routes;

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
			if (e.features[0]?.properties?.path)
				goto(`${base}/map/crag/${e.features[0].properties.path}`);
		});

		map.on('load', async () => {
			await drawLayers();
			map.on('styledata', async () => drawLayers());
		});

		map.on('mouseenter', 'places', function() {
			map.getCanvas().style.cursor = 'pointer';
		});

		map.on('mouseleave', 'places', function() {
			map.getCanvas().style.cursor = 'default';
		});

		map.on('mouseenter', 'places-cluster', function() {
			map.getCanvas().style.cursor = 'pointer';
		});

		map.on('mouseleave', 'places-cluster', function() {
			map.getCanvas().style.cursor = 'default';
		});

		map.on('click', 'places-cluster', async (e) => {
			const features = map.queryRenderedFeatures(e.point, {
				layers: ['places-cluster']
			});
			const clusterId = features[0].properties.cluster_id;
			const zoom = await map.getSource('places').getClusterExpansionZoom(clusterId);

			map.easeTo({
				center: features[0].geometry.coordinates,
				zoom
			});
		});
	});

	function fillLayers(locations) {
		places = {
			'type': 'FeatureCollection',
			'features': []
		};
		routes = {
			'type': 'FeatureCollection',
			'features': []
		};
		tracks.forEach((track) => {
			routes.features.push(track);
		});
		locations.forEach((location) => {
			places.features.push(location);
		});
		if (map?.loaded) drawLayers();
	}

	async function drawLayers() {
		map.addImage('sports-climbing', (await map.loadImage(base + '/icons/sports-climbing.png')).data);
		map.addImage('multi-pitch', (await map.loadImage(base + '/icons/multi-pitch.png')).data);
		map.addImage('bouldering', (await map.loadImage(base + '/icons/bouldering.png')).data);
		map.addImage('train', (await map.loadImage(base + '/icons/train.png')).data);
		map.addImage('bus', (await map.loadImage(base + '/icons/bus.png')).data);
		map.addImage('cluster', (await map.loadImage(base + '/icons/cluster.png')).data);
		map.addImage('parking-space', (await map.loadImage(base + '/icons/parking.png')).data);
		map.getSource('places').setData(places);
		map.getSource('routes').setData(routes);
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

<div class="sticky h-screen w-screen top-0 bottom-0 left-0 right-0" bind:this={mapElement}></div>
<div class="fixed sm:left-15 left-5 top-35 sm:top-37 z-[1000]" onmouseleave={() => tileLayerMenuOpen = false}>
	<button
		class="cursor-pointer bg-white p-3 px-4 sm:p-2 sm:px-3 hover:text-white hover:bg-ink rounded-full border-1 border-gray-200 transition-all shadow-md"
		onmouseenter={() => tileLayerMenuOpen = !tileLayerMenuOpen} class:rounded-b-none={tileLayerMenuOpen}><i
		class="fa-solid fa-layer-group"></i></button>
	{#if tileLayerMenuOpen}
		<div class="flex flex-col justify-center" in:slide={{duration: 200}} out:slide={{duration: 200}}>
			<button class="cursor-pointer p-3 py-2 hover:text-white hover:bg-ink bg-white border-1 border-gray-200"
							onclick={setTransportTileLayer}>
				<i class="fa-solid fa-bus-simple"></i>
			</button>
			<button class="cursor-pointer p-3 py-2 hover:text-white hover:bg-ink bg-white border-1 border-gray-200"
							onclick={setSatelliteTileLayer}>
				<i class="fa-solid fa-satellite"></i>
			</button>
			<button
				class="cursor-pointer p-3 py-2 hover:text-white hover:bg-ink bg-white border-1 border-gray-200 rounded-full rounded-t-none"
				onclick={setTerrainTileLayer}>
				<i class="fa-solid fa-mountain"></i>
			</button>
		</div>
	{/if}
</div>

<style>
    @import 'leaflet/dist/leaflet.css';
    @import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
    @import "tailwindcss";

    :global(.maplibregl-ctrl-top-right) {
        @apply fixed left-15 top-20 right-auto z-[1000];
    }

    :global(.maplibregl-ctrl-top-right) {
        @media (width <= 40rem) {
            @apply left-5 top-17;
        }
    }

    :global(.maplibregl-ctrl-group) {
        @apply cursor-pointer bg-white rounded-full border-1 border-gray-200 transition-all;
    }

    :global(.maplibregl-ctrl-group button) {
        @apply cursor-pointer bg-white rounded-full w-12 h-12;
    }

    :global(.maplibregl-ctrl-group button) {
        @media (width <= 40rem) {
            @apply w-13 h-13;
        }
    }

    :global(.maplibregl-ctrl-group:not(:empty)) {
        @apply shadow-md;
    }

    :global(.maplibregl-ctrl-bottom-right) {
        @apply bottom-2 right-2;
    }

    :global(.maplibregl-ctrl-bottom-right) {
        @media (width <= 40rem) {
            @apply bottom-18 right-2;
        }
    }
</style>
