<script>
import { base } from '$app/paths';
import { afterNavigate, goto } from '$app/navigation';
import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
import GradeChart from '$lib/components/charts/GradeChart.svelte';
import RouteList from '$lib/components/topo/RouteList.svelte';
import { calculateSunInfo, calculateWallDirection } from '$lib/assets/js/sun-calculations';
import { _, locale } from 'svelte-i18n';
import { securityRatings } from '$lib/config.js';
import { colors } from '$lib/colors.js';
import { getTypeColorClass } from '$lib/assets/js/route-types.js';
import TopoButton from '$lib/components/ui/TopoButton.svelte';
import CragValidationPrompt from '$lib/components/CragValidationPrompt.svelte';
import { getCragValidationIssue } from '$lib/assets/js/crag-validation.js';
import { felsstudioUrl } from '$lib/config.js';

let fullscreenImage = $state();
let sunInfo = $state({ hours: 'N/A' });
let wallDirection = $state('N/A');
let searchTerm = $state('');
let navigatingTo = $state(null);

afterNavigate(() => {
	navigatingTo = null;
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

let details = $state();

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
	Eisschrauben: `${base}/icons/ice-screw.png`,
	Eisgeräte: `${base}/icons/ice-axe.png`,
	Seil: 'fa-solid fa-infinity',
	Helm: 'fa-solid fa-hard-hat'
};

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
	const routes = details?.gradeRoutes?.filter((r) => r.sectorId === sector.id) || [];
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
	const routes = details?.gradeRoutes?.filter((r) => r.sectorId === sector.id) || [];
	if (routes.length === 0) return [];

	let easy = 0,
		medium = 0,
		hard = 0,
		veryHard = 0;
	routes.forEach((r) => {
		const g = r.grade || '';
		if (g.startsWith('3') || g.startsWith('4') || g.startsWith('5')) easy++;
		else if (g.startsWith('6')) medium++;
		else if (g.startsWith('7')) hard++;
		else if (g.startsWith('8') || g.startsWith('9')) veryHard++;
	});

	const total = easy + medium + hard + veryHard;
	if (total === 0) return [];

	return [
		{ count: easy, percent: (easy / total) * 100, colorClass: 'bg-green-500', label: '< 6a' },
		{
			count: medium,
			percent: (medium / total) * 100,
			colorClass: 'bg-yellow-400',
			label: '6a - 6c+'
		},
		{ count: hard, percent: (hard / total) * 100, colorClass: 'bg-red-500', label: '7a - 7c+' },
		{
			count: veryHard,
			percent: (veryHard / total) * 100,
			colorClass: 'bg-purple-600',
			label: '> 8a'
		}
	].filter((b) => b.count > 0);
}

function getConicGradient(buckets) {
	let gradient = [];
	let currentPercent = 0;
	const colorMap = {
		'bg-green-500': colors.chart.gradeGreen,
		'bg-yellow-400': colors.topo.gradeMedium,
		'bg-red-500': colors.chart.danger,
		'bg-purple-600': colors.chart.gradePurple
	};
	for (const bucket of buckets) {
		const nextPercent = currentPercent + bucket.percent;
		const color = colorMap[bucket.colorClass] || colors.topo.gradeUnknown;
		gradient.push(`${color} ${currentPercent}% ${nextPercent}%`);
		currentPercent = nextPercent;
	}
	return `conic-gradient(${gradient.join(', ')})`;
}

function getSectorDirection(sector) {
	const routes = details?.gradeRoutes?.filter((r) => r.sectorId === sector.id) || [];
	const mockTopo = {
		wallAzimuth:
			sector.wallAzimuth ||
			sector.topo?.wallAzimuth ||
			sector.properties?.wallAzimuth ||
			routes[0]?.sectorWallAzimuth,
		routes
	};
	const dir = calculateWallDirection(mockTopo, null);
	return dir !== 'Unknown' ? $_('directions.' + dir) : null;
}

function getSectorTypes(sector) {
	const routes = details?.gradeRoutes?.filter((r) => r.sectorId === sector.id) || [];
	let t = routes[0]?.sectorTags;
	if (!t || (Array.isArray(t) && t.length === 0)) t = sector.type;
	if (!t || (Array.isArray(t) && t.length === 0)) t = sector.properties?.type;
	if (!t || (Array.isArray(t) && t.length === 0)) t = data.crag?.properties?.type || data.type;

	let arr = [];
	if (Array.isArray(t)) {
		arr = t;
	} else if (typeof t === 'string' && t.trim()) {
		arr = t.includes(',') ? t.split(',').map((x) => x.trim()) : [t];
	}

	return arr.map((x) => {
		const translated = $_('tags.' + x);
		return {
			id: x,
			name: translated === 'tags.' + x ? x : translated
		};
	});
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

{#if fullscreenImage}
	<div
		use:portal
		class="fixed top-0 right-0 bottom-0 left-0 z-[30000] flex items-center justify-center"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute top-0 right-0 bottom-0 left-0 bg-black opacity-70"
			onclick={() => (fullscreenImage = undefined)}
		></div>
		<img
			class="pointer-events-none relative max-h-full max-w-full object-contain"
			src={fullscreenImage}
			alt="Fullscreen Crag"
		/>
	</div>
{/if}

<main class="z-[500] flex h-full min-h-0 w-full flex-1 flex-col">
	<div
		class="flex w-screen flex-row items-center justify-self-center px-5 pt-6 pr-20 pb-5 sm:w-auto sm:justify-self-start"
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
		<div class="flex min-w-0 flex-col sm:px-2">
			<div
				class="relative z-20 mb-0.5 flex flex-wrap items-center text-[10px] font-medium tracking-wide sm:text-xs"
			>
				{#each breadcrumbParts as part, i}
					{@const subpath = breadcrumbParts.slice(0, i + 1).join('/')}
					<a
						href="{base}/list/{encodeURIComponent(subpath)}"
						class="-mx-0.5 rounded px-0.5 text-slate-500 transition-colors hover:text-slate-700 hover:underline focus:ring-2 focus:ring-slate-400 focus:outline-none"
					>
						{part}
					</a>
					{#if i < breadcrumbParts.length - 1}
						<i class="fa-solid fa-chevron-right mx-1.5 text-[8px] text-slate-300"></i>
					{/if}
				{/each}
			</div>
			<h1 class="my-0 text-2xl font-bold text-slate-800">{data.currentData?.properties?.name}</h1>
		</div>
	</div>
	<div class="mb-4 min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-5" overflow-y>
		{#if !details}
			<div class="flex animate-pulse flex-col space-y-4 pt-4">
				<div class="h-40 w-full rounded-2xl bg-gray-200"></div>
				<div class="h-4 w-5/6 rounded bg-gray-200"></div>
				<div class="h-4 w-3/4 rounded bg-gray-200"></div>
				<div class="h-4 w-1/2 rounded bg-gray-200"></div>
				<div class="mt-4 h-10 w-full rounded-full bg-gray-200"></div>
				<div class="h-10 w-full rounded-full bg-gray-200"></div>
			</div>
		{:else}
			<CragValidationPrompt
				issue={validationIssue}
				editorUrl={felsstudioUrl}
				returnTo={data.meta.url}
			/>
			{#if images?.length === 1}
				<button
					type="button"
					onclick={() => (fullscreenImage = images[0])}
					class="block h-71 w-full cursor-pointer border-0 bg-transparent p-0"
					aria-label="View crag image fullscreen"
				>
					<img class="h-full w-full rounded-2xl object-cover" src={images[0]} alt="Crag" />
				</button>
			{:else if images?.length >= 1}
				<div class="no-scrollbar flex h-73 flex-col flex-wrap content-start overflow-x-auto">
					{#each images as image, i}
						{#if i === 0}
							<button
								type="button"
								onclick={() => (fullscreenImage = image)}
								class="mr-1.5 mb-1.5 block h-71 w-60 cursor-pointer border-0 bg-transparent p-0"
								aria-label="View crag image {i + 1} fullscreen"
							>
								<img class="h-full w-full rounded-2xl object-cover" src={image} alt="Crag" />
							</button>
						{:else}
							<button
								type="button"
								onclick={() => (fullscreenImage = image)}
								class="mr-1.5 mb-1.5 block h-34.5 w-34.5 cursor-pointer border-0 bg-transparent p-0"
								aria-label="View crag image {i + 1} fullscreen"
							>
								<img class="h-full w-full rounded-2xl object-cover" src={image} alt="Crag" />
							</button>
						{/if}
					{/each}
				</div>
			{/if}
			<div class="mt-5 mb-6 flex flex-wrap gap-3 text-sm font-medium text-gray-700">
				{#each type as t}
					<a
						href="{base}/map/{t}/"
						class="inline-flex items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 no-underline transition-colors hover:bg-blue-100"
					>
						{$_('types.' + t)}
					</a>
				{/each}
				{#if tags && tags.length > 0}
					{#each tags as tag}
						<span
							class="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
						>
							{$_('tags.' + tag)}
						</span>
					{/each}
				{/if}
				{#if security && securityRatings.has(security)}
					<div class="mt-1 ml-2 flex items-center" title="Absicherung">
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
						class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5"
					>
						<i class="fa-solid fa-compass text-gray-500"></i>
						<span>{displayWallDirection}</span>
					</div>
					<div
						class="flex items-center gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-1.5"
					>
						<i class="fa-solid fa-clock text-yellow-600"></i>
						<span>{displaySunHours}</span>
					</div>
				{/if}
			</div>

			{#if equipment}
				<div class="mt-3 mb-6 px-1">
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
									<i
										class="{equipmentIcons[item.name] ||
											'fa-solid fa-circle'} mr-2 w-5 text-center text-slate-500"
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

			<div class="mt-6 mb-6 flex items-center">
				<div class="prose w-full text-slate-800">
					<div class="mb-3 w-full">
						{#if has3DTopo || has2DTopo}
							<div class="grid {has3DTopo && has2DTopo ? 'grid-cols-2' : 'grid-cols-1'} mb-4 gap-3">
								{#if has3DTopo}
									<TopoButton mode="3d" path={data.currentLocation._getPath()}></TopoButton>
								{/if}
								{#if has2DTopo}
									<TopoButton mode="2d" path={data.currentLocation._getPath()}></TopoButton>
								{/if}
							</div>
						{/if}

						<div class="mt-2 mb-6 flex flex-wrap items-center gap-3">
							{#if topo && topo.link && topo.link.trim() !== ''}
								<a
									href={topo.link}
									target="_blank"
									class="group inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline shadow-sm ring-1 ring-slate-200 transition-all ring-inset hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md"
								>
									<i
										class="fa-solid fa-route text-slate-400 transition-colors group-hover:text-blue-500"
									></i>
									<span>{$_('ui.topo')} (Ext)</span>
								</a>
							{/if}
							{#if transit}
								<div
									class="inline-flex items-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition-all ring-inset hover:-translate-y-0.5 hover:shadow-md"
								>
									<span
										class="flex items-center rounded-l-xl border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500"
									>
										<i class="fa-solid fa-train"></i>
									</span>
									<a
										href="https://www.google.com/maps/dir/?api=1&destination={transit[1]},{transit[0]}&travelmode=transit"
										target="_blank"
										class="border-r border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-50 hover:text-blue-600"
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
										class="rounded-r-xl px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-50 hover:text-red-600"
									>
										{$_('ui.scotty')}
									</a>
								</div>
							{/if}
							{#if parking}
								<a
									href="https://www.google.com/maps/dir/?api=1&destination={parking[1]},{parking[0]}"
									target="_blank"
									class="group inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline shadow-sm ring-1 ring-slate-200 transition-all ring-inset hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md"
								>
									<i
										class="fa-solid fa-car text-slate-400 transition-colors group-hover:text-emerald-600"
									></i>
									<span>{$_('ui.google_maps')}</span>
								</a>
							{/if}
						</div>
					</div>
					<span>{description}</span>

					{#if gradeRoutes?.length}
						{#if gradeRoutes.length < 8}
							<div class="not-prose mt-5 mb-5 w-full">
								<RouteList routes={gradeRoutes} />
							</div>
						{:else}
							<div class="not-prose mt-5 mb-5 h-40 w-full">
								<GradeChart routes={gradeRoutes} />
							</div>
						{/if}
					{/if}

					{#if sectors.length > 0 && !activeSectorId}
						<div class="mt-8 mb-5 w-full">
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
