<script>
	import { Canvas, T, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { Box3, Vector3, WebGLRenderer } from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	import { onMount } from 'svelte';
	import Model from '$lib/components/topo/editor/EditorModel.svelte';
	import MapModal from '$lib/components/ui/MapModal.svelte';
	import TopoPropertiesPanel from '$lib/components/topo/editor/TopoPropertiesPanel.svelte';
	import { userState } from '$lib/state/editor.svelte.js';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { availableTopoTags } from '$lib/assets/js/topo-utils.js';

	let activeTool = $state('route');
	let modelComponent;
	let activeRenderer = $state('');
	let drawingTarget = $state(null);

	const createRenderer = (canvas) => {
		const context = canvas.getContext('webgl2', {
			alpha: true,
			depth: true,
			stencil: false,
			antialias: true,
			powerPreference: 'high-performance',
			failIfMajorPerformanceCaveat: true,
			desynchronized: true, // Hint to the browser to reduce latency
			preserveDrawingBuffer: false
		});

		return new WebGLRenderer({
			canvas,
			context,
			powerPreference: 'high-performance', // Redundant but safe
			antialias: true,
			precision: 'highp',
			alpha: true
		});
	};

	// --- State ---
	let fileInput;
	let jsonInput;
	let element;
	
	let loadedGltfScene = $state(null);
	let modelPositionOffset = $state([0, 0, 0]);
	let isLoadingGltf = $state(false);
	let gltfError = $state(null);

	let showExportModal = $state(false);
	let showMapModal = $state(false);
	let isCutting = $state(false);

	function handleFileSelect(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		isLoadingGltf = true;
		gltfError = null;

		const loader = new GLTFLoader();
		const reader = new FileReader();

		reader.onload = (e) => {
			const contents = e.target.result;
			loader.parse(contents, '', (gltf) => {
				const scene = gltf.scene;

				if (!scene) {
					console.error('Loaded GLTF scene is empty');
					gltfError = 'Loaded scene is empty';
					isLoadingGltf = false;
					return;
				}

				const box = new Box3().setFromObject(scene);

				if (box.isEmpty()) {
					console.warn('Model bounding box is empty, cannot calculate center offset.');
				} else {
					const center = new Vector3();
					box.getCenter(center);
					const offset = center.clone().negate();
					modelPositionOffset = offset.toArray();
					userState.topo.modelOffset = modelPositionOffset;
					console.log(`Calculated model position offset: [${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)}]`);
				}

				loadedGltfScene = scene;
				isLoadingGltf = false;

			}, (err) => {
				console.error('Error parsing GLTF', err);
				gltfError = err.message;
				isLoadingGltf = false;
			});
		};
		reader.readAsArrayBuffer(file);
	}

	function handleJsonImport(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target.result;
				const parsed = JSON.parse(content);
				if (parsed && typeof parsed === 'object') {
					userState.topo = { ...userState.topo, ...parsed };
					if (!userState.topo.routes) userState.topo.routes = [];
					userState.topo.routes.forEach(r => {
						if (!r.tags) r.tags = [];
						if (!r.fixPoints) r.fixPoints = [];
					});
					if (!userState.topo.fixPoints) userState.topo.fixPoints = [];
					userState.topo.fixPoints.forEach(fp => {
						if (!fp.id) fp.id = crypto.randomUUID();
					});
					if (!userState.topo.modelOffset) userState.topo.modelOffset = [0, 0, 0];
					modelPositionOffset = userState.topo.modelOffset;
				}
			} catch (err) {
				console.error('Failed to parse JSON', err);
				alert('Fehler beim Laden der JSON Datei.');
			}
		};
		reader.readAsText(file);
	}

	function combinedExport() {
		userState.topo.date = new Date().toISOString().split('T')[0];
		userState.topo.updated = new Date().toISOString().split('T')[0];

		const baseName = (userState.topo.name || 'topo').trim().toLowerCase().replace(/\s+/g, '-');

		const topoToSave = { ...userState.topo };

		const offset = userState.topo.modelOffset || [0, 0, 0];
		if (topoToSave.routes) {
			topoToSave.routes = topoToSave.routes.map(route => {
				const { _gradeScale, ...cleanRoute } = route;

				if (cleanRoute.points) {
					cleanRoute.points = cleanRoute.points.map(p => [
						p[0] + offset[0],
						p[1] + offset[1],
						p[2] + offset[2]
					]);
				}

				if (cleanRoute.pitches) {
					cleanRoute.pitches = cleanRoute.pitches.map(pitch => ({
						...pitch,
						points: (pitch.points || []).map(p => [
							p[0] + offset[0],
							p[1] + offset[1],
							p[2] + offset[2]
						])
					}));
				}

				return cleanRoute;
			});
		}

		if (topoToSave.fixPoints) {
			topoToSave.fixPoints = topoToSave.fixPoints.map(point => ({
				...point,
				position: [
					point.position[0] + offset[0],
					point.position[1] + offset[1],
					point.position[2] + offset[2]
				]
			}));
		}
		delete topoToSave.modelOffset;
		delete topoToSave.scale;

		const jsonContent = JSON.stringify(topoToSave, undefined, 4);
		const blob = new Blob([jsonContent], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${baseName}-topo.json`;
		a.click();
		URL.revokeObjectURL(url);

		modelComponent?.downloadClippedModel(`${baseName}.glb`);
	}

</script>

<div class="fixed top-25 left-15 z-50 flex flex-col h-[85vh] pr-2">
	<button
		class="font-semibold grid shadow-md border-1 border-gray-200 sm:w-auto w-1/3 cursor-pointer rounded-full bg-white py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
		onclick={() => fileInput?.click()}
		disabled={isLoadingGltf}
	>
		{#if isLoadingGltf} {$_('ui.loading')}{:else} {$_('ui.load_model')}{/if}
	</button>
	<input
		type="file"
		accept=".glb,.gltf"
		class="hidden"
		bind:this={fileInput}
		onchange={handleFileSelect}
	/>

	{#if gltfError && !isLoadingGltf}
		<p class="mt-2 text-sm text-red-600 bg-white/80 px-2 py-1 rounded">Error: {gltfError}</p>
	{/if}

	<button
		class="mt-3 font-semibold grid shadow-md border-1 border-gray-200 sm:w-auto w-1/3 cursor-pointer rounded-full bg-white py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
		onclick={() => jsonInput?.click()}
	>
		{$_('ui.load_json')}
	</button>
	<input
		type="file"
		accept=".json"
		class="hidden"
		bind:this={jsonInput}
		onchange={handleJsonImport}
	/>

	<div class="mt-5 border-t pt-5 border-gray-200">
		<h4 class="text-xs font-bold text-gray-500 uppercase mb-3">{$_('ui.tools')}</h4>
		<div class="flex gap-2">
			<button
				class={`flex-1 font-semibold shadow-md border-1 cursor-pointer rounded-full py-2 px-2 text-center text-xs transition-colors ${activeTool === 'route' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}`}
				onclick={() => { activeTool = 'route'; drawingTarget = null; }}>
				{$_('ui.route')}
			</button>
			<button
				class={`flex-1 font-semibold shadow-md border-1 cursor-pointer rounded-full py-2 px-2 text-center text-xs transition-colors ${activeTool === 'multipitch' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-100'}`}
				onclick={() => { activeTool = 'multipitch'; drawingTarget = null; }}>
				Multi-Pitch
			</button>
			<button
				class={`flex-1 font-semibold shadow-md border-1 cursor-pointer rounded-full py-2 px-2 text-center text-xs transition-colors ${activeTool === 'point' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}`}
				onclick={() => { activeTool = 'point'; drawingTarget = null; }}>
				{$_('ui.fixpoint')}
			</button>
		</div>

		<div class="mt-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-xs text-gray-600 space-y-1.5">
			<h5 class="font-bold text-blue-800 mb-1">{$_('ui.controls')}
				: {activeTool === 'route' ? $_('ui.route') : (activeTool === 'multipitch' ? 'Multi-Pitch' : $_('ui.fixpoint'))}</h5>
			{#if activeTool === 'route'}
				<div class="flex justify-between items-center"><span
					class="font-medium text-gray-800">{$_('ui.double_click')}</span> <span>{$_('ui.set_point')}</span></div>
				<div class="flex justify-between items-center"><span class="font-medium text-gray-800">{$_('ui.key_n')} / Enter</span>
					<span>{$_('ui.finish')}</span></div>
				<div class="flex justify-between items-center"><span class="font-medium text-gray-800">{$_('ui.key_esc')}</span>
					<span>{$_('ui.cancel')}</span></div>
			{:else if activeTool === 'multipitch'}
				<div class="flex justify-between items-center"><span
					class="font-medium text-gray-800">Double Click</span> <span>Set Point</span></div>
				<div class="flex justify-between items-center"><span class="font-medium text-gray-800">Key 'B'</span>
					<span>Belay (Next Pitch)</span></div>
				<div class="flex justify-between items-center"><span class="font-medium text-gray-800">Enter</span>
					<span>Finish Route</span></div>
			{:else if activeTool === 'point'}
				<div class="flex justify-between items-center"><span
					class="font-medium text-gray-800">{$_('ui.double_click')}</span> <span>{$_('ui.set_fixpoint')}</span></div>
			{/if}
		</div>
	</div>

	<div class="mt-5 border-t pt-5 border-gray-200">
		<button
			class={"font-semibold grid shadow-md border-1 border-gray-200 sm:w-auto w-1/3 cursor-pointer rounded-full py-3 px-6 text-center text-sm transition-all hover:shadow-lg active focus:font-bold active:font-bold " + (isCutting ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-white text-slate-600 hover:text-white hover:bg-ink")}
			onclick={() => isCutting = !isCutting}>
			{$_('ui.crop_beta')}
		</button>

		{#if isCutting}
			<div class="flex flex-col gap-2 mt-3">
				<div class="flex gap-2">
					<button
						class="flex-1 font-semibold shadow-md border-1 border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-center text-xs hover:bg-gray-50"
						onclick={() => modelComponent?.addPlane()}>
						{$_('ui.apply_cut')}
					</button>
					<button
						class="flex-1 font-semibold shadow-md border-1 border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-center text-xs hover:bg-gray-50"
						onclick={() => modelComponent?.removeLastPlane()}>
						{$_('ui.undo')}
					</button>
				</div>
				<button
					class="font-semibold shadow-md border-1 border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-center text-xs hover:bg-red-50 text-red-600"
					onclick={() => modelComponent?.clearPlanes()}>
					{$_('ui.reset')}
				</button>
			</div>
		{/if}
	</div>

	<div class="mt-auto pt-5">
		<button
			class="w-full font-bold shadow-lg bg-blue-600 text-white px-8 py-4 rounded-full text-base transition-all hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
			onclick={combinedExport}>{$_('ui.save_topo')}</button>
	</div>
</div>

<TopoPropertiesPanel
	bind:showMapModal
	bind:drawingTarget
	bind:activeTool
/>

{#if showExportModal}
	<div class="fixed z-50 top-0 left-0 w-full h-full table" style="background-color: rgba(0, 0, 0, 0.5);">
		<div class="table-cell align-middle">
			<div class="modal-overlay fixed w-full h-full bg-gray-900 opacity-50"></div>
			<div class="bg-white w-full lg:h-max lg:w-1/2  mx-auto rounded-lg shadow-xl z-50 overflow-y-auto">
				<button class="fa-solid fa-xmark text-gray-400 text-3xl float-right cursor-pointer m-5 mr-7"
												onclick={() => showExportModal = false}></button>
				<div class="content p-20 text-center place-self-center">
					<textarea readonly
																	class="w-130 h-130 bg-gray-100 rounded-2xl p-5">{JSON.stringify(userState.topo, undefined, 4)}</textarea>
				</div>
			</div>
		</div>
	</div>
{/if}

<div class="h-screen w-screen absolute">
	<div id="css-renderer-target" bind:this={element}
			 style="position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; height: 100%; z-index: 1;"></div>

	<Canvas linear {createRenderer} dpr={browser ? window.devicePixelRatio : 1}>
		<T.PerspectiveCamera makeDefault position={[0, 1, 5]} fov={75} near={0.1} far={1000}>
			<OrbitControls enableZoom={true} target={[0, 0, 0]} />
		</T.PerspectiveCamera>

		<T.AmbientLight intensity={1.0} />
		<T.DirectionalLight position={[5, 10, 7]} intensity={1.2} />
		<T.HemisphereLight skyColor={'#ffffff'} groundColor={'#444444'} intensity={0.5} />

		{#if element !== undefined}
			<Model
				bind:this={modelComponent}
				gltfScene={loadedGltfScene}
				position={modelPositionOffset}
				scale={userState.topo.scale}
				activeTool={activeTool}
				{drawingTarget}
				{element}
				{isCutting}
			/>
		{/if}
	</Canvas>
</div>

<style>
    :global(.route-label) {
        background-color: rgba(0, 0, 0, 0.65);
        color: white;
        padding: 3px 7px;
        border-radius: 4px;
        font-size: 9px;
        font-family: sans-serif;
        white-space: nowrap;
        text-align: center;
        cursor: pointer;
    }

    :global(.fixpoint-label) {
        background-color: rgba(255, 255, 255, 0.75);
        color: black;
        padding: 0px 4px;
        border-radius: 50%;
        font-size: 10px;
        font-weight: bold;
        font-family: sans-serif;
        text-align: center;
        pointer-events: none;
        width: 16px;
        height: 16px;
        line-height: 16px;
        margin-top: -25px; /* Offset to float above the sphere */
    }
</style>

{#if showMapModal}
	<MapModal
		bind:coordinates={userState.topo.coordinates}
		bind:wallAzimuth={userState.topo.wallAzimuth}
		bind:scale={userState.topo.scale}
		availableTopoTags={availableTopoTags}
		bind:altitude={userState.topo.altitude}
		gltfScene={loadedGltfScene}
		modelOffset={modelPositionOffset}
		onClose={() => showMapModal = false}
	/>
{/if}
