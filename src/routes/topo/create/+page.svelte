<script>
	import { Canvas, T, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { Box3, Vector3, WebGLRenderer } from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	
	import Model from '$lib/components/topo/editor/EditorModel.svelte';
	import MapModal from '$lib/components/ui/MapModal.svelte';
	import TagSelector from '$lib/components/ui/TagSelector.svelte';
	import TopoPropertiesPanel from '$lib/components/topo/editor/TopoPropertiesPanel.svelte';
	import { userState } from '$lib/state/editor.svelte.js';
	
	// 2D Editor imports
	import Topo2DEditor from '$lib/components/topo/editor/Topo2DEditor.svelte';
	import ImageUploader from '$lib/components/topo/editor/ImageUploader.svelte';
	import ToolPalette2D from '$lib/components/topo/editor/ToolPalette2D.svelte';
	
	import { availableTopoTags, availableRouteTags } from '$lib/assets/js/topo-utils.js';
	import { standardGrades, uiaaMap, getGradeLabel } from '$lib/assets/js/grades.js';

	let activeTool = $state('route');
	let activeTool2D = $state('route');
	let selectedSymbol = $state('bolt');
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
					
					// Ensure routes array exists and has IDs
					if (!userState.topo.routes) {
						userState.topo.routes = [];
					} else {
						userState.topo.routes.forEach(r => { 
							if (!r.tags) r.tags = []; 
							if (!r.id) r.id = crypto.randomUUID();
							if (!r.fixPoints) r.fixPoints = [];
						});
					}
					
					// Ensure symbols are migrated to fixPoints if they exist (Legacy)
					if (userState.topo.symbols && userState.topo.symbols.length > 0) {
						if (!userState.topo.fixPoints) userState.topo.fixPoints = [];
						userState.topo.symbols.forEach(s => {
							userState.topo.fixPoints.push({
								id: s.id || crypto.randomUUID(),
								type: s.type,
								position2D: s.position,
								rotation2D: s.rotation,
								scale2D: s.scale
							});
						});
						delete userState.topo.symbols;
					}
					
					// Ensure fixPoints have IDs and normalize 'anchor' -> 'belay'
					if (userState.topo.fixPoints) {
						userState.topo.fixPoints.forEach(s => {
							if (!s.id) s.id = crypto.randomUUID();
							if (s.type === 'anchor') s.type = 'belay';
						});
					}

					// Ensure outlines array exists and has IDs
					if (!userState.topo.outlines) {
						userState.topo.outlines = [];
					} else {
						userState.topo.outlines.forEach(o => {
							if (!o.id) o.id = crypto.randomUUID();
						});
					}
					
					if (!userState.topo.modelOffset) userState.topo.modelOffset = [0, 0, 0];
					modelPositionOffset = userState.topo.modelOffset;
					if (userState.topo.scale === undefined) userState.topo.scale = 1;
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
		
		// Only apply 3D offsets if in 3D mode
		if (userState.topo.editorMode === '3d') {
			const offset = userState.topo.modelOffset || [0, 0, 0];
			if (topoToSave.routes) {
				topoToSave.routes = topoToSave.routes.map(route => {
					const { _gradeScale, ...cleanRoute } = route;
					
					const processedPoints = route.points?.length > 0 ? route.points.map(p => [
						p[0] + offset[0],
						p[1] + offset[1],
						p[2] + offset[2]
					]) : [];

					let processedPitches = cleanRoute.pitches;
					if (cleanRoute.pitches) {
						processedPitches = cleanRoute.pitches.map(pitch => ({
							...pitch,
							points: (pitch.points || []).map(p => [
								p[0] + offset[0],
								p[1] + offset[1],
								p[2] + offset[2]
							])
						}));
					}

					return {
						...cleanRoute,
						points: processedPoints,
						pitches: processedPitches
					};
				});
			}
			
			if (topoToSave.fixPoints) {
				topoToSave.fixPoints = topoToSave.fixPoints.map(point => ({
					...point,
					position: point.position ? [
						point.position[0] + offset[0],
						point.position[1] + offset[1],
						point.position[2] + offset[2]
					] : undefined
				}));
			}
			delete topoToSave.modelOffset; // Offset is baked into GLB and Points
			delete topoToSave.scale; // Scale is baked into the GLB
		} else {
			// 2D mode - clean up route data
			if (topoToSave.routes) {
				topoToSave.routes = topoToSave.routes.map(route => {
					const { _gradeScale, ...cleanRoute } = route;
					return cleanRoute;
				});
			}
		}
		
		// Clean up transient state
		const finalTopo = JSON.parse(JSON.stringify(topoToSave));
		delete finalTopo.selectedRouteId;
		delete finalTopo.selectedOutlineId;
		
		const jsonContent = JSON.stringify(finalTopo, undefined, 4);
		const blob = new Blob([jsonContent], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${baseName}-topo.json`;
		a.click();
		URL.revokeObjectURL(url);

		if (userState.topo.editorMode === '3d') {
			modelComponent?.downloadClippedModel(`${baseName}.glb`);
		}
	}

</script>

<div class="fixed top-25 left-15 z-50 flex flex-col max-h-[85vh] overflow-y-auto pr-2">
	<!-- Editor Mode Toggle -->
	<div class="bg-white rounded-full shadow-md border border-gray-200 p-1 mb-3 flex">
		<button
			class="flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-colors {userState.topo.editorMode === '2d' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'}"
			onclick={() => userState.topo.editorMode = '2d'}
		>
			📷 2D
		</button>
		<button
			class="flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-colors {userState.topo.editorMode === '3d' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'}"
			onclick={() => userState.topo.editorMode = '3d'}
		>
			🧊 3D
		</button>
	</div>

	{#if userState.topo.editorMode === '3d'}
		<button
			class="font-semibold grid shadow-md border-1 border-gray-200 sm:w-auto w-1/3 cursor-pointer rounded-full bg-white py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
			onclick={() => fileInput?.click()}
			disabled={isLoadingGltf}
		>
			{#if isLoadingGltf} {$_('ui.loading')}{:else} {$_('ui.load_model')}{/if}
		</button>
		<input
			type="file"
			bind:this={fileInput}
			onchange={handleFileSelect}
			accept=".glb,.gltf"
			hidden
		/>
		{#if gltfError && !isLoadingGltf}
			<p class="mt-2 text-sm text-red-600 bg-white/80 px-2 py-1 rounded">Error: {gltfError}</p>
		{/if}
	{:else}
		<ImageUploader />
		<ToolPalette2D bind:activeTool={activeTool2D} bind:selectedSymbol />
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

	{#if userState.topo.editorMode === '3d'}
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
		</div>
	{/if}

	<div class="mt-auto pt-5">
		<button
			class="w-full font-bold shadow-lg bg-blue-600 text-white px-8 py-4 rounded-full text-base transition-all hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
			onclick={combinedExport}>{$_('ui.save_topo')}</button>
	</div>
</div>

<div class="fixed top-25 right-12 z-50">
	<div class="overflow-y-scroll h-fit max-h-[85vh] pr-4">
		<div class="bg-white rounded-2xl shadow-md p-5 mb-5 w-100 border-1 border-gray-200">
			<h3 class="text-lg font-semibold mb-4">Topo Infos</h3>
			<div class="flex flex-row items-center">
				<label for="name" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Name:</label>
				<input
					type="text"
					id="name"
					bind:value={userState.topo.name}
					class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
				/></div>
			<div class="flex flex-row items-center">
				<label for="author" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Autor:</label>
				<input
					type="text"
					id="author"
					bind:value={userState.topo.author}
					class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
				/></div>
			<div class="flex flex-row items-center">
				<label for="rock" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Felsart:</label>
				<select name="rock" id="rock" bind:value={userState.topo.rock}
								class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4">
					<option value="granite">Granit</option>
					<option value="gneiss">Gneis</option>
					<option value="limestone">Kalkstein</option>
					<option value="dolomite">Dolomit</option>
					<option value="sandstone">Sandstein</option>
					<option value="basalt">Basalt</option>
					<option value="tuff">Tuff</option>
					<option value="rhyolite">Rhyolith</option>
					<option value="quartzite">Quarzit</option>
					<option value="conglomerate">Konglomerat</option>
					<option value="schist">Schiefer</option>
					<option value="slate">Schiefer (Slate)</option>
				</select>
			</div>
			
			<div class="flex flex-row mb-4 items-center">
				<label class="block text-sm font-medium w-1/3 mr-2">Standort:</label>
				<div class="flex-1 flex items-center gap-2">
					<button 
						class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm border border-gray-300 transition-colors"
						onclick={() => showMapModal = true}
					>
						<i class="fa-solid fa-map-location-dot mr-1"></i> Karte öffnen
					</button>
					{#if userState.topo.coordinates[0] !== 0}
						<div class="flex flex-col text-xs text-gray-500 leading-tight">
							<span>{userState.topo.coordinates[1].toFixed(4)}, {userState.topo.coordinates[0].toFixed(4)}</span>
							<span>{userState.topo.wallAzimuth}° / {userState.topo.altitude ? userState.topo.altitude.toFixed(1) : 0}m</span>
						</div>
					{/if}
				</div>
			</div>

			<div class="flex flex-row">
				<label for="description" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Beschreibung:</label>
				<textarea
					id="description"
					bind:value={userState.topo.description}
					class="w-full px-3 py-1 rounded-2xl text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
				></textarea></div>
			<div class="flex flex-row">
				<label class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Tags:</label>
				<div class="w-full mb-4">
					<TagSelector bind:selectedTags={userState.topo.tags} availableTags={availableTopoTags} />
				</div>
			</div>
		</div>

		{#each userState.topo.routes as route}
			<div 
				class={`bg-white rounded-2xl shadow-md p-5 mb-5 w-100 border-2 transition-all cursor-pointer ${userState.topo.selectedRouteId === route.id ? 'border-blue-500 bg-blue-50/10' : 'border-gray-200 hover:border-blue-300'}`}
				onclick={() => userState.topo.selectedRouteId = route.id}
			>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold truncate pr-2">{route.name || `Route ${route.id.substring(0,8)}`}</h3>
					<button 
						class="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 cursor-pointer"
						onclick={(e) => {
							e.stopPropagation();
							const index = userState.topo.routes.indexOf(route);
							if (index > -1) {
								userState.topo.routes.splice(index, 1);
							}
						}}
						title="Route löschen"
					>
						<i class="fa-solid fa-trash-can"></i>
					</button>
				</div>
				<div class="flex flex-row items-center text-sm mb-2">
					<label class="font-medium w-1/3 mr-2">Name:</label>
					<input type="text" bind:value={route.name} class="flex-1 px-3 py-1 rounded-full border-2 focus:ring-2 focus:ring-blue-500 outline-none" />
				</div>
				<div class="flex flex-row items-center text-sm mb-2">
					<label class="font-medium w-1/3 mr-2">Grad:</label>
					<div class="flex-1 flex gap-2">
						<select bind:value={route._gradeScale} class="w-1/3 px-2 py-1 rounded-full border-2 text-xs">
							<option value="french">French</option>
							<option value="uiaa">UIAA</option>
						</select>
						<select bind:value={route.grade} class="flex-1 px-2 py-1 rounded-full border-2 text-xs">
							{#each standardGrades as g}
								{#if route._gradeScale !== 'uiaa' || uiaaMap[g]}
									<option value={g}>{getGradeLabel(g, route._gradeScale)}</option>
								{/if}
							{/each}
						</select>
					</div>
				</div>
				<div class="flex flex-row items-center text-sm mb-2">
					<label class="font-medium w-1/3 mr-2">Art:</label>
					<select bind:value={route.type} class="flex-1 px-3 py-1 rounded-full border-2">
						<option value="sports-climbing">Sport</option>
						<option value="bouldering">Bouldern</option>
						<option value="trad">Traditionell</option>
						<option value="multi-pitch">Mehrseillängen</option>
					</select>
				</div>
				<div class="flex flex-row items-center text-sm mb-2">
					<label class="font-medium w-1/3 mr-2">Tags:</label>
					<div class="flex-1">
						<TagSelector bind:selectedTags={route.tags} availableTags={availableRouteTags} small={true} />
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<div class="h-screen w-screen absolute overflow-hidden">
	{#if userState.topo.editorMode === '2d'}
		<Topo2DEditor activeTool={activeTool2D} {selectedSymbol} />
	{:else}
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
	{/if}
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

<TopoPropertiesPanel
	bind:showMapModal
	bind:drawingTarget
	bind:activeTool
/>
