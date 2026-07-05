<script>
	import { base } from '$app/paths';
	import { snapToBiggestHeight } from '$lib/assets/js/resize.js';
	import { afterNavigate, goto } from '$app/navigation';
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import GradeChart from '$lib/components/charts/GradeChart.svelte';
	import { calculateSunInfo, calculateWallDirection } from '$lib/assets/js/sun-calculations';
	import { _, locale } from 'svelte-i18n';
	import { securityRatings } from '$lib/config.js';

	let fullscreenImage = $state();
	let sunInfo = $state({ hours: 'N/A' });
	let wallDirection = $state('N/A');
	let searchTerm = $state('');

	/** @type {{data: any}} */
	let { data } = $props();
	let description = $derived(
		$locale === 'de' ? data.description_de : data.description_en || data.description_de
	);
	let sectors = $derived(data.crag?.properties?.sectors || []);
	let activeSectorId = $derived(data.sectorId || data.sector?.id);
	let displayWallDirection = $derived(
		wallDirection !== 'N/A' && wallDirection !== 'Unknown'
			? $_('directions.' + wallDirection)
			: wallDirection
	);
	let displaySunHours = $derived(
		sunInfo.hours === 'shade_all_day' || sunInfo.hours === 'no_geodata'
			? $_('sun.' + sunInfo.hours)
			: sunInfo.hours
	);

	let has2D = $derived(
		!!data.topoJson?.image2D ||
			data.topoJson?.routes?.some((r) => r.points2D?.length > 0) ||
			data.topoJson?.outlines?.length > 0 ||
			data.topoJson?.fixPoints?.some((fp) => fp.position2D)
	);

	$effect(() => {
		if (data.topoJson) {
			sunInfo = calculateSunInfo(data.topoJson);
			wallDirection = calculateWallDirection(data.topoJson);
		}
	});

	let type = $derived(data.type);
	let name = $derived(data.name);
	let displayTitle = $derived.by(() => {
		if (activeSectorId) {
			const sectorName = data.crag?.properties?.sectors?.find((s) => s.id === activeSectorId)?.name;
			const baseName = data.crag?.properties?.name || name;
			if (sectorName && baseName.includes(sectorName)) return baseName;
			return sectorName ? `${baseName} - ${sectorName}` : `${baseName} - ${activeSectorId}`;
		}
		return data.crag?.properties?.name || name;
	});
	let path = $derived(data.path);
	let topoPath = $derived(data.topoPath || data.path);
	let topo = $derived(data.topo);
	let topoJson = $derived(data.topoJson);
	let transit = $derived(data.transit);
	let parking = $derived(data.parking);
	let has3DTopo = $derived(data.has3DTopo);
	let tags = $derived(data.tags);
	let security = $derived(data.security);
	let equipment = $derived(data.equipment);
	let images = $derived(data.images);

	const equipmentIcons = {
		Expressschlingen: `${base}/icons/quickdraw.png`,
		Friends: `${base}/icons/friend.png`,
		Keile: `${base}/icons/nut.png`,
		Eisschrauben: `${base}/icons/ice-screw.png`,
		Eisgeräte: `${base}/icons/ice-axe.png`,
		Seil: 'fa-solid fa-infinity',
		Helm: 'fa-solid fa-hard-hat'
	};

	afterNavigate((_navigation) => {
		if (location.hash) onMarkerClicked();
	});

	function onMarkerClicked() {
		if (snapToBiggestHeight) {
			snapToBiggestHeight();
		}
	}

	async function share() {
		await navigator.share({
			title: data.name,
			text: description,
			url: window.location.href
		});
	}

	function getSectorDescription(sector) {
		return $locale === 'de'
			? sector.description_de || sector.description || sector.description_en
			: sector.description_en || sector.description || sector.description_de;
	}

	function getSectorRouteCount(sector) {
		const routes = data.gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
		if (routes.length > 0) return routes.length;
		
		return (
			sector.routesCount ||
			sector.routeCount ||
			sector.routes?.length ||
			sector.assets?.routes?.length ||
			0
		);
	}

	function getSectorGradeDistribution(sector) {
		const routes = data.gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
		if (routes.length === 0) return [];

		let easy = 0, medium = 0, hard = 0, veryHard = 0;
		routes.forEach(r => {
			const g = r.grade || '';
			if (g.startsWith('3') || g.startsWith('4') || g.startsWith('5')) easy++;
			else if (g.startsWith('6')) medium++;
			else if (g.startsWith('7')) hard++;
			else if (g.startsWith('8') || g.startsWith('9')) veryHard++;
		});
		
		const total = easy + medium + hard + veryHard;
		if (total === 0) return [];
		
		return [
			{ count: easy, percent: (easy/total)*100, colorClass: 'bg-green-500', label: '< 6a' },
			{ count: medium, percent: (medium/total)*100, colorClass: 'bg-yellow-400', label: '6a - 6c+' },
			{ count: hard, percent: (hard/total)*100, colorClass: 'bg-red-500', label: '7a - 7c+' },
			{ count: veryHard, percent: (veryHard/total)*100, colorClass: 'bg-purple-600', label: '> 8a' }
		].filter(b => b.count > 0);
	}

	function getSectorDirection(sector) {
		const routes = data.gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
		const mockTopo = { 
			wallAzimuth: sector.wallAzimuth || sector.topo?.wallAzimuth || sector.properties?.wallAzimuth || routes[0]?.sectorWallAzimuth,
			routes 
		};
		const dir = calculateWallDirection(mockTopo, null);
		return dir !== 'Unknown' ? $_('directions.' + dir) : null;
	}
	
	function getSectorTypes(sector) {
		const routes = data.gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
		let t = routes[0]?.sectorTags;
		if (!t || (Array.isArray(t) && t.length === 0)) t = sector.type;
		if (!t || (Array.isArray(t) && t.length === 0)) t = sector.properties?.type;
		if (!t || (Array.isArray(t) && t.length === 0)) t = data.crag?.properties?.type || data.type;
		
		let arr = [];
		if (Array.isArray(t)) {
			arr = t;
		} else if (typeof t === 'string' && t.trim()) {
			arr = t.includes(',') ? t.split(',').map(x => x.trim()) : [t];
		}
		
		return arr.map(x => {
			const translated = $_('tags.' + x);
			return {
				id: x,
				name: translated === 'tags.' + x ? x : translated
			};
		});
	}

	function getTypeColorClass(typeId) {
		switch(typeId) {
			case 'sports-climbing': return 'bg-blue-100 text-blue-700 border-blue-200';
			case 'bouldering': return 'bg-orange-100 text-orange-700 border-orange-200';
			case 'multi-pitch': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
			case 'trad': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
			default: return 'bg-slate-100 text-slate-600 border-slate-200';
		}
	}

	function getGeometryCenter(geometry) {
		if (!geometry?.coordinates) return null;
		if (geometry.type === 'Point') return geometry.coordinates;

		const coordinates =
			geometry.type === 'Polygon'
				? geometry.coordinates?.[0]
				: geometry.type === 'MultiPolygon'
					? geometry.coordinates?.flatMap((polygon) => polygon[0])
					: geometry.coordinates;

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

	function openSector(event, sector) {
		event.preventDefault();
		const center = getGeometryCenter(sector.geometry);
		if (center) {
			window.dispatchEvent(
				new CustomEvent('crag-review:focus-map-target', {
					detail: { center, zoom: 18 }
				})
			);
		}
		goto(`${base}/map/crag/${data.basePath || path}/${sector.id}`);
	}
</script>

{#if fullscreenImage}
	<div class="absolute top-0 bottom-0 left-0 right-0 z-[30000] bg-black opacity-70"></div>
	<div
		onclick={() => (fullscreenImage = undefined)}
		class="absolute top-0 bottom-0 left-0 right-0 z-[30000] flex justify-center items-center"
	>
		<img
			class="self-center max-h-full max-w-full object-contain"
			src={fullscreenImage}
			alt="Fullscreen Crag"
		/>
	</div>
{/if}

<div
	class="fixed h-fit no-scrollbar overflow-x-auto sm:w-auto sm:left-26 left-0 right-0 py-2 top-2 sm:top-21 z-[1000]">
	<form action="/map/{searchTerm}">
		<div class="flex mx-4 sm:mx-8 sm:max-w-120 shadow-md rounded-full">
			<input bind:value={searchTerm}
						 class="block p-2.5 w-full z-20 text-sm bg-white rounded-l-full border-3 border-white focus:border-ink"
						 placeholder={$_('page.list.search_placeholder')} />
			<button type="submit"
							class="top-0 w-12 p-2.5 bg-white text-sm font-medium h-full border-3 border-white rounded-r-full hover:border-ink hover:bg-ink hover:text-white">
				<i class="fa-solid fa-magnifying-glass"></i>
				<span class="sr-only">Search</span>
			</button>
		</div>
	</form>
</div>

<main class="z-[500] h-24">
	<InfoPanel onShare={share}>
		<div
			class="justify-self-center sm:justify-self-start w-screen sm:w-auto px-5 pr-20 flex flex-row items-center pt-6 pb-5"
		>
			{#if activeSectorId}
				<a
					href="{base}/map/crag/{data.basePath || path}"
					class="mr-3 p-2 rounded-full hover:bg-gray-100 transition-colors"
					aria-label={$_('ui.back')}
				>
					<i class="fa-solid fa-arrow-left text-gray-600"></i>
				</a>
			{/if}
			<h1 class="text-2xl font-bold my-0 text-slate-800 sm:px-2">{displayTitle}</h1>
		</div>
		<div class="flex-1 overflow-y-auto w-full px-5 mb-4 overflow-x-hidden min-h-0">
			{#if images?.length === 1}
				<img
					onclick={() => (fullscreenImage = images[0])}
					class="mx-auto h-71 object-cover rounded-md cursor-pointer"
					src={images[0]}
					alt="Crag"
				/>
			{:else if images?.length >= 1}
				<div class="flex flex-col flex-wrap content-start h-73 overflow-x-auto no-scrollbar">
					{#each images as image, i}
						{#if i === 0}
							<img
								onclick={() => (fullscreenImage = image)}
								class="w-60 h-71 mr-1.5 mb-1.5 rounded-2xl object-cover cursor-pointer"
								src={image}
								alt="Crag"
							/>
						{:else}
							<img
								onclick={() => (fullscreenImage = image)}
								class="w-34.5 h-34.5 mr-1.5 mb-1.5 rounded-2xl object-cover cursor-pointer"
								src={image}
								alt="Crag"
							/>
						{/if}
					{/each}
				</div>
			{/if}
			<div class="flex flex-wrap gap-3 text-sm font-medium text-gray-700 mt-5 mb-6">
				{#if Array.isArray(type)}
					{#each type as t}
						<a
							href="{base}/map/{t}/"
							class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100 inline-flex items-center justify-center no-underline hover:bg-blue-100 transition-colors"
						>
							{$_('types.' + t)}
						</a>
					{/each}
				{:else}
					<a
						href="{base}/map/{type}/"
						class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100 inline-flex items-center justify-center no-underline hover:bg-blue-100 transition-colors"
					>
						{$_('types.' + type)}
					</a>
				{/if}
				{#if tags && tags.length > 0}
					{#each tags as tag}
						<span
							class="px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 text-sm font-medium border-blue-100"
						>
							{$_('tags.' + tag)}
						</span>
					{/each}
				{/if}
				{#if security && securityRatings.has(security)}
					<div class="flex items-center ml-2 mt-1" title="Absicherung">
						<span class="inline-block">
							{#each Array(securityRatings.get(security)).fill(0) as _, i}
								<i class="fa-solid fa-star text-yellow-400" title="Absicherung"></i>
							{/each}
							{#each Array(4 - securityRatings.get(security)).fill(0) as _, i}
								<i class="fa-regular fa-star text-gray-300" title="Absicherung"></i>
							{/each}
						</span>
					</div>
				{/if}
				{#if topoJson}
					<div
						class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200"
					>
						<i class="fa-solid fa-compass text-gray-500"></i>
						<span>{displayWallDirection}</span>
					</div>
					<div
						class="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100"
					>
						<i class="fa-solid fa-clock text-yellow-600"></i>
						<span>{displaySunHours}</span>
					</div>
				{/if}
			</div>

			{#if equipment}
				<div class="mt-3 mb-6 px-1">
					<h3 class="text-sm font-bold text-slate-700 mb-2">Ausrüstung:</h3>
					<ul class="list-none p-0 flex flex-wrap gap-x-6 gap-y-2">
						{#each equipment as item}
							<li class="text-sm text-slate-600 flex items-center">
								{#if equipmentIcons[item.name] && equipmentIcons[item.name].startsWith(base)}
									<img
										src={equipmentIcons[item.name]}
										alt={item.name}
										class="w-5 h-5 mr-2 object-contain"
									/>
								{:else}
									<i
										class="{equipmentIcons[item.name] ||
											'fa-solid fa-circle'} w-5 text-center mr-2 text-slate-500"
									></i>
								{/if}
								<span>
									{#if item.amount}{item.amount}x
									{/if}
									{item.name}
									{#if item.sizes}
										({item.sizes}){/if}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="flex items-center mt-6 mb-6">
				<div class="prose text-slate-800 w-full">
					<div class="mb-3 w-full">
						{#if has3DTopo || has2D}
							<div class="grid {has3DTopo && has2D ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-4">
								{#if has3DTopo}
									<a
										href="{base}/topo/crag/{topoPath}"
										class="relative group w-full h-24 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 no-underline bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-300 hover:-translate-y-1 hover:scale-[1.02] flex flex-col items-center justify-center overflow-hidden hover:ring-8 hover:ring-blue-500/5"
									>
										<div class="flex flex-row items-center gap-2 sm:gap-3 z-10 px-2">
											<div
												class="w-10 h-10 shrink-0 rounded-full bg-slate-100 shadow-inner flex items-center justify-center group-hover:bg-blue-50 group-hover:scale-110 transition-all duration-300"
											>
												<i class="fa-solid fa-cube text-xl text-blue-600"></i>
											</div>
											<div class="flex flex-col">
												<span
													class="font-bold text-base sm:text-lg text-slate-800 leading-tight group-hover:text-blue-700 transition-colors"
													>{$_('ui.topo_3d')}</span
												>
												<span class="text-xs sm:text-sm text-slate-500 font-medium"
													>{$_('ui.interactive_view')}</span
												>
											</div>
										</div>
									</a>
								{/if}
								{#if has2D}
									<a
										href="{base}/topo/crag/{topoPath}?mode=2d"
										class="relative group w-full h-24 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 no-underline bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:-translate-y-1 hover:scale-[1.02] flex flex-col items-center justify-center overflow-hidden hover:ring-8 hover:ring-emerald-500/5"
									>
										<div class="flex flex-row items-center gap-2 sm:gap-3 z-10 px-2">
											<div
												class="w-10 h-10 shrink-0 rounded-full bg-slate-100 shadow-inner flex items-center justify-center group-hover:bg-emerald-50 group-hover:scale-110 transition-all duration-300"
											>
												<i class="fa-solid fa-image text-xl text-emerald-600"></i>
											</div>
											<div class="flex flex-col">
												<span
													class="font-bold text-base sm:text-lg text-slate-800 leading-tight group-hover:text-emerald-700 transition-colors"
													>{$_('ui.topo_2d')}</span
												>
												<span class="text-xs sm:text-sm text-slate-500 font-medium"
													>{$_('ui.schematic_view')}</span
												>
											</div>
										</div>
									</a>
								{/if}
							</div>
						{/if}

						{#if topo && topo.link && topo.link.trim() !== ''}
							<a
								href={topo.link}
								target="_blank"
								class="border-1 border-gray-200 h-10 mb-2 mr-2 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-full no-underline"
							>
								<i class="fa-solid fa-route mr-2"></i>
								<span class="w-full">{$_('ui.topo')} (Ext)</span>
							</a>
						{/if}
						{#if transit}
							<div class="inline-flex mb-2 mr-2">
								<span
									class="border-1 border-gray-200 h-10 text-slate-600 inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-l-full no-underline"
									><i class="fa-solid fa-train"></i>
								</span>
								<a
									href="https://www.google.com/maps/dir/?api=1&destination={transit[1]},{transit[0]}&travelmode=transit"
									target="_blank"
									class="border-1 border-gray-200 h-10 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium no-underline"
								>
									{$_('ui.google_maps')}
								</a>
								<a
									href="https://fahrplan.oebb.at/webapp/?context=TP&ZID=A%3D1%40X%3D{Math.trunc(
										transit[0] * 1000000
									)}%40Y%3D{Math.trunc(
										transit[1] * 1000000
									)}&timeSel=1&returnTimeSel=1&journeyProducts=7167&start=1&#!P%7CTP!H%7C952087"
									target="_blank"
									class="border-1 border-gray-200 h-10 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium no-underline rounded-r-full"
								>
									{$_('ui.scotty')}
								</a>
							</div>
						{/if}
						{#if parking}
							<a
								href="https://www.google.com/maps/dir/?api=1&destination={parking[1]},{parking[0]}"
								target="_blank"
								class="border-1 border-gray-200 h-10 mb-2 mr-2 text-slate-600 hover:text-white hover:bg-ink inline-flex items-center justify-center p-1 px-3 text-base font-medium rounded-full no-underline"
							>
								<i class="fa-solid fa-car mr-2"></i>
								<span class="w-full">{$_('ui.google_maps')}</span>
							</a>
						{/if}
					</div>
					<span>{description}</span>

					{#if data.gradeRoutes?.length}
						<div class="h-40 w-full mt-5 mb-5 not-prose">
							<GradeChart routes={data.gradeRoutes} />
						</div>
					{/if}

					{#if sectors.length > 0 && !activeSectorId}
						<div class="w-full mt-8 mb-5">
							<h3 class="text-lg font-bold text-gray-800 mb-3 px-1">
								{$_('ui.sectors')} ({sectors.length})
							</h3>
							<div class="overflow-x-auto sm:rounded-xl border border-gray-200 shadow-sm bg-white">
								<table class="min-w-full divide-y divide-gray-200 !m-0">
									<thead class="bg-gray-50">
										<tr>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
											>
												{$_('topo.table.name')}
											</th>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
											>
												{$_('topo.routes')}
											</th>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
											>
												{$_('ui.tags')}
											</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each sectors as sector}
											<tr
												class="hover:bg-blue-50 cursor-pointer transition-colors {activeSectorId === sector.id ? 'bg-blue-50' : ''}"
												onclick={(event) => openSector(event, sector)}
												title={getSectorDescription(sector) || sector.name}
											>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
													<span>{sector.name}</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{#if getSectorRouteCount(sector) > 0}
														<div class="flex items-center gap-3">
															<span
																class="px-2 py-1 rounded-md bg-gray-100 font-bold text-gray-700 text-xs border border-gray-300"
															>
																{getSectorRouteCount(sector)}
															</span>
															<div class="flex h-2 w-16 bg-gray-200 rounded-full overflow-hidden shrink-0">
																{#each getSectorGradeDistribution(sector) as bucket}
																	<div class="h-full {bucket.colorClass}" style="width: {bucket.percent}%" title="{bucket.label}: {bucket.count}"></div>
																{/each}
															</div>
														</div>
													{:else}
														<span class="px-2 py-1 rounded-md bg-slate-50 text-slate-500 font-bold text-xs border border-slate-200">
															{$_('topo.no_topo')}
														</span>
													{/if}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{#if getSectorTypes(sector).length > 0 || getSectorDirection(sector)}
														<div class="flex items-center gap-2 flex-wrap">
															{#each getSectorTypes(sector) as type}
																<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border {getTypeColorClass(type.id)}">
																	{type.name}
																</span>
															{/each}
															{#if getSectorDirection(sector)}
																<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
																	<i class="fa-solid fa-compass text-slate-400"></i> {getSectorDirection(sector)}
																</span>
															{/if}
														</div>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</InfoPanel>
</main>
