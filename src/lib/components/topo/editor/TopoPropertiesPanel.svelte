<script>
	import { userState } from '$lib/state/editor.svelte.js';
	import TagSelector from '$lib/components/ui/TagSelector.svelte';
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import {
		availableTopoTags,
		availableRouteTags,
		convertRouteType,
		calculateRouteLength,
		calculateBoltAmount
	} from '$lib/assets/js/topo-utils.js';

	import { uiaaMap, standardGrades, getGradeLabel } from '$lib/assets/js/grades.js';
	import { isMobileViewport } from '$lib/assets/js/mobile-utils.js';
	import { resize, snapToBiggestHeight } from '$lib/assets/js/resize.js';

	let {
		showMapModal = $bindable(false),
		drawingTarget = $bindable(null),
		activeTool = $bindable('route')
	} = $props();

	let routes = $derived(userState.topo.routes);
	let lastSelectedId = $state(null);
	let lastSelectedFpId = $state(null);

	$effect(() => {
		const selectedId = userState.ui.selectedRouteId;
		const selectedFpId = userState.ui.selectedFixpointId;

		if (selectedId && selectedId !== lastSelectedId) {
			lastSelectedId = selectedId;
			const route = userState.topo.routes.find((r) => r.id === selectedId);
			if (route) {
				if (activeTab !== 'routes') activeTab = 'routes';

				// Set drawing target (removed auto-tool-selection)
				if (route.type !== 'multi-pitch') {
					if (drawingTarget?.id !== selectedId) {
						drawingTarget = { type: 'route', id: selectedId };
					}
				} else {
					if (drawingTarget?.routeId !== selectedId) {
						drawingTarget = null;
					}
				}

				// Scroll to element
				setTimeout(() => {
					const el = document.getElementById('route-' + selectedId);
					el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}, 100);
			}
		} else if (!selectedId) {
			lastSelectedId = null;
			if (drawingTarget && drawingTarget.type === 'route') drawingTarget = null;
		}

		if (selectedFpId && selectedFpId !== lastSelectedFpId) {
			lastSelectedFpId = selectedFpId;
			if (activeTab !== 'fixpoints') activeTab = 'fixpoints';
			setTimeout(() => {
				const el = document.getElementById('fixpoint-' + selectedFpId);
				el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}, 100);
		} else if (!selectedFpId) {
			lastSelectedFpId = null;
		}
	});

	let activeTab = $state('info'); // 'info' | 'routes' | 'fixpoints'
	let isMobile = $state(false);
	let expandedRouteId = $state(null);
	
	onMount(() => {
		isMobile = isMobileViewport();
		const handleResize = () => {
			isMobile = isMobileViewport();
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	function switchTab(tab) {
		activeTab = tab;
		userState.ui.selectedRouteId = null;
		userState.ui.selectedFixpointId = null;
	}

	function toggleRouteExpand(routeId) {
		expandedRouteId = expandedRouteId === routeId ? null : routeId;
	}
</script>

<!-- Desktop Layout -->
<div class="hidden md:flex fixed top-25 right-12 z-50 w-110 flex-col max-h-[85vh]">
	<!-- Tab Bar (Fixed Header) -->
	<div
		class="bg-white rounded-t-[2.5rem] shadow-sm p-1.5 border-x border-t border-gray-200 flex gap-1.5 z-10"
	>
		<button
			class="flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-full transition-all {activeTab ===
			'info'
				? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
				: 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}"
			onclick={() => switchTab('info')}
		>
			<i class="fa-solid fa-circle-info mr-1.5 text-xs"></i>
			{$_('menu.info')}
		</button>
		<button
			class="flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-full transition-all {activeTab ===
			'routes'
				? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
				: 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}"
			onclick={() => switchTab('routes')}
		>
			<i class="fa-solid fa-route mr-1.5 text-xs"></i>
			{$_('topo.routes')}
			<span
				class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] {activeTab === 'routes'
					? 'bg-blue-500 text-white'
					: 'bg-gray-100 text-gray-500'}"
			>
				{routes.length}
			</span>
		</button>
		<button
			class="flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-full transition-all {activeTab ===
			'fixpoints'
				? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
				: 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}"
			onclick={() => switchTab('fixpoints')}
		>
			<i class="fa-solid fa-location-dot mr-1.5 text-xs"></i>
			{$_('ui.fixpoints')}
			<span
				class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] {activeTab === 'fixpoints'
					? 'bg-blue-500 text-white'
					: 'bg-gray-100 text-gray-500'}"
			>
				{userState.topo.fixPoints.length}
			</span>
		</button>
	</div>

	<!-- Scrollable Content Area -->
	<div
		class="bg-gray-50/80 backdrop-blur-sm rounded-b-[2.5rem] shadow-xl border-x border-b border-gray-200 overflow-hidden flex flex-col flex-1"
	>
		<div class="overflow-y-auto flex-1 p-5 custom-scrollbar">
			<div class="flex flex-col gap-5 pb-5">
				{#if activeTab === 'info'}
					<div class="bg-white rounded-[2rem] shadow-sm p-6 border border-gray-200">
						<h3 class="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
							<div class="w-1.5 h-1.5 rounded-full bg-blue-500 text-blue-500"></div>
							{$_('ui.topo_infos')}
						</h3>

						<div class="space-y-4">
							<div class="space-y-1.5">
								<label for="name" class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
									{$_('ui.name')}
								</label>
								<input
									type="text"
									id="name"
									bind:value={userState.topo.name}
									class="w-full px-4 py-2.5 rounded-2xl text-sm border-2 border-gray-50 focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-all outline-none"
									placeholder="e.g. Dream Wall"
								/>
							</div>

							<div class="space-y-1.5">
								<label for="author" class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
									{$_('ui.author')}
								</label>
								<input
									type="text"
									id="author"
									bind:value={userState.topo.author}
									class="w-full px-4 py-2.5 rounded-2xl text-sm border-2 border-gray-50 focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-all outline-none"
									placeholder="Your Name"
								/>
							</div>

							<div class="space-y-1.5">
								<label for="rock" class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
									{$_('ui.rock_type')}
								</label>
								<select
									id="rock"
									bind:value={userState.topo.rock}
									class="w-full px-4 py-2.5 rounded-2xl text-sm border-2 border-gray-50 focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-all outline-none appearance-none"
								>
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

							<div class="space-y-1.5">
								<label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
									{$_('ui.location')}
								</label>
								<div class="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
									<button
										class="bg-white hover:bg-gray-100 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm border border-gray-200 transition-all flex items-center gap-2"
										onclick={() => (showMapModal = true)}
									>
										<i class="fa-solid fa-map-location-dot"></i>
										{$_('ui.open_map')}
									</button>
									<div class="flex-1 min-w-0">
										{#if userState.topo.coordinates[0] !== 0}
											<div class="text-[10px] text-gray-500 font-mono truncate leading-tight">
												{userState.topo.coordinates[1].toFixed(4)}, {userState.topo.coordinates[0].toFixed(4)}
											</div>
											<div class="text-[10px] text-gray-400 uppercase font-black mt-0.5">
												{userState.topo.wallAzimuth}° / {userState.topo.altitude ? userState.topo.altitude.toFixed(0) : 0}m
											</div>
										{:else}
											<div class="text-[10px] text-gray-400 italic">Not set</div>
										{/if}
									</div>
								</div>
							</div>

							<div class="space-y-1.5">
								<label for="description" class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
									{$_('ui.description')}
								</label>
								<textarea
									id="description"
									bind:value={userState.topo.description}
									rows="3"
									class="w-full px-4 py-2.5 rounded-2xl text-sm border-2 border-gray-50 focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-all outline-none resize-none"
									placeholder="Tell us about this crag..."
								></textarea>
							</div>

							<div class="space-y-1.5">
								<label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 capitalize">{$_('ui.tags')}</label>
								<div class="p-1">
									<TagSelector
										bind:selectedTags={userState.topo.tags}
										availableTags={availableTopoTags}
									/>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#if activeTab === 'routes'}
					{#if routes.length === 0}
						<div class="bg-white rounded-[2rem] p-10 text-center border-2 border-dashed border-gray-200">
							<div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
								<i class="fa-solid fa-route text-gray-300"></i>
							</div>
							<p class="text-sm text-gray-400 font-medium">No routes created yet.</p>
							<p class="text-[10px] text-gray-300 mt-1">Double-click on the wall to start drawing.</p>
						</div>
					{/if}

					{#each routes as route, i (route.id)}
						<div
							id={'route-' + route.id}
							class={'bg-white rounded-[2rem] shadow-sm p-6 border-2 transition-all relative overflow-hidden ' +
								(userState.ui.selectedRouteId === route.id
									? 'border-blue-500 ring-4 ring-blue-50'
									: 'border-gray-100 hover:border-gray-200')}
						>
							{#if userState.ui.selectedRouteId === route.id}
								<div class="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
							{/if}

							<div
								class="flex justify-between items-center mb-6 cursor-pointer group"
								onclick={() => {
									if (userState.ui.selectedRouteId === route.id) {
										userState.ui.selectedRouteId = null;
										drawingTarget = null;
									} else {
										userState.ui.selectedRouteId = route.id;
										userState.ui.selectedFixpointId = null;
										if (route.type !== 'multi-pitch') {
											drawingTarget = { type: 'route', id: route.id };
										} else {
											drawingTarget = null;
										}
									}
								}}
							>
								<div class="flex items-center gap-3">
									<div class="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-black shadow-inner">
										{i + 1}
									</div>
									<h3 class={'text-sm font-bold ' + (userState.ui.selectedRouteId === route.id ? 'text-blue-600' : 'text-gray-700')}>
										{route.name || `Route ${i+1}`}
									</h3>
								</div>
								
								<div class="flex items-center gap-1">
									{#if userState.ui.selectedRouteId === route.id}
										<div class="px-2 py-0.5 rounded-full bg-blue-600 text-[9px] font-black text-white uppercase tracking-tighter mr-2 animate-pulse">
											{$_('ui.edit_mode')}
										</div>
									{/if}
									<button
										class="text-gray-300 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
										onclick={(e) => {
											e.stopPropagation();
											const index = userState.topo.routes.indexOf(route);
											if (index > -1) {
												userState.topo.routes.splice(index, 1);
												if (userState.ui.selectedRouteId === route.id) {
													userState.ui.selectedRouteId = null;
													drawingTarget = null;
												}
											}
										}}
										title={$_('ui.delete_route')}
									>
										<i class="fa-solid fa-trash-can text-xs"></i>
									</button>
								</div>
							</div>

							{#if userState.ui.selectedRouteId === route.id}
								<div class="mb-5 bg-blue-50/50 text-blue-800 text-[10px] p-3 rounded-2xl border border-blue-100/50 flex items-start gap-2">
									<i class="fa-solid fa-lightbulb mt-0.5"></i>
									<span>{$_('ui.assign_fixpoints_hint')}</span>
								</div>
							{/if}

							<div class="space-y-4">
								<div class="flex gap-4">
									<div class="flex-1 space-y-1.5">
										<label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{$_('ui.name')}</label>
										<input
											type="text"
											bind:value={route.name}
											class="w-full px-3 py-2 rounded-xl text-xs border-2 border-gray-50 focus:border-blue-500 bg-gray-50/30 transition-all outline-none"
										/>
									</div>
									<div class="w-1/3 space-y-1.5">
										<label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{$_('ui.type')}</label>
										<select
											value={route.type}
											onchange={(e) => convertRouteType(route, e.currentTarget.value)}
											class="w-full px-3 py-2 rounded-xl text-xs border-2 border-gray-50 focus:border-blue-500 bg-gray-50/30 transition-all outline-none"
										>
											<option value="sports-climbing">Sport</option>
											<option value="bouldering">Bouldern</option>
											<option value="trad">Trad</option>
											<option value="multi-pitch">Multi</option>
										</select>
									</div>
								</div>

								{#if route.type !== 'multi-pitch'}
									<div class="flex gap-4">
										<div class="flex-1 space-y-1.5">
											<label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{$_('topo.grade')}</label>
											<div class="flex gap-1">
												<select
													bind:value={route._gradeScale}
													class="w-16 px-2 py-2 rounded-xl text-[10px] border-2 border-gray-50 focus:border-blue-500 bg-gray-50/30 transition-all outline-none font-bold"
												>
													<option value="french">FR</option>
													<option value="uiaa">UIAA</option>
												</select>
												<select
													bind:value={route.grade}
													class="flex-1 px-3 py-2 rounded-xl text-xs border-2 border-gray-50 focus:border-blue-500 bg-gray-50/30 transition-all outline-none"
												>
													{#each standardGrades as g}
														{#if route._gradeScale !== 'uiaa' || uiaaMap[g]}
															<option value={g}>{getGradeLabel(g, route._gradeScale)}</option>
														{/if}
													{/each}
												</select>
											</div>
										</div>
										<div class="w-1/4 space-y-1.5">
											<label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{$_('ui.length')}</label>
											<div class="relative">
												<input
													type="number"
													bind:value={route.length}
													class="w-full pl-3 pr-6 py-2 rounded-xl text-xs border-2 border-gray-50 focus:border-blue-500 bg-gray-50/30 outline-none"
												/>
												<span class="absolute right-2 top-2 text-[8px] text-gray-400">m</span>
											</div>
										</div>
										{#if route.type === 'sports-climbing'}
										<div class="w-1/4 space-y-1.5">
											<label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Exen</label>
											<input
												type="number"
												bind:value={route.boltAmount}
												class="w-full px-3 py-2 rounded-xl text-xs border-2 border-gray-50 focus:border-blue-500 bg-gray-50/30 outline-none"
											/>
										</div>
										{/if}
									</div>
								{:else}
									<!-- Multi-Pitch Mini List -->
									<div class="p-3 rounded-2xl bg-gray-50 space-y-2 border border-blue-50">
										<div class="flex justify-between items-center text-[10px] font-black uppercase text-blue-400 tracking-tighter px-1">
											<span>Pitches</span>
											<button 
												class="text-blue-600 hover:text-blue-800"
												onclick={() => {
													if (!route.pitches) route.pitches = [];
													route.pitches.push({
														id: crypto.randomUUID(),
														pitchNumber: route.pitches.length + 1,
														grade: '',
														length: 0,
														points: [],
														type: 'pitch'
													});
												}}
											>+ Add</button>
										</div>
										{#each route.pitches as pitch, idx}
											<div class="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 group/pitch">
												<span class="text-[10px] text-gray-400 font-black px-1">{idx+1}</span>
												<select bind:value={pitch.grade} class="flex-1 bg-transparent text-xs outline-none">
													<option value="">Grade...</option>
													{#each standardGrades as g}<option value={g}>{g}</option>{/each}
												</select>
												<input type="number" bind:value={pitch.length} class="w-10 text-[10px] text-right outline-none" placeholder="m"/>
												<button
													class="text-gray-300 hover:text-blue-600 transition-all {drawingTarget?.id === pitch.id ? 'text-blue-600' : ''}"
													onclick={() => drawingTarget = { type: 'pitch', routeId: route.id, pitchId: pitch.id, id: pitch.id }}
												>
													<i class="fa-solid fa-pen-nib text-[10px]"></i>
												</button>
											</div>
										{/each}
									</div>
								{/if}

								<div class="space-y-1.5">
									<label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{$_('ui.description')}</label>
									<textarea
										bind:value={route.description}
										rows="2"
										class="w-full px-3 py-2 rounded-xl text-xs border-2 border-gray-50 focus:border-blue-500 bg-gray-50/30 transition-all outline-none resize-none"
									></textarea>
								</div>

								<div class="flex items-center justify-between gap-4">
									<div class="flex-1">
										<TagSelector bind:selectedTags={route.tags} availableTags={availableRouteTags} small={true} />
									</div>
									
									{#if userState.topo.fixPoints.length > 0}
									<details class="group/fp flex-none">
										<summary class="list-none flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 text-gray-400 cursor-pointer hover:bg-blue-50 hover:text-blue-500 transition-all border border-gray-100">
											<i class="fa-solid fa-hashtag text-[10px]"></i>
										</summary>
										<div class="absolute bottom-16 right-6 z-20 bg-white shadow-2xl rounded-2xl p-3 border border-gray-100 min-w-[200px]">
											<p class="text-[9px] font-black uppercase text-gray-400 mb-2 border-b pb-1">Assign Fixpoints</p>
											<div class="grid grid-cols-5 gap-1.5">
												{#each userState.topo.fixPoints as fp, idx}
													<button
														class={"w-7 h-7 flex items-center justify-center rounded-lg text-[9px] font-black transition-all " +
														(route.fixPoints?.includes(fp.id) ? "bg-blue-600 text-white shadow-lg shadow-blue-100 scale-110" : "bg-gray-50 text-gray-400 hover:bg-gray-100")}
														onclick={(e) => {
															e.stopPropagation();
															if (!route.fixPoints) route.fixPoints = [];
															if (route.fixPoints.includes(fp.id)) {
																route.fixPoints = route.fixPoints.filter(id => id !== fp.id);
															} else {
																route.fixPoints.push(fp.id);
															}
														}}
													>
														{idx + 1}
													</button>
												{/each}
											</div>
										</div>
									</details>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				{/if}

				{#if activeTab === 'fixpoints'}
					{#if userState.topo.fixPoints.length === 0}
						<div class="bg-white rounded-[2rem] p-10 text-center border-2 border-dashed border-gray-200">
							<div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
								<i class="fa-solid fa-location-dot text-gray-300"></i>
							</div>
							<p class="text-sm text-gray-400 font-medium">No fixpoints set.</p>
							<p class="text-[10px] text-gray-300 mt-1">Switch to Fixpoint tool on the left to add.</p>
						</div>
					{:else}
						<div class="grid grid-cols-1 gap-4">
							{#each userState.topo.fixPoints as point, i (point.id)}
								<div
									id={'fixpoint-' + point.id}
									class={'bg-white rounded-[2rem] shadow-sm p-5 border-2 transition-all flex items-center gap-4 ' +
										(userState.ui.selectedFixpointId === point.id
											? 'border-blue-500 ring-4 ring-blue-50'
											: 'border-gray-100 hover:border-gray-200')}
								>
									<div class="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 text-[10px] font-black border border-gray-100">
										{i + 1}
									</div>
									
									<div class="flex-1 space-y-1">
										<label class="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-0.5">Type</label>
										<select
											bind:value={point.type}
											class="w-full bg-transparent text-sm font-bold text-gray-700 outline-none"
										>
											<option value="bolt">{$_('topo.fixpoints.bolt')}</option>
											<option value="belay">{$_('topo.fixpoints.belay')}</option>
											<option value="piton">{$_('topo.fixpoints.piton')}</option>
											<option value="hourglass">{$_('topo.fixpoints.hourglass')}</option>
										</select>
									</div>

									<button
										class="text-gray-300 hover:text-red-500 transition-colors w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-red-50 transition-all"
										onclick={() => {
											const pointId = point.id;
											userState.topo.fixPoints.splice(i, 1);
											if (userState.ui.selectedFixpointId === pointId)
												userState.ui.selectedFixpointId = null;
											userState.topo.routes.forEach((r) => {
												if (r.fixPoints && r.fixPoints.includes(pointId)) {
													r.fixPoints = r.fixPoints.filter((id) => id !== pointId);
												}
											});
										}}
									>
										<i class="fa-solid fa-trash-can text-xs"></i>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Mobile Bottom Sheet -->
{#if isMobile}
	<div 
		use:resize
		class="fixed left-0 right-0 top-1/2 bottom-0 z-40 bg-white rounded-t-3xl shadow-2xl border-t border-gray-200 overflow-hidden" 
	>
		<!-- Grabber (Mobile) -->
		<div class="bg-gray-200 h-1 w-12 rounded-full self-center mt-2 sm:hidden mx-auto"></div>

		<!-- Compact Tabs -->
		<div class="flex gap-1 p-2 border-b border-gray-100 bg-gray-50 mt-2">
			<button
				class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all {activeTab === 'info' ? 'bg-blue-600 text-white' : 'text-gray-400'}"
				onclick={() => switchTab('info')}
			>
				<i class="fa-solid fa-circle-info"></i>
			</button>
			<button
				class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all {activeTab === 'routes' ? 'bg-blue-600 text-white' : 'text-gray-400'}"
				onclick={() => switchTab('routes')}
			>
				<i class="fa-solid fa-route"></i>
				<span class="ml-1 text-[10px]">{routes.length}</span>
			</button>
			<button
				class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all {activeTab === 'fixpoints' ? 'bg-blue-600 text-white' : 'text-gray-400'}"
				onclick={() => switchTab('fixpoints')}
			>
				<i class="fa-solid fa-location-dot"></i>
				<span class="ml-1 text-[10px]">{userState.topo.fixPoints.length}</span>
			</button>
		</div>

		<!-- Scrollable Content -->
		<div class="overflow-y-auto" style="height: calc(100% - 90px);">
			<div class="p-3 space-y-2">
				{#if activeTab === 'routes'}
					{#if routes.length === 0}
						<div class="text-center py-8 text-sm text-gray-400">
							<i class="fa-solid fa-route text-2xl mb-2"></i>
							<p>No routes yet</p>
						</div>
					{:else}
						{#each routes as route, i (route.id)}
							<div 
								class="bg-white rounded-2xl border-2 transition-all {userState.ui.selectedRouteId === route.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}"
							>
								<!-- Compact Header -->
								<div 
									class="flex items-center gap-2 p-3 cursor-pointer"
									onclick={() => {
										if (userState.ui.selectedRouteId === route.id) {
											userState.ui.selectedRouteId = null;
											drawingTarget = null;
										} else {
											userState.ui.selectedRouteId = route.id;
											if (route.type !== 'multi-pitch') {
												drawingTarget = { type: 'route', id: route.id };
											}
											expandedRouteId = route.id;
											
											// Auto-expand to full height on select if on mobile
											if (isMobile) {
												snapToBiggestHeight();
											}
										}
									}}
								>
									<div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
										{i + 1}
									</div>
									<div class="flex-1 min-w-0">
										<div class="font-bold text-sm truncate {userState.ui.selectedRouteId === route.id ? 'text-blue-600' : 'text-gray-700'}">
											{route.name || `Route ${i+1}`}
										</div>
										<div class="text-xs text-gray-500 truncate">
											{#if route.grade}{getGradeLabel(route.grade, route._gradeScale || 'french')} · {/if}
											{#if route.length}{route.length}m · {/if}
											{route.type === 'sports-climbing' ? 'Sport' : route.type === 'bouldering' ? 'Boulder' : route.type === 'multi-pitch' ? 'Multi' : 'Trad'}
										</div>
									</div>
									<button
										class="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
										onclick={(e) => {
											e.stopPropagation();
											const index = userState.topo.routes.indexOf(route);
											if (index > -1) {
												userState.topo.routes.splice(index, 1);
												if (userState.ui.selectedRouteId === route.id) {
													userState.ui.selectedRouteId = null;
													drawingTarget = null;
												}
											}
										}}
									>
										<i class="fa-solid fa-trash-can text-sm"></i>
									</button>
								</div>

								<!-- Expandable Details (only when selected) -->
								{#if userState.ui.selectedRouteId === route.id}
									<div class="px-3 pb-3 pt-1 space-y-2 border-t border-gray-100">
										<div class="flex gap-2">
											<input
												type="text"
												bind:value={route.name}
												class="flex-1 px-3 py-2 rounded-xl text-xs border border-gray-200 focus:border-blue-500 outline-none"
												placeholder="Route name"
											/>
										</div>
										{#if route.type !== 'multi-pitch'}
											<div class="flex gap-2">
												<select
													bind:value={route.grade}
													class="flex-1 px-3 py-2 rounded-xl text-xs border border-gray-200 outline-none"
												>
													{#each standardGrades as g}
														<option value={g}>{getGradeLabel(g, route._gradeScale || 'french')}</option>
													{/each}
												</select>
												<input
													type="number"
													bind:value={route.length}
													class="w-16 px-2 py-2 rounded-xl text-xs border border-gray-200 outline-none"
													placeholder="m"
												/>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				{:else if activeTab === 'fixpoints'}
					{#if userState.topo.fixPoints.length === 0}
						<div class="text-center py-8 text-sm text-gray-400">
							<i class="fa-solid fa-location-dot text-2xl mb-2"></i>
							<p>No fixpoints yet</p>
						</div>
					{:else}
						{#each userState.topo.fixPoints as point, i (point.id)}
							<div class="bg-white rounded-2xl border-2 border-gray-200 p-3 flex items-center gap-3">
								<div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0">
									{i + 1}
								</div>
								<select
									bind:value={point.type}
									class="flex-1 bg-transparent text-sm font-bold text-gray-700 outline-none"
								>
									<option value="bolt">Bolt</option>
									<option value="belay">Belay</option>
									<option value="piton">Piton</option>
								</select>
								<button
									class="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
									onclick={() => {
										userState.topo.fixPoints.splice(i, 1);
									}}
								>
									<i class="fa-solid fa-trash-can text-sm"></i>
								</button>
							</div>
						{/each}
					{/if}
				{:else}
					<div class="space-y-4">
						<div class="space-y-1.5 px-1">
							<label for="name-mobile" class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
								{$_('ui.name')}
							</label>
							<input
								type="text"
								id="name-mobile"
								bind:value={userState.topo.name}
								class="w-full px-4 py-2.5 rounded-2xl text-sm border border-gray-200 focus:border-blue-500 bg-white outline-none"
								placeholder="e.g. Dream Wall"
							/>
						</div>

						<div class="space-y-1.5 px-1">
							<label for="rock-mobile" class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
								{$_('ui.rock_type')}
							</label>
							<select
								id="rock-mobile"
								bind:value={userState.topo.rock}
								class="w-full px-4 py-2.5 rounded-2xl text-sm border border-gray-200 focus:border-blue-500 bg-white outline-none appearance-none"
							>
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

						<div class="text-center pt-4 text-[10px] text-gray-400">
							<p>Open desktop for full metadata editing</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.grabber.top) {
		height: 100px;
		width: 100%;
		position: absolute;
		top: 0;
		left: 0;
		cursor: pointer;
		z-index: 10;
	}

	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #e5e7eb;
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #d1d5db;
	}
</style>