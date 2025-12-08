<script>
	import { Canvas, T, useTask, useThrelte } from '@threlte/core';
	import { OrbitControls, Text } from '@threlte/extras';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	import { Box3, Vector3 } from 'three'; // Still need these for calculation
	import { onMount } from 'svelte';
	import Model from '$lib/components/topo/editor/EditorModel.svelte';
	import MapModal from '$lib/components/ui/MapModal.svelte';
	import TagSelector from '$lib/components/ui/TagSelector.svelte';
	import { userState } from '$lib/state/editor.svelte.js';


	// --- Grade Logic ---
	const uiaaMap = {
		"1a": "I", "2a": "II", "3a": "III", 
		"4a": "IV", "4b": "IV+", "4c": "V-",
		"5a": "V", "5b": "V+", "5c": "VI-",
		"6a": "VI", "6a+": "VI+", "6b": "VII-", "6b+": "VII", "6c": "VII+", "6c+": "VIII-",
		"7a": "VIII", "7a+": "VIII+", "7b": "IX-", "7b+": "IX", "7c": "IX+", "7c+": "X-",
		"8a": "X", "8a+": "X+", "8b": "XI-", "8b+": "XI", "9a": "XI+"
	};
	
	const standardGrades = [];
	for(let i=1; i<=9; i++) {
		for(let x of ["a", "b", "c"]) {
			for(let m of ["", "+"]) {
				standardGrades.push(i + x + m);
			}
		}
	}

	function getGradeLabel(grade, scale) {
		if (scale === 'uiaa') {
			return uiaaMap[grade] || grade; 
		}
		return grade;
	}

	const availableTopoTags = [
		"Kinderfreundlich", "Regensicher", "Kurzer Zustieg", "Alpin", 
		"Brüchig", "Beliebt", "Morgensonne", "Abendsonne", "Schattig"
	];

	const availableRouteTags = [
		"Technisch", "Kraft", "Ausdauer", "Leisten", "Löcher", "Riss", 
		"Platte", "Überhang", "Weite Haken", "Abgespeckt", "Klassiker", "Boulder-Start"
	];

	// --- State ---
	let loadedGltfScene = $state(null);
	let modelPositionOffset = $state([0, 0, 0]); // State to hold the calculated position offset
	let isLoadingGltf = $state(false);
	let gltfError = $state(null);
	let fileInput = $state(null);
	let objectUrl = $state(null);
	let element = $state();
	let showExportModal = $state(false);
	let showMapModal = $state(false);
	let isCutting = $state(false);
	let activeTool = $state('route');
	let modelComponent;

	function handleFileSelect(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		const loader = new GLTFLoader();

		// Reset state for new model
		if (loadedGltfScene) loadedGltfScene = null;
		modelPositionOffset = [0, 0, 0]; // Reset position offset
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = null;
		}

		isLoadingGltf = true;
		gltfError = null;
		objectUrl = URL.createObjectURL(file);

		loader.load(
			objectUrl,
			(gltf) => {
				console.log('GLTF loaded successfully');
				const scene = gltf.scene || gltf.scenes?.[0];

				if (!scene) {
					console.error('Loaded GLTF contains no scene.');
					gltfError = 'Loaded GLTF contains no scene.';
					isLoadingGltf = false;
					if (objectUrl) {
						URL.revokeObjectURL(objectUrl);
						objectUrl = null;
					}
					loadedGltfScene = null;
					return;
				}

				// --->>> Calculate Centering Offset Start <<<---
				// Calculate bounding box of the *original* scene
				const box = new Box3().setFromObject(scene);

				if (box.isEmpty()) {
					console.warn('Model bounding box is empty, cannot calculate center offset.');
					// Keep offset at [0,0,0]
				} else {
					const center = new Vector3();
					box.getCenter(center);

					// Calculate the offset needed to move the center to the origin
					const offset = center.clone().negate();

					// Update the state variable with the calculated offset array
					modelPositionOffset = offset.toArray(); // Store as [x, y, z] array
					userState.topo.modelOffset = modelPositionOffset;

					console.log(`Calculated model position offset: [${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)}]`);
				}
				// --->>> Calculate Centering Offset End <<<---

				// Update the state with the *unmodified* scene
				// The position offset will be applied via props in the template
				loadedGltfScene = scene;
				isLoadingGltf = false;

			},
			undefined, // Progress callback
			(err) => {
				console.error('Error loading GLTF:', err);
				gltfError = err.message || 'Failed to load GLTF file.';
				isLoadingGltf = false;
				loadedGltfScene = null;
				modelPositionOffset = [0, 0, 0]; // Reset offset on error
				if (objectUrl) {
					URL.revokeObjectURL(objectUrl);
					objectUrl = null;
				}
			}
		);
		event.target.value = '';
	}

	onMount(() => {
		return () => {
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	});

	let jsonInput = $state(null);

	function handleJsonImport(event) {
		const file = event.target.files?.[0];
		if (!file) return;
		
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target.result;
				const parsed = JSON.parse(content);
				// Validate or just overwrite? Let's overwrite carefully.
				if (parsed && typeof parsed === 'object') {
					userState.topo = { ...userState.topo, ...parsed };
					// Ensure routes array exists
					if (!userState.topo.routes) userState.topo.routes = [];
					// Ensure tags array and fixPoints array exists on imported routes
					userState.topo.routes.forEach(r => { 
						if (!r.tags) r.tags = [];
						if (!r.fixPoints) r.fixPoints = [];
					});
					// Ensure fixPoints array exists
					if (!userState.topo.fixPoints) userState.topo.fixPoints = [];
					// Ensure fixPoints have IDs
					userState.topo.fixPoints.forEach(fp => {
						if (!fp.id) fp.id = crypto.randomUUID();
					});
					// Ensure modelOffset exists
					if (!userState.topo.modelOffset) userState.topo.modelOffset = [0, 0, 0];
					// If model is loaded, we might want to apply offset? 
					// The offset is applied via props to Model. 
					// If JSON has different offset than current model, it might mismatch if model isn't reloaded.
					// But user usually imports JSON matching the model.
					modelPositionOffset = userState.topo.modelOffset;
				}
			} catch (err) {
				console.error("Failed to parse JSON", err);
				alert("Fehler beim Laden der JSON Datei.");
			}
		};
		reader.readAsText(file);
		event.target.value = ''; // Reset input
	}

	function combinedExport() {
		userState.topo.date = new Date().toISOString().split('T')[0];
		userState.topo.updated = new Date().toISOString().split('T')[0];
		
		const baseName = (userState.topo.name || 'topo').trim().toLowerCase().replace(/\s+/g, '-');
		
		// Download JSON
		const topoToSave = { ...userState.topo };
		
		// Apply modelOffset to all route points to match baked model
		const offset = userState.topo.modelOffset || [0, 0, 0];
		if (topoToSave.routes) {
			topoToSave.routes = topoToSave.routes.map(route => {
				const { _gradeScale, ...cleanRoute } = route;
				return {
					...cleanRoute,
					points: route.points.map(p => [
						p[0] + offset[0],
						p[1] + offset[1],
						p[2] + offset[2]
					])
				};
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
		delete topoToSave.modelOffset; // Offset is baked into GLB and Points
		delete topoToSave.scale; // Scale is baked into the GLB
		
		const jsonContent = JSON.stringify(topoToSave, undefined, 4);
		const blob = new Blob([jsonContent], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${baseName}-topo.json`;
		a.click();
		URL.revokeObjectURL(url);
		
		// Download GLB
		modelComponent?.downloadClippedModel(`${baseName}.glb`);
	}

</script>

<div class="fixed top-25 left-15 z-50 flex flex-col max-h-[85vh] overflow-y-auto pr-2">
	<button
		class="font-semibold grid shadow-md border-1 border-gray-200 sm:w-auto w-1/3 cursor-pointer rounded-full bg-white py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
		onclick={() => fileInput?.click()}
		disabled={isLoadingGltf}
	>
		{#if isLoadingGltf} Lädt...{:else} 3D-Model laden{/if}
	</button>
	<input
		type="file"
		bind:this={fileInput}
		onchange={handleFileSelect}
		accept=".glb"
		hidden
	/>
	{#if gltfError && !isLoadingGltf}
		<p class="mt-2 text-sm text-red-600 bg-white/80 px-2 py-1 rounded">Error: {gltfError}</p>
	{/if}
	
	<button
		class="mt-3 font-semibold grid shadow-md border-1 border-gray-200 sm:w-auto w-1/3 cursor-pointer rounded-full bg-white py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
		onclick={() => jsonInput?.click()}
	>
		Topo JSON Laden
	</button>
	<input
		type="file"
		bind:this={jsonInput}
		onchange={handleJsonImport}
		accept=".json"
		hidden
	/>

	<div class="mt-5 border-t pt-5 border-gray-200">
		<h4 class="text-xs font-bold text-gray-500 uppercase mb-3">Werkzeuge</h4>
		<div class="flex gap-2">
			<button class={`flex-1 font-semibold shadow-md border-1 cursor-pointer rounded-full py-2 px-4 text-center text-xs transition-colors ${activeTool === 'route' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}`}
							onclick={() => activeTool = 'route'}>
				Route
			</button>
			<button class={`flex-1 font-semibold shadow-md border-1 cursor-pointer rounded-full py-2 px-4 text-center text-xs transition-colors ${activeTool === 'point' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}`}
							onclick={() => activeTool = 'point'}>
				Fixpunkt
			</button>
		</div>
	</div>

	<div class="mt-5 border-t pt-5 border-gray-200">
		<button class={"font-semibold grid shadow-md border-1 border-gray-200 sm:w-auto w-1/3 cursor-pointer rounded-full py-3 px-6 text-center text-sm transition-all hover:shadow-lg active focus:font-bold active:font-bold " + (isCutting ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-white text-slate-600 hover:text-white hover:bg-ink")}
						onclick={() => isCutting = !isCutting}>
			Zuschneiden (Beta)
		</button>
		
		{#if isCutting}
			<div class="flex flex-col gap-2 mt-3">
				<div class="flex gap-2">
					<button class="flex-1 font-semibold shadow-md border-1 border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-center text-xs hover:bg-gray-50"
									onclick={() => modelComponent?.addPlane()}>
						Schnitt Anwenden
					</button>
					<button class="flex-1 font-semibold shadow-md border-1 border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-center text-xs hover:bg-gray-50"
									onclick={() => modelComponent?.removeLastPlane()}>
						Rückgängig
					</button>
				</div>
				<button class="font-semibold shadow-md border-1 border-gray-200 cursor-pointer rounded-full bg-white py-2 px-4 text-center text-xs hover:bg-red-50 text-red-600"
								onclick={() => modelComponent?.clearPlanes()}>
					Reset
				</button>
			</div>
		{/if}
	</div>
	
	<div class="mt-auto pt-5">
		<button class="mt-5 font-semibold grid shadow-md border-1 border-gray-200 sm:w-auto w-1/3 cursor-pointer rounded-full bg-white py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
						onclick={combinedExport}>Topo Speichern (JSON + GLB)</button>
	</div>
</div>

{#if showExportModal}
	<div class="modal z-5000 fixed w-full h-full top-0 left-0 flex items-center justify-center p-8 lg:p-0">
		<div class="modal-overlay fixed w-full h-full bg-gray-900 opacity-50"></div>
		<div class="bg-white w-full lg:h-max lg:w-1/2  mx-auto rounded-lg shadow-xl z-50 overflow-y-auto">
			<button class="fa-solid fa-xmark text-gray-400 text-3xl float-right cursor-pointer m-5 mr-7"
			onclick={() => showExportModal = false}></button>
			<div class="content p-20 text-center place-self-center">
				<textarea readonly class="w-130 h-130 bg-gray-100 rounded-2xl p-5">{JSON.stringify(userState.topo, undefined, 4)}</textarea>
			</div>
		</div>
	</div>
{/if}

<div class="fixed top-25 right-12 z-50">
	<div class="overflow-y-scroll h-fit max-h-190">
		<div class="bg-white rounded-2xl shadow-md p-5 mb-5 mr-5 w-100 border-1 border-gray-200">
			<h3 class="text-lg font-semibold mb-4">Topo Infos</h3>
			<div class="flex flex-row">
				<label for="name" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Name:</label>
				<input
					type="text"
					id="name"
					bind:value={userState.topo.name}
					class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
				/></div>
			<div class="flex flex-row">
				<label for="author" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Autor:</label>
				<input
					type="text"
					id="author"
					bind:value={userState.topo.author}
					class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
				/></div>
			<div class="flex flex-row">
				<label for="rock" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Felsart:</label>
				<select name="rock" id="type" bind:value={userState.topo.rock}
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
				class={"bg-white rounded-2xl shadow-md p-5 mb-5 mr-5 w-100 border-2 transition-all " + 
				(userState.ui.selectedRouteId === route.id ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200")}
			>
								                <div class="flex justify-between items-center mb-4 cursor-pointer"
								                    onclick={() => userState.ui.selectedRouteId = (userState.ui.selectedRouteId === route.id ? null : route.id)}
								                >
								                    <h3 class={"text-lg font-semibold flex items-center gap-2 " + (userState.ui.selectedRouteId === route.id ? "text-blue-600" : "")}>
								                        Route {route.id}
								                        {#if userState.ui.selectedRouteId === route.id}
								                            <span class="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
								                                Bearbeitungsmodus
								                            </span>
								                        {/if}
								                    </h3>
								                    <div class="flex gap-2">
								                        <button 
								                            class="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 cursor-pointer"
								                            onclick={(e) => {
								                                e.stopPropagation();
								                                const index = userState.topo.routes.indexOf(route);
								                                if (index > -1) {
								                                    userState.topo.routes.splice(index, 1);
								                                    if (userState.ui.selectedRouteId === route.id) userState.ui.selectedRouteId = null;
								                                }
								                            }}
								                            title="Route löschen"
								                        >
								                            <i class="fa-solid fa-trash-can"></i>
								                        </button>
								                    </div>
								                </div>
								                {#if userState.ui.selectedRouteId === route.id}
								                    <div class="mb-4 bg-blue-50 text-blue-700 text-xs p-2 rounded border border-blue-100">
								                        Klicke auf die roten/grünen Fixpunkte im 3D-Modell, um sie dieser Route zuzuweisen.
								                    </div>
								                {/if}
								                <div class="flex flex-row">					<label for="name" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Name:</label>
					<input
						type="text"
						id="name"
						bind:value={route.name}
						class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
					/></div>
				<div class="flex flex-row">
					<label for="type" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Art:</label>
					<select name="type" id="type" bind:value={route.type}
									class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4">
						<option value="sports-climbing">Sport</option>
						<option value="bouldering">Bouldern</option>
						<option value="trad">Traditionell</option>
						<option value="multi-pitch">Mehrseillängen</option>
					</select>
				</div>
				<div class="flex flex-row">
					<label for="grade" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Grad:</label>
					<div class="flex w-full gap-2 mb-4">
						<select 
							bind:value={route._gradeScale} 
							class="w-1/3 px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="french">French</option>
							<option value="uiaa">UIAA</option>
						</select>
						<select 
							name="grade" 
							id="grade" 
							bind:value={route.grade}
							class="w-2/3 px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							{#each standardGrades as g}
								{#if route._gradeScale !== 'uiaa' || uiaaMap[g]}
									<option value={g}>{getGradeLabel(g, route._gradeScale)}</option>
								{/if}
							{/each}
						</select>
					</div>
				</div>
				{#if route.type === "sports-climbing"}
					<div class="flex flex-row">
						<label for="boltAmount" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Exen-Anzahl:</label>
						<input
							type="number"
							id="boltAmount"
							bind:value={route.boltAmount}
							class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
						/></div>
				{/if}
				{#if route.type === "sports-climbing"}
					<div class="flex flex-row">
						<label for="length" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Länge:</label>
						<input
							type="number"
							id="length"
							bind:value={route.length}
							class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
						/></div>
				{/if}
				<div class="flex flex-row">
					<label for="description" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Beschreibung:</label>
					<textarea
						id="description"
						bind:value={route.description}
						class="w-full px-3 py-1 rounded-2xl text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
					></textarea></div>
				<div class="flex flex-row">
					<label class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Tags:</label>
					<div class="w-full mb-4">
						<TagSelector bind:selectedTags={route.tags} availableTags={availableRouteTags} />
					</div>
				</div>

				{#if userState.topo.fixPoints.length > 0}
					<div class="flex flex-row">
						<label class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Fixpunkte:</label>
						<div class="w-full mb-4">
							<details class="group">
								<summary class="list-none cursor-pointer text-sm text-blue-600 hover:text-blue-800 font-medium mb-2 flex items-center gap-2 select-none">
									<i class="fa-solid fa-chevron-right group-open:rotate-90 transition-transform text-xs"></i>
									<span>{route.fixPoints?.length || 0} zugewiesen</span>
								</summary>
								<div class="max-h-32 overflow-y-auto p-1 border border-gray-100 rounded-lg bg-gray-50 flex flex-wrap gap-1">
									{#each userState.topo.fixPoints as fp, idx}
										<button
											class={"w-8 h-8 flex items-center justify-center rounded text-xs font-semibold transition-colors " +
											(route.fixPoints?.includes(fp.id) ? "bg-blue-500 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300")}
											onclick={() => {
												if (!route.fixPoints) route.fixPoints = [];
												if (route.fixPoints.includes(fp.id)) {
													route.fixPoints = route.fixPoints.filter(id => id !== fp.id);
												} else {
													route.fixPoints.push(fp.id);
												}
											}}
											title={`Fixpunkt ${idx + 1} (${fp.type})`}
										>
											{idx + 1}
										</button>
									{/each}
								</div>
							</details>
						</div>
					</div>
				{/if}
			</div>
		{/each}
		{#each userState.topo.fixPoints as point, i}
			<div class="bg-white rounded-2xl shadow-md p-5 mb-5 mr-5 w-100 border-1 border-gray-200">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold">Fixpunkt {i + 1}</h3>
					<button 
						class="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 cursor-pointer"
						onclick={() => {
							const pointId = point.id;
							userState.topo.fixPoints.splice(i, 1);
							userState.topo.routes.forEach(r => {
								if (r.fixPoints) {
									r.fixPoints = r.fixPoints.filter(id => id !== pointId);
								}
							});
						}}
						title="Löschen"
					>
						<i class="fa-solid fa-trash-can"></i>
					</button>
				</div>
				<div class="flex flex-row">
					<label class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">Typ:</label>
					<select bind:value={point.type} class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4">
						<option value="bolt">Bohrhaken</option>
						<option value="anchor">Umlenker/Stand</option>
						<option value="piton">Normalhaken</option>
						<option value="hourglass">Sanduhr</option>
					</select>
				</div>
			</div>
		{/each}
	</div>
</div>

<div class="h-screen w-screen absolute">
	<div id="css-renderer-target" bind:this={element}
			 style="position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; height: 100%; z-index: 1;"></div>

	<Canvas linear>
		<T.PerspectiveCamera makeDefault position={[0, 1, 5]} fov={75} near={0.1} far={1000}>
			<OrbitControls enableZoom={true} target={[0, 0, 0]} />
		</T.PerspectiveCamera>

		<T.AmbientLight intensity={0.6} />
		<T.DirectionalLight position={[5, 10, 7]} intensity={1.2} />
		<T.HemisphereLight skyColor={'#ffffff'} groundColor={'#444444'} intensity={0.5} />

		{#if element !== undefined}
			<Model
				bind:this={modelComponent}
				gltfScene={loadedGltfScene}
				position={modelPositionOffset}
				scale={userState.topo.scale}
				activeTool={activeTool}
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
		bind:altitude={userState.topo.altitude}
		gltfScene={loadedGltfScene}
		modelOffset={modelPositionOffset}
		onClose={() => showMapModal = false} 
	/>
{/if}