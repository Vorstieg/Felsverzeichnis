<script>
import { base } from '$app/paths';
import { page } from '$app/stores';
import { afterNavigate, goto } from '$app/navigation';
import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
import GradeChart from '$lib/components/charts/GradeChart.svelte';
import SunChart from '$lib/components/charts/SunChart.svelte';
import BestSeasonChart from '$lib/components/charts/BestSeasonChart.svelte';
import RouteList from '$lib/components/topo/RouteList.svelte';
import { calculateSunInfo, calculateWallDirection, calculateBestSeason } from '$lib/assets/js/sun-calculations';
import { _, locale } from 'svelte-i18n';
import { securityRatings } from '$lib/config.js';
import { colors } from '$lib/colors.js';
import { getTypeColorClass, getTypeSolidBadgeClass } from '$lib/assets/js/route-types.js';
import TopoButton from '$lib/components/ui/TopoButton.svelte';
import CragValidationPrompt from '$lib/components/CragValidationPrompt.svelte';
import { getCragValidationIssue } from '$lib/assets/js/crag-validation.js';
import { felsstudioUrl } from '$lib/config.js';
import ImageViewer from '$lib/components/ui/ImageViewer.svelte';

let fullscreenImageIndex = $state(-1);
let sunInfo = $state({ hours: 'N/A' });
let seasonChartData = $state(null);
let wallDirection = $state('N/A');
let searchTerm = $state('');
let navigatingTo = $state(null);
let breadcrumbScrollContainer = $state();
let breadcrumbsAtEnd = $state(true);

function checkBreadcrumbScroll() {
	if (breadcrumbScrollContainer) {
		const { scrollLeft, scrollWidth, clientWidth } = breadcrumbScrollContainer;
		breadcrumbsAtEnd = Math.ceil(scrollWidth - clientWidth - scrollLeft) <= 5;
	}
}

afterNavigate(() => {
	navigatingTo = null;
});

$effect(() => {
	// Re-evaluate on data changes
	const _data = data;
	setTimeout(checkBreadcrumbScroll, 50);
	
	const handleResize = () => checkBreadcrumbScroll();
	window.addEventListener('resize', handleResize);
	return () => window.removeEventListener('resize', handleResize);
});

/** @type {{data: any}} */
let { data } = $props();
let description = $derived(
	$locale === 'de' ? data.description_de : data.description_en || data.description_de
);
let sectors = $derived(data.cragData?.properties?.sectors || []);
let activeSectorId = $derived(data.currentLocation.sectorId);
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

let details = $state(null);

$effect(() => {
	const stream = data.streamed?.details;
	if (stream) {
		details = null;
		stream.then((res) => {
			if (data.streamed?.details === stream) {
				details = res;
			}
		});
	}
});

$effect(() => {
	if (details?.topoJson) {
		sunInfo = calculateSunInfo(details.topoJson);
		wallDirection = calculateWallDirection(details.topoJson);
		seasonChartData = calculateBestSeason(details.topoJson, null);
	}
});

let type = $derived(data.currentData?.properties?.type);
let topo = $derived(data.currentData?.properties?.topo);
let breadcrumbParts = $derived(data.currentLocation.getFolder().split('/').filter(Boolean));
let topoJson = $derived(details?.topoJson);
let transit = $derived(details?.transit);
let parking = $derived(details?.parking);
let has3DTopo = $derived(details?.has3DTopo);
let gradeRoutes = $derived(details?.gradeRoutes);
let has2DTopo = $derived(details?.has2DTopo);
let tags = $derived(data.currentData?.properties?.tags);
let security = $derived(data.currentData?.properties?.security);
let equipment = $derived(data.currentData?.properties?.equipament);
let images = $derived(details?.images);
let validationIssue = $derived.by(() =>
	details
		? getCragValidationIssue({
				crag: data.cragData,
				current: data.currentData,
				access: details.access,
				topo: details.topoJson,
				sectorTopos: details.sectorTopos,
				has3DTopo: details.has3DTopo,
				has2DTopo: details.has2DTopo,
				images: details.images,
				cragPath: data.cragPathUrl,
				sectorId: activeSectorId
			})
		: null
);

const equipmentIcons = {
	Expressschlingen: `${base}/icons/quickdraw.png`,
	Friends: `${base}/icons/friend.png`,
	Keile: `${base}/icons/nut.png`,
	Bohrhaken: `${base}/icons/bolt.png`,
	Sicherung: `${base}/icons/belay.png`
};

async function share() {
	await navigator.share({
		title: data.name,
		text: description,
		url: window.location.href
	});
}



function getSectorRouteCount(sector) {
	if (gradeRoutes?.length > 0) {
		const routesForSector = gradeRoutes.filter(r => r.sectorId === sector.id);
		if (routesForSector.length > 0) return routesForSector.length;
	}
	return (
		sector.routesCount ||
		sector.routeCount ||
		sector.routes?.length ||
		sector.assets?.routes?.length ||
		0
	);
}

function getSectorGradeDistribution(sector) {
	if (!gradeRoutes) return [];
	const routes = gradeRoutes.filter(r => r.sectorId === sector.id);
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
		{ count: easy, percent: (easy / total) * 100, colorClass: '#22c55e' },
		{ count: medium, percent: (medium / total) * 100, colorClass: '#facc15' },
		{ count: hard, percent: (hard / total) * 100, colorClass: '#ef4444' },
		{ count: veryHard, percent: (veryHard / total) * 100, colorClass: '#9333ea' }
	].filter(b => b.count > 0);
}

function getConicGradient(distribution) {
	if (distribution.length === 0) return 'transparent';
	if (distribution.length === 1) return distribution[0].colorClass;
	
	let gradient = 'conic-gradient(';
	let currentPercent = 0;
	
	distribution.forEach((bucket, index) => {
		const start = currentPercent;
		const end = currentPercent + bucket.percent;
		gradient += `${bucket.colorClass} ${start}% ${end}%`;
		if (index < distribution.length - 1) gradient += ', ';
		currentPercent = end;
	});
	
	return gradient + ')';
}

function getSectorDirection(sector) {
	const mockTopo = {
		wallAzimuth: sector.wallAzimuth || sector.topo?.wallAzimuth || sector.properties?.wallAzimuth || (gradeRoutes?.find(r => r.sectorId === sector.id)?.sectorWallAzimuth)
	};
	const dir = calculateWallDirection(mockTopo, null);
	return dir !== 'Unknown' ? $_('directions.' + dir) : null;
}

function getSectorTypes(sector) {
	const routes = gradeRoutes?.filter(r => r.sectorId === sector.id) || [];
	let t = routes[0]?.sectorTags;
	if (!t || (Array.isArray(t) && t.length === 0)) t = sector.type;
	if (!t || (Array.isArray(t) && t.length === 0)) t = sector.properties?.type;
	if (!t || (Array.isArray(t) && t.length === 0)) t = data.currentData?.properties?.type;

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

function getSectorDescription(sector) {
	const translations = sector.description || sector.properties?.description || {};
	return translations[$locale] || translations.de || translations.en || '';
}

function focusInput(node) {
	node.focus();
}

function clearSearch() {
	searchTerm = '';
}

function handleSearch(event) {
	if (event.key === 'Enter' && searchTerm.trim()) {
		if (activeSectorId) {
			goto(`${base}/map/crag/${data.cragPathUrl}/${activeSectorId}?q=${encodeURIComponent(searchTerm)}`);
		} else {
			goto(`${base}/map/crag/${data.cragPathUrl}?q=${encodeURIComponent(searchTerm)}`);
		}
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
	goto(`${base}/map/crag/${data.cragPathUrl}/${sector.id}`);
}

function closePanel() {
	goto(`${base}/map${window.location.hash}`);
}

function portal(node) {
	document.body.appendChild(node);
	return {
		destroy() {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		}
	};
}
</script>

{#if fullscreenImageIndex !== -1}
	<ImageViewer 
		images={images} 
		startIndex={fullscreenImageIndex} 
		onClose={() => fullscreenImageIndex = -1} 
	/>
{/if}

<main class="z-[500] flex h-full min-h-0 w-full flex-1 flex-col">
	<div
		class="flex w-screen flex-row items-center justify-self-center px-6 pt-3 pr-20 pb-2 sm:w-auto sm:justify-self-start sm:pt-6"
	>
		{#if activeSectorId}
			<a
				href="{base}/map/crag/{data.cragPathUrl}"
				class="mr-3 shrink-0 rounded-full p-2 transition-colors hover:bg-gray-100"
				aria-label={$_('ui.back_to_crag') || 'Back'}
			>
				<i class="fa-solid fa-arrow-left text-gray-600"></i>
			</a>
		{/if}
		<div class="flex min-w-0 flex-col max-w-full">
			<div class="relative z-20 mb-0.5 w-full {breadcrumbsAtEnd ? '' : 'breadcrumb-mask'}">
				<div
					bind:this={breadcrumbScrollContainer}
					onscroll={checkBreadcrumbScroll}
					class="flex items-center overflow-x-auto no-scrollbar text-[10px] font-medium tracking-wide sm:text-xs pr-6"
				>
					{#each breadcrumbParts as part, i}
						{@const subpath = breadcrumbParts.slice(0, i + 1).join('/')}
						<a
							href="{base}/map/{encodeURIComponent(subpath)}"
							class="-mx-0.5 shrink-0 rounded px-0.5 text-slate-500 transition-colors hover:text-slate-700 hover:underline focus:ring-2 focus:ring-slate-400 focus:outline-none"
						>
							{part}
						</a>
						{#if i < breadcrumbParts.length - 1}
							<i class="fa-solid fa-chevron-right shrink-0 mx-1.5 text-[8px] text-slate-300"></i>
						{/if}
					{/each}
				</div>
			</div>
			<h1 class="my-0 text-2xl font-bold text-slate-800">{data.currentData?.properties?.name}</h1>
		</div>
	</div>
	<div class="mb-4 min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-6" overflow-y>
		{#if !data.currentData}
			<div class="mt-4 animate-pulse">
				<div class="mb-4 h-6 w-1/3 rounded bg-gray-200"></div>
				<div class="mb-6 flex gap-2">
					<div class="h-8 w-16 rounded-full bg-gray-200"></div>
					<div class="h-8 w-20 rounded-full bg-gray-200"></div>
					<div class="h-8 w-24 rounded-full bg-gray-200"></div>
				</div>
				<div class="mb-2 h-4 w-full rounded bg-gray-200"></div>
				<div class="h-4 w-3/4 rounded bg-gray-200"></div>
				<div class="h-4 w-1/2 rounded bg-gray-200"></div>
				<div class="mt-4 h-10 w-full rounded-full bg-gray-200"></div>
				<div class="h-10 w-full rounded-full bg-gray-200"></div>
			</div>
		{:else}
			{#if type?.length > 0 || tags?.length > 0 || topoJson}
				<div class="dynamic-reveal flex flex-col gap-3 sm:mb-6 sm:mt-4">
					{#if type?.length > 0 || tags?.length > 0}
						<div class="flex flex-wrap items-center gap-3 text-sm font-medium text-gray-700">
							{#each type as t}
								<a
									href="{base}/map/{t}/"
									class="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-white no-underline transition-all hover:scale-105"
									style="background-color: {colors.routeTypes[t] ? colors.routeTypes[t] + 'd9' : '#64748bd9'};"
								>
									{$_('types.' + t)}
								</a>
							{/each}
							{#if tags && tags.length > 0}
								{#each tags as tag}
									<span
										class="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
										style="background-color: #64748bd9;"
									>
										{$_('tags.' + tag)}
									</span>
								{/each}
							{/if}
						</div>
					{/if}

					{#if topoJson && ((wallDirection !== 'N/A' && wallDirection !== 'Unknown') || (sunInfo.hours !== 'N/A' && sunInfo.hours !== 'Unknown' && sunInfo.hours !== 'no_geodata'))}
						<div class="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-700">
							{#if wallDirection !== 'N/A' && wallDirection !== 'Unknown'}
								<div class="flex items-center gap-1.5">
									<i class="fa-solid fa-compass"></i>
									<span>{displayWallDirection}</span>
								</div>
							{/if}
							{#if sunInfo.hours !== 'N/A' && sunInfo.hours !== 'Unknown' && sunInfo.hours !== 'no_geodata'}
								<div class="flex items-center gap-1.5">
									<i class="fa-solid fa-clock"></i>
									<span>{displaySunHours}</span>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<div class="mt-1 mb-4 flex overflow-x-auto gap-3 no-scrollbar pb-2 pt-1 -mx-2 px-2 sm:mt-4 sm:mb-6">
				{#if has3DTopo}
					<TopoButton mode="3d" path={$page.params.crag} variant="compact"></TopoButton>
				{/if}
				{#if has2DTopo}
					<TopoButton mode="2d" path={$page.params.crag} variant="compact"></TopoButton>
				{/if}
				{#if topo && topo.link && topo.link.trim() !== ''}
					<a
						href={topo.link}
						target="_blank"
						class="group inline-flex items-center justify-center gap-2 h-10 max-sm:h-11 rounded-full bg-white px-4 text-sm font-semibold text-gray-600 no-underline shadow-sm border border-gray-200 transition-all hover:bg-ink hover:text-white whitespace-nowrap"
					>
						<i class="fa-solid fa-route"></i>
						<span>{$_('ui.topo')} (Ext)</span>
					</a>
				{/if}
				{#if transit}
					<div class="inline-flex items-center rounded-full bg-white shadow-sm border border-gray-200 transition-all whitespace-nowrap h-10 max-sm:h-11 overflow-hidden shrink-0">
						<span class="flex items-center justify-center h-full px-3 text-gray-500 bg-gray-50 border-r border-gray-200">
							<i class="fa-solid fa-train"></i>
						</span>
						<a
							href="https://www.google.com/maps/dir/?api=1&destination={transit[1]},{transit[0]}&travelmode=transit"
							target="_blank"
							class="flex items-center h-full px-4 text-sm font-semibold text-gray-600 no-underline transition-colors hover:bg-ink hover:text-white border-r border-gray-200"
						>
							{$_('ui.google_maps')}
						</a>
						<a
							href="https://fahrplan.oebb.at/webapp/?context=TP&ZID=A%3D1%40X%3D{Math.trunc(transit[0] * 1000000)}%40Y%3D{Math.trunc(transit[1] * 1000000)}&timeSel=1&returnTimeSel=1&journeyProducts=7167&start=1&#!P%7CTP!H%7C952087"
							target="_blank"
							class="flex items-center h-full px-4 text-sm font-semibold text-gray-600 no-underline transition-colors hover:bg-ink hover:text-white"
						>
							{$_('ui.scotty')}
						</a>
					</div>
				{/if}
				{#if parking}
					<a
						href="https://www.google.com/maps/dir/?api=1&destination={parking[1]},{parking[0]}"
						target="_blank"
						class="group inline-flex items-center justify-center gap-2 h-10 max-sm:h-11 rounded-full bg-white px-4 text-sm font-semibold text-gray-600 no-underline shadow-sm border border-gray-200 transition-all hover:bg-ink hover:text-white whitespace-nowrap"
					>
						<i class="fa-solid fa-car"></i>
						<span>{$_('ui.google_maps')}</span>
					</a>
				{/if}
			</div>

			<CragValidationPrompt
				issue={validationIssue}
				editorUrl={felsstudioUrl}
				returnTo={data.meta.url}
			/>

			<div class="dynamic-reveal-images sm:mb-8">
				{#if images?.length > 0}
					<div class="flex overflow-x-auto gap-3 no-scrollbar pb-2 mb-4 -mx-2 px-2">
						{#each images as image, i}
							<button
								type="button"
								onclick={() => (fullscreenImageIndex = i)}
								class="shrink-0 block h-40 w-auto cursor-pointer border-0 bg-transparent p-0 transition-transform active:scale-95 sm:h-56"
								aria-label="View crag image {i + 1} fullscreen"
							>
								<img class="h-full w-auto rounded-xl object-cover" src={image} alt="Crag" />
							</button>
						{/each}
					</div>
				{/if}

				{#if equipment}
					<div class="mt-3 mb-6 px-1 sm:mt-6 sm:mb-8">
						<h3 class="mb-2 text-sm font-bold text-slate-700">Ausrüstung:</h3>
						<ul class="flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
							{#each equipment as item}
								<li class="flex items-center text-sm text-slate-600">
									{#if equipmentIcons[item.name] && equipmentIcons[item.name].startsWith(base)}
										<img
											src={equipmentIcons[item.name]}
											alt={item.name}
											class="mr-2 h-5 w-5 object-contain"
										/>
									{:else}
										<i class="{equipmentIcons[item.name] || 'fa-solid fa-circle'} mr-2 w-5 text-center text-slate-500"></i>
									{/if}
									<span>
										{#if item.amount}{item.amount}x {/if}
										{item.name}
										{#if item.sizes} ({item.sizes}){/if}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<div class="mt-2 mb-6 flex items-center sm:mb-8">
				<div class="prose w-full text-slate-800">
					<span>{description}</span>

					{#if gradeRoutes?.length}
						{#if gradeRoutes.length < 8}
							<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
								<RouteList routes={gradeRoutes} />
							</div>
						{:else}
							<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
								<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">
									{$_('topo.grade_distribution')}
								</h3>
								<div class="h-40 w-full sm:h-56">
									<GradeChart routes={gradeRoutes} />
								</div>
							</div>
						{/if}
					{/if}
					
					{#if seasonChartData}
						<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
							<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">{$_('topo.seasonality')}</h3>
							<div class="h-48 w-full mb-6">
								<BestSeasonChart data={seasonChartData} />
							</div>
						</div>
					{/if}
					
					{#if sunInfo.chartData}
						<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
							<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">{$_('topo.sun_course')}</h3>
							<div class="h-32 w-full">
								<SunChart data={sunInfo.chartData} />
							</div>
						</div>
					{/if}

					{#if sectors.length > 0 && !activeSectorId}
						<div class="mt-8 mb-5 w-full sm:mt-12 sm:mb-8">
							<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">
								{$_('ui.sectors')} ({sectors.length})
							</h3>
							<div
								class="mt-2 overflow-x-auto border border-gray-200 bg-white shadow-sm sm:rounded-xl"
							>
								<table class="!m-0 min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th
												scope="col"
												class="px-3 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase sm:px-6"
											>
												{$_('topo.table.name')}
											</th>
											<th
												scope="col"
												class="px-3 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase sm:px-6"
											>
												{$_('topo.routes')}
											</th>
											<th
												scope="col"
												class="px-3 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase sm:px-6"
											>
												{$_('ui.tags')}
											</th>
											<th scope="col" class="relative px-3 py-3 sm:px-6">
												<span class="sr-only">Go</span>
											</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-200 bg-white">
										{#each sectors as sector}
											<tr
												class="group cursor-pointer transition-colors hover:bg-gray-50 {activeSectorId === sector.id ? 'bg-blue-50/50' : ''}"
												onclick={(event) => openSector(event, sector)}
												title={getSectorDescription(sector) || sector.name}
											>
												<td
													class="px-3 py-3 align-middle text-sm font-bold whitespace-nowrap text-gray-900 transition-colors group-hover:text-blue-700 sm:px-6 sm:py-4"
												>
													{sector.name}
												</td>
												<td
													class="px-3 py-3 align-middle text-sm whitespace-nowrap text-gray-500 sm:px-6 sm:py-4"
												>
													{#if getSectorRouteCount(sector) > 0}
														<div class="flex items-center gap-2">
															<div
																class="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-inner"
																style="background: {getConicGradient(getSectorGradeDistribution(sector))}"
															>
																<div
																	class="absolute inset-0 m-auto h-3.5 w-3.5 rounded-full bg-white shadow-sm"
																></div>
															</div>
															<span class="text-xs font-bold text-slate-700"
																>{getSectorRouteCount(sector)}</span
															>
														</div>
													{:else}
														<span
															class="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500"
														>
															{$_('topo.no_topo')}
														</span>
													{/if}
												</td>
												<td
													class="px-3 py-3 align-middle text-sm whitespace-nowrap text-gray-500 sm:px-6 sm:py-4"
												>
													<div
														class="flex max-w-[150px] flex-wrap items-center gap-1.5 sm:max-w-none"
													>
														{#if getSectorDirection(sector)}
															<div
																class="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-500 uppercase sm:text-[10px]"
															>
																<i class="fa-regular fa-compass"></i>
																<span>{getSectorDirection(sector)}</span>
															</div>
														{/if}
														{#if getSectorTypes(sector).length > 0}
															{#each getSectorTypes(sector).slice(0, 2) as type}
																<span
																	class="truncate rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase sm:text-[10px] {getTypeColorClass(type.id)}"
																>
																	{type.name}
																</span>
															{/each}
														{/if}
													</div>
												</td>
												<td
													class="py-3 pr-3 text-right align-middle whitespace-nowrap sm:py-4 sm:pr-6"
												>
													<i
														class="fa-solid fa-chevron-right text-xs text-slate-300 transition-colors group-hover:text-blue-500 sm:text-sm"
													></i>
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
		{/if}
	</div>
</main>

<style>
	.breadcrumb-mask {
		mask-image: linear-gradient(to right, black 70%, transparent 90%);
		-webkit-mask-image: linear-gradient(to right, black 70%, transparent 90%);
	}

	@media (min-width: 640px) {
		.breadcrumb-mask {
			mask-image: linear-gradient(to right, black 85%, transparent 100%);
			-webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
		}
	}

	@media (max-width: 639px) {
		.dynamic-reveal {
			margin-top: clamp(0rem, calc((var(--info-panel-height-num, 0) - 210) * 0.01rem), 0.75rem);
			margin-bottom: clamp(0rem, calc((var(--info-panel-height-num, 0) - 210) * 0.01rem), 1rem);
			max-height: clamp(0px, calc((var(--info-panel-height-num, 0) - 210) * 1.5px), 1000px);
			opacity: clamp(0, calc((var(--info-panel-height-num, 0) - 250) / 120), 1);
			overflow: hidden;
		}
		.dynamic-reveal-images {
			max-height: clamp(0px, calc((var(--info-panel-height-num, 0) - 250) * 1.5px), 1000px);
			opacity: clamp(0, calc((var(--info-panel-height-num, 0) - 290) / 120), 1);
			overflow: hidden;
		}
	}
</style>
