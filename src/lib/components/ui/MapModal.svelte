<script>
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import * as THREE from 'three';
	import { base } from '$app/paths';

	let { 
		coordinates = $bindable([0, 0]), 
		wallAzimuth = $bindable(0), 
		altitude = $bindable(0),
		scale = $bindable(1),
		gltfScene,
		modelOffset,
		onClose 
	} = $props();

	let mapContainer;
	let map;
	let customLayer;
	let isPinned = $state(false);
	let relativeAltitude = $state(0);
	let isAltitudeInitialized = false;
	
	let initialCenter = (coordinates[0] === 0 && coordinates[1] === 0) ? [16.37, 48.20] : coordinates;
	
	if (coordinates[0] === 0 && coordinates[1] === 0) {
		coordinates = initialCenter;
	}

	onMount(async () => {
		let style;
		try {
			const response = await fetch(base + '/satellite.json');
			style = await response.json();
			if (style.sources?.places?.data) style.sources.places.data = { type: 'FeatureCollection', features: [] };
			if (style.sources?.routes?.data) style.sources.routes.data = { type: 'FeatureCollection', features: [] };
		} catch (e) {
			style = 'https://demotiles.maplibre.org/style.json';
		}

		map = new maplibregl.Map({
			container: mapContainer,
			style: style,
			center: initialCenter,
			zoom: 18,
			pitch: 45,
			bearing: 0,
			antialias: true
		});

		map.on('move', () => {
			if (!isPinned) {
				const center = map.getCenter();
				coordinates = [center.lng, center.lat];
			}
		});

		// --- Custom Layer Setup ---
		customLayer = {
			id: '3d-model',
			type: 'custom',
			renderingMode: '3d',
			onAdd: function (map, gl) {
				console.log('Custom Layer onAdd triggered');
				this.camera = new THREE.Camera();
				this.scene = new THREE.Scene();

				// Lights
				const directionalLight = new THREE.DirectionalLight(0xffffff);
				directionalLight.position.set(0, -70, 100).normalize();
				this.scene.add(directionalLight);

				const directionalLight2 = new THREE.DirectionalLight(0xffffff);
				directionalLight2.position.set(0, 70, 100).normalize();
				this.scene.add(directionalLight2);
				
				const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
				this.scene.add(ambientLight);

				this.modelGroup = new THREE.Group();
				this.scene.add(this.modelGroup);

				if (gltfScene) {
					console.log('Adding GLTF Scene to Map');
					const model = gltfScene.clone();
					const offset = modelOffset || [0, 0, 0];
					// Center model
					model.position.set(-offset[0], -offset[1], -offset[2]);
					this.modelGroup.add(model);
				} else {
					console.warn('No GLTF Scene provided to MapModal');
				}

				this.map = map;
				this.renderer = new THREE.WebGLRenderer({
					canvas: map.getCanvas(),
					context: gl,
					antialias: true
				});
				
				this.renderer.autoClear = false;
			},
			render: function (gl, args) {
				const elevation = map.queryTerrainElevation(coordinates) || 0;
				
				// Initialize relative altitude from existing absolute altitude if loaded
				if (!isAltitudeInitialized && altitude !== 0) {
					relativeAltitude = altitude - elevation;
					isAltitudeInitialized = true;
				}

				// Calculate absolute altitude based on current elevation + relative adjustment
				const modelAltitude = elevation + relativeAltitude;
				
				// Update bound prop with absolute value
				altitude = modelAltitude;
				
				// Rotation:
				// X: 90 deg to flip Y-up (GLTF) to Z-up (MapLibre)
				// Y: -wallAzimuth (Compass degrees to radians, counter-clockwise around Up-axis)
				const modelRotate = [Math.PI / 2, -wallAzimuth * Math.PI / 180, 0];

				const modelAsMercatorCoordinate = maplibregl.MercatorCoordinate.fromLngLat(
					coordinates,
					modelAltitude
				);

				// Scale to maintain meter size, multiplied by visual scale
				const finalScale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits() * scale;

				const rotationX = new THREE.Matrix4().makeRotationAxis(
					new THREE.Vector3(1, 0, 0),
					modelRotate[0]
				);
				const rotationY = new THREE.Matrix4().makeRotationAxis(
					new THREE.Vector3(0, 1, 0),
					modelRotate[1]
				);
				const rotationZ = new THREE.Matrix4().makeRotationAxis(
					new THREE.Vector3(0, 0, 1),
					modelRotate[2]
				);

				const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
				const l = new THREE.Matrix4()
					.makeTranslation(
						modelAsMercatorCoordinate.x,
						modelAsMercatorCoordinate.y,
						modelAsMercatorCoordinate.z
					)
					.scale(
						new THREE.Vector3(
							finalScale,
							-finalScale,
							finalScale
						)
					)
					.multiply(rotationX)
					.multiply(rotationY)
					.multiply(rotationZ);

				this.camera.projectionMatrix = m.multiply(l);
				this.renderer.resetState();
				this.renderer.render(this.scene, this.camera);
				this.map.triggerRepaint();
			}
		};

		map.on('style.load', () => {
			if (!map.getLayer('3d-model')) {
				map.addLayer(customLayer);
			}
		});
		
		// Fallback if style is already loaded
		if (map.isStyleLoaded() && !map.getLayer('3d-model')) {
			map.addLayer(customLayer);
		}
	});
	
	$effect(() => {
		// Trigger repaint when reactive properties change
		if (map && (wallAzimuth !== undefined || scale !== undefined || relativeAltitude !== undefined)) {
			map.triggerRepaint();
		}
	});

	onDestroy(() => {
		map?.remove();
	});

</script>

<div class="fixed inset-0 z-[6000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
	<div class="bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
		<!-- Header -->
		<div class="p-4 border-b flex justify-between items-center bg-gray-50">
			<h2 class="text-xl font-bold text-gray-800">Standort & Ausrichtung setzen</h2>
			<button onclick={onClose} class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
				<i class="fa-solid fa-xmark text-gray-600"></i>
			</button>
		</div>

		<!-- Map Area -->
		<div class="flex-1 relative overflow-hidden">
			<!-- Map -->
			<div bind:this={mapContainer} class="w-full h-full absolute inset-0 z-0"></div>
			
			<!-- Crosshair -->
			{#if !isPinned}
				<div class="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
					<div class="w-8 h-8 border-2 border-white rounded-full z-20 shadow-sm"></div>
					<div class="absolute w-1 h-1 bg-red-500 rounded-full z-20"></div>
				</div>
			{/if}
			
			<!-- Controls -->
			<div class="absolute top-4 right-4 bg-white p-4 rounded-xl shadow-lg z-30 w-56">
				<button 
					class={`font-semibold grid shadow-md border-1 border-gray-200 w-full cursor-pointer rounded-full py-3 px-6 text-center text-sm transition-all hover:shadow-lg active focus:font-bold active:font-bold mb-4 ${isPinned ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}
					onclick={() => isPinned = !isPinned}
				>
					{isPinned ? 'Standort lösen' : 'Standort fixieren'}
				</button>

				<label class="block text-xs font-bold text-gray-500 uppercase mb-2">Wandausrichtung</label>
				<div class="flex items-center justify-center mb-2">
					<div class="relative w-24 h-24 rounded-full border-2 border-gray-200 flex items-center justify-center bg-gray-50">
						<div class="absolute text-[10px] font-bold text-gray-400 top-1">N</div>
						<div class="absolute text-[10px] font-bold text-[10px] font-bold text-gray-400 bottom-1">S</div>
						<div class="absolute text-[10px] font-bold text-gray-400 left-2">W</div>
						<div class="absolute text-[10px] font-bold text-gray-400 right-2">O</div>
						<div class="w-1 h-10 bg-red-500 absolute bottom-1/2 origin-bottom transition-transform" style="transform: rotate({wallAzimuth}deg) translateY(50%)"></div>
					</div>
				</div>
				<input type="range" min="0" max="360" bind:value={wallAzimuth} class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500">
				<div class="text-center font-mono font-bold text-lg mt-1">{wallAzimuth}°</div>

				<div class="mt-4 pt-4 border-t border-gray-100">
					<label class="block text-xs font-bold text-gray-500 uppercase mb-2">Höhe (Relativ)</label>
					<input type="range" min="-50" max="50" step="1" bind:value={relativeAltitude} class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500">
					<div class="text-center font-mono font-bold text-xs mt-1 text-gray-400">Abs: {altitude.toFixed(1)}m / Rel: {relativeAltitude.toFixed(1)}m</div>
				</div>

				<div class="mt-4 pt-4 border-t border-gray-100">
					<label class="block text-xs font-bold text-gray-500 uppercase mb-2">Modell Skalierung</label>
					<input type="range" min="0.01" max="20" step="0.01" bind:value={scale} class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500">
					<div class="text-center font-mono font-bold text-xs mt-1 text-gray-400">x{scale.toFixed(2)}</div>
				</div>
			</div>
		</div>


		<!-- Footer -->
		<div class="p-4 border-t bg-gray-50 flex justify-end">
			<button onclick={onClose} class="font-semibold grid shadow-md border-1 border-gray-200 w-auto cursor-pointer rounded-full bg-white py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold">
				Speichern & Schließen
			</button>
		</div>
	</div>
</div>

<style>
	input[type=range]::-webkit-slider-thumb {
		-webkit-appearance: none;
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: currentColor;
		margin-top: -4px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.3);
	}
</style>