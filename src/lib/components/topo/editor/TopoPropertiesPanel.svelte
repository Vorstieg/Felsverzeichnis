<script>
	import { userState } from '$lib/state/editor.svelte.js';
	import TagSelector from '$lib/components/ui/TagSelector.svelte';
	import { _ } from 'svelte-i18n';
    import {
        availableTopoTags,
        availableRouteTags,
        convertRouteType,
        calculateRouteLength,
        calculateBoltAmount 
    } from '$lib/assets/js/topo-utils.js';

    import { uiaaMap, standardGrades, getGradeLabel } from '$lib/assets/js/grades.js';

    let { showMapModal = $bindable(false), drawingTarget = $bindable(null), activeTool = $bindable('route') } = $props();

        let routes = $derived(userState.topo.routes);
    
        $effect(() => {
            const selectedId = userState.ui.selectedRouteId;
            if (selectedId) {			const route = userState.topo.routes.find(r => r.id === selectedId);
			if (route) {
				// Auto-switch tool based on route type
				if (route.type === 'multi-pitch') {
					if (activeTool !== 'multipitch') activeTool = 'multipitch';
				} else {
					if (activeTool !== 'route') activeTool = 'route';
				}

				// Set drawing target
				if (route.type !== 'multi-pitch') {
					if (drawingTarget?.id !== selectedId) {
						drawingTarget = { type: 'route', id: selectedId };
					}
				} else {
					// For multi-pitch, we don't auto-select a pitch to edit (drawingTarget remains null or checks consistency)
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
		} else {
			if (drawingTarget) drawingTarget = null;
		}

		const selectedFpId = userState.ui.selectedFixpointId;
		if (selectedFpId) {
			setTimeout(() => {
				const el = document.getElementById('fixpoint-' + selectedFpId);
				el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}, 100);
		}
	});
</script>

<div class="fixed top-25 right-12 z-50">
	<div class="overflow-y-scroll h-fit max-h-190">
		<div class="bg-white rounded-2xl shadow-md p-5 mb-5 mr-5 w-100 border-1 border-gray-200">
			<h3 class="text-lg font-semibold mb-4">{$_('ui.topo_infos')}</h3>
			<div class="flex flex-row">
				<label for="name" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.name')}</label>
				<input
					type="text"
					id="name"
					bind:value={userState.topo.name}
					class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
				/></div>
			<div class="flex flex-row">
				<label for="author" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.author')}</label>
				<input
					type="text"
					id="author"
					bind:value={userState.topo.author}
					class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
				/></div>
			<div class="flex flex-row">
				<label for="rock" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.rock_type')}</label>
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
				<label class="block text-sm font-medium w-1/3 mr-2">{$_('ui.location')}</label>
				<div class="flex-1 flex items-center gap-2">
					<button
						class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm border border-gray-300 transition-colors"
						onclick={() => showMapModal = true}
					>
						<i class="fa-solid fa-map-location-dot mr-1"></i> {$_('ui.open_map')}
					</button>
					{#if userState.topo.coordinates[0] !== 0}
						<div class="flex flex-col text-xs text-gray-500 leading-tight">
							<span>{userState.topo.coordinates[1].toFixed(4)}, {userState.topo.coordinates[0].toFixed(4)}</span>
							<span>{userState.topo.wallAzimuth}° / {userState.topo.altitude ? userState.topo.altitude.toFixed(1) : 0}
								m</span>
						</div>
					{/if}
				</div>
			</div>

			<div class="flex flex-row">
				<label for="description" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.description')}</label>
				<textarea
					id="description"
					bind:value={userState.topo.description}
					class="w-full px-3 py-1 rounded-2xl text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
				></textarea></div>
			<div class="flex flex-row">
				<label class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.tags')}</label>
				<div class="w-full mb-4">
					<TagSelector bind:selectedTags={userState.topo.tags} availableTags={availableTopoTags} />
				</div>
			                        </div>
			                    </div>
			                    {#each routes as route, i (route.id)}
			                        <div
			                            id={"route-" + route.id}			                class={"bg-white rounded-2xl shadow-md p-5 mb-5 mr-5 w-100 border-2 transition-all " +                (userState.ui.selectedRouteId === route.id ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200")}
			>
				<div class="flex justify-between items-center mb-4 cursor-pointer"
						 onclick={() => {
                             if (userState.ui.selectedRouteId === route.id) {
                                 userState.ui.selectedRouteId = null;
                                 drawingTarget = null;
                             } else {
                                 userState.ui.selectedRouteId = route.id;
                                 userState.ui.selectedFixpointId = null;
                                 // Default to drawing the route itself (or just selecting it)
                                 if (route.type !== 'multi-pitch') {
                                     drawingTarget = { type: 'route', id: route.id };
                                 } else {
                                     drawingTarget = null; // Don't auto-select a pitch for MP
                                 }
                             }
                         }}
                >
                    <h3
                        class={"text-lg font-semibold flex items-center gap-2 " + (userState.ui.selectedRouteId === route.id ? "text-blue-600" : "")}>
                        Route {i + 1}
                        {#if userState.ui.selectedRouteId === route.id}
                                                            <span
                                                                            class="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                                {$_('ui.edit_mode')}
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
                                                                    if (userState.ui.selectedRouteId === route.id) {
                                                                        userState.ui.selectedRouteId = null;
                                                                        drawingTarget = null;
                                                                    }
                                                                }
                                                            }}
                            title={$_('ui.delete_route')}
                        >
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                {#if userState.ui.selectedRouteId === route.id}
                    <div class="mb-4 bg-blue-50 text-blue-700 text-xs p-2 rounded border border-blue-100">
                        {$_('ui.assign_fixpoints_hint')}
                    </div>
                {/if}
                <div class="flex flex-row"><label for="name"
                                                                                    class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.name')}</label>
                    <input
                        type="text"
                        id="name"
                        bind:value={route.name}
                        class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                    /></div>
                <div class="flex flex-row">
                    <label for="type" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.type')}</label>
                    <select name="type" id="type" 
                                    value={route.type}
                                    onchange={(e) => convertRouteType(route, e.currentTarget.value)}
                                    class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4">
                        <option value="sports-climbing">Sport</option>
                        <option value="bouldering">Bouldern</option>
                        <option value="trad">Traditionell</option>
                        <option value="multi-pitch">Mehrseillängen</option>
                    </select>
                </div>
                
                {#if route.type !== 'multi-pitch'}
                    <div class="flex flex-row">
                        <label for="grade" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('topo.grade')}:</label>
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
                    {#if !route.type || route.type === "sports-climbing"}
                        <div class="flex flex-row items-center mb-4">
                            <label for="boltAmount" class="block mr-2 text-sm font-medium w-1/3">{$_('ui.bolt_amount')}</label>
                            <div class="w-full flex gap-2">
                                <input
                                    type="number"
                                    id="boltAmount"
                                    bind:value={route.boltAmount}
                                    class="flex-1 px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    class="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors border border-gray-300"
                                    onclick={() => route.boltAmount = calculateBoltAmount(route)}
                                    title={$_('ui.auto_calc')}
                                >
                                    <i class="fa-solid fa-calculator text-xs"></i>
                                </button>
                            </div>
                        </div>
                    {/if}
                    {#if !route.type || route.type === "sports-climbing" || route.type === "trad"}
                        <div class="flex flex-row items-center mb-4">
                            <label for="length" class="block mr-2 text-sm font-medium w-1/3">{$_('ui.length')}</label>
                            <div class="w-full flex gap-2">
                                <input
                                    type="number"
                                    id="length"
                                    bind:value={route.length}
                                    class="flex-1 px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    class="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors border border-gray-300"
                                    onclick={() => route.length = calculateRouteLength(route)}
                                    title={$_('ui.auto_calc')}
                                >
                                    <i class="fa-solid fa-calculator text-xs"></i>
                                </button>
                            </div>
                        </div>
                    {/if}
                {:else}
                    <!-- Multi-Pitch UI -->
                    <div class="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="text-sm font-bold text-gray-700">Pitches</h4>
                            <button 
                                class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold hover:bg-blue-200"
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
                            >
                                + Add Pitch
                            </button>
                        </div>
                        
                        {#if route.pitches}
                            {#each route.pitches as pitch, idx}
                                <div class="mb-3 pl-3 border-l-2 border-gray-300">
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-xs font-bold text-gray-500">Pitch {idx + 1}</span>
                                        <div class="flex gap-2">
                                            <button
                                                class={"text-xs px-2 py-0.5 rounded border " + 
                                                (drawingTarget?.id === pitch.id ? "bg-red-500 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100")}
                                                onclick={() => drawingTarget = { type: 'pitch', routeId: route.id, pitchId: pitch.id, id: pitch.id }}
                                            >
                                                {drawingTarget?.id === pitch.id ? 'Drawing...' : 'Draw Line'}
                                            </button>
                                            <button
                                                class="text-gray-400 hover:text-red-500"
                                                onclick={() => {
                                                    route.pitches.splice(idx, 1);
                                                    if (drawingTarget?.id === pitch.id) drawingTarget = null;
                                                }}
                                            >
                                                <i class="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="flex gap-2 mb-2">
                                        <select
                                            bind:value={pitch.type}
                                            class="w-full px-2 py-1 rounded text-xs border border-gray-300"
                                        >
                                            <option value="climb">Climb</option>
                                            <option value="walk">Walk</option>
                                            <option value="abseil">Abseil</option>
                                        </select>
                                    </div>
                                    <div class="flex gap-2 mb-2">
                                        <input 
                                            type="number" 
                                            placeholder="m" 
                                            bind:value={pitch.length}
                                            class="w-1/3 px-2 py-1 rounded text-xs border border-gray-300"
                                        />
                                        <select
                                            bind:value={pitch.grade}
                                            class="w-2/3 px-2 py-1 rounded text-xs border border-gray-300"
                                        >
                                            <option value="">Grade...</option>
                                            {#each standardGrades as g}
                                                <option value={g}>{g}</option>
                                            {/each}
                                        </select>
                                    </div>
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}

                <div class="flex flex-row">
                    <label for="description" class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.description')}</label>
                    <textarea
                        id="description"
                        bind:value={route.description}
                        class="w-full px-3 py-1 rounded-2xl text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                    ></textarea></div>
                <div class="flex flex-row">
                    <label class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.tags')}</label>
                    <div class="w-full mb-4">
                        <TagSelector bind:selectedTags={route.tags} availableTags={availableRouteTags} />
                    </div>
                </div>

                {#if userState.topo.fixPoints.length > 0}
                    <div class="flex flex-row">
                        <label class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.fixpoints')}</label>
                        <div class="w-full mb-4">
                            <details class="group">
                                <summary
                                    class="list-none cursor-pointer text-sm text-blue-600 hover:text-blue-800 font-medium mb-2 flex items-center gap-2 select-none">
                                    <i class="fa-solid fa-chevron-right group-open:rotate-90 transition-transform text-xs"></i>
                                    <span>{route.fixPoints?.length || 0} {$_('ui.assigned')}</span>
                                </summary>
                                <div
                                    class="max-h-32 overflow-y-auto p-1 border border-gray-100 rounded-lg bg-gray-50 flex flex-wrap gap-1">
                                    {#each userState.topo.fixPoints as fp, idx}
                                        <button
                                            class={"w-8 h-8 flex items-center justify-center rounded text-xs font-semibold transition-colors " +
                                            (route.fixPoints?.includes(fp.id) ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100")}
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                if (!route.fixPoints) route.fixPoints = [];
                                                if (route.fixPoints.includes(fp.id)) {
                                                    route.fixPoints = route.fixPoints.filter(id => id !== fp.id);
                                                } else {
                                                    route.fixPoints.push(fp.id);
                                                }
                                            }}
                                            title={`${$_('ui.fixpoint')} ${idx + 1} (${fp.type})`}
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
        {#each userState.topo.fixPoints as point, i (point.id)}
            <div
                id={"fixpoint-" + point.id}
                class={"bg-white rounded-2xl shadow-md p-5 mb-5 mr-5 w-100 border-2 transition-all " + 
                (userState.ui.selectedFixpointId === point.id ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200")}
            >
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">{$_('ui.fixpoint')} {i + 1}</h3>
                    <button
                        class="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 cursor-pointer"
                        onclick={() => {
                            const pointId = point.id;
                            userState.topo.fixPoints.splice(i, 1);
                            if (userState.ui.selectedFixpointId === pointId) userState.ui.selectedFixpointId = null;
                            // Clean up references in routes
                            userState.topo.routes.forEach(r => {
                                if (r.fixPoints && r.fixPoints.includes(pointId)) {
                                    r.fixPoints = r.fixPoints.filter(id => id !== pointId);
                                }
                            });
                        }}
                        title={$_('ui.delete')}
                    >
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                <div class="flex flex-row">
                    <label class="block mb-2 mt-1 mr-2 text-sm font-medium w-1/3">{$_('ui.fixpoint_type')}</label>
                    <select bind:value={point.type}
                                                    class="w-full px-3 py-1 rounded-full text-sm border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4">
                        <option value="bolt">{$_('topo.fixpoints.bolt')}</option>
                        <option value="anchor">{$_('topo.fixpoints.anchor')}</option>
                        <option value="piton">{$_('topo.fixpoints.piton')}</option>
                        <option value="hourglass">{$_('topo.fixpoints.hourglass')}</option>
                    </select>
                </div>
            </div>
        {/each}
    </div>
</div>