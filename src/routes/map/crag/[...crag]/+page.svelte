<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import GradeChart from '$lib/components/charts/GradeChart.svelte';
	import SunChart from '$lib/components/charts/SunChart.svelte';
	import BestSeasonChart from '$lib/components/charts/BestSeasonChart.svelte';
	import {
		calculateBestSeason,
		calculateSunInfo,
		calculateWallDirection
	} from '$lib/assets/js/sun-calculations';
	import { _, locale } from 'svelte-i18n';
	import { felsstudioUrl } from '$lib/config.js';
	import { getGeometryCenter } from '$lib/assets/js/topo-loader-utils.js';
	import { getTypeColor, getTypeColorClass } from '$lib/assets/js/route-types.js';
	import TopoButton from '$lib/components/ui/TopoButton.svelte';
	import CragValidationPrompt from '$lib/components/CragValidationPrompt.svelte';
	import { getCragValidationIssue } from '$lib/assets/js/crag-validation.js';
	import ImageViewer from '$lib/components/ui/ImageViewer.svelte';
	import RouteGpxDownload from '$lib/components/topo/RouteGpxDownload.svelte';
	import RouteList from '$lib/components/topo/RouteList.svelte';
	import RouteDetail from '$lib/components/topo/RouteDetail.svelte';
	import { getAccessTracks, getRouteTracks } from '$lib/assets/js/route-gpx.js';
	import {
		getParentRoute,
		getPitchDisplayName,
		getRouteDisplayName
	} from '$lib/assets/js/topo-loader-utils.js';
	import { getGradeColor, getGradeDistribution } from '$lib/assets/js/grades.js';
	import type { Route } from '@vorstieg/fels-types/types';
	import type { SteepnessMetrics } from '$lib/types/application';
	import { navigating } from '$app/stores';

	let fullscreenImageIndex = $state(-1);
	let sunInfo = $state<import('$lib/types/application').SunInfo>({ hours: 'N/A', chartData: null });
	let seasonChartData = $state<import('$lib/types/application').SeasonData>(null);
	let hasSeasonData = $derived(
		seasonChartData?.labels.some(
			(_, index) =>
				Number.isFinite(seasonChartData?.baseTemps[index]) &&
				Number.isFinite(seasonChartData?.feelsLikeTemps[index])
		)
	);
	let wallDirection = $state('N/A');
	let breadcrumbScrollContainer = $state<HTMLDivElement>();
	let breadcrumbsAtStart = $state(true);
	let breadcrumbsAtEnd = $state(true);
	let isScrolled = $state(false);

	function checkBreadcrumbScroll() {
		if (breadcrumbScrollContainer) {
			const { scrollLeft, scrollWidth, clientWidth } = breadcrumbScrollContainer;
			const maxScroll = Math.max(0, scrollWidth - clientWidth);
			breadcrumbsAtStart = scrollLeft <= 5;
			breadcrumbsAtEnd = maxScroll - scrollLeft <= 5;
		}
	}

	function scrollToRight() {
		if (breadcrumbScrollContainer) {
			breadcrumbScrollContainer.scrollLeft = breadcrumbScrollContainer.scrollWidth;
			checkBreadcrumbScroll();
		}
	}

	$effect(() => {
		// By default always scrolled to the right
		data;
		scrollToRight();
		requestAnimationFrame(scrollToRight);
		const timer = setTimeout(scrollToRight, 60);

		const handleResize = () => checkBreadcrumbScroll();
		window.addEventListener('resize', handleResize);

		const container = breadcrumbScrollContainer;
		const handleWheel = (event: WheelEvent) => {
			if (!container) return;
			const canScroll = container.scrollWidth > container.clientWidth;
			if (canScroll && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
				event.preventDefault();
				container.scrollLeft += event.deltaY;
				checkBreadcrumbScroll();
			}
		};
		container?.addEventListener('wheel', handleWheel, { passive: false });

		return () => {
			clearTimeout(timer);
			window.removeEventListener('resize', handleResize);
			container?.removeEventListener('wheel', handleWheel);
		};
	});

	let breadcrumbMaskClass = $derived.by(() => {
		if (breadcrumbsAtStart && breadcrumbsAtEnd) return '';
		if (!breadcrumbsAtStart && !breadcrumbsAtEnd) return 'breadcrumb-mask-both';
		if (!breadcrumbsAtStart) return 'breadcrumb-mask-left';
		return 'breadcrumb-mask-right';
	});

	let { data }: { data: import('./$types').PageData } = $props();
	let description = $derived(
		$locale === 'de' ? data.description_de : data.description_en || data.description_de
	);
	let sectors = $derived(data.sectors);
	let activeSectorId = $derived(
		data.currentData.properties.kind === 'sector' ? data.currentData.properties.id : null
	);
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

	let details = $state<Awaited<import('./$types').PageData['streamed']['details']> | null>(null);

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

	let routeMetrics = $state<SteepnessMetrics | null>(null);
	function handleMetrics(event: CustomEvent<SteepnessMetrics>) {
		routeMetrics = event.detail;
	}

	let activeRouteId = $derived(data.route?.id ?? null);
	let pendingRouteId = $derived.by(() => {
		const toPath = $navigating?.to?.url?.pathname;
		if (toPath && toPath.startsWith(`${base}/map/crag/`)) {
			const parts = toPath.split('/');
			return parts[parts.length - 1];
		}
		return null;
	});

	let activeTopo = $derived(details?.topoJson ?? data.topo);
	let referencedTracks = $derived(
		data.route
			? getRouteTracks(activeTopo, getParentRoute(activeTopo?.routes, data.route.id) || data.route)
			: []
	);

	let routeTopoPath = $derived(
		data.route ? `${data.cragPathUrl}/${data.route.id}` : data.cragPathUrl
	);

	let parentRoute = $derived(
		data.route ? getParentRoute(activeTopo?.routes, data.route.id) : null
	);
	let routeDisplayName = $derived(
		data.route ? getRouteDisplayName(data.route, parentRoute, $_) : ''
	);
	let displayRoute = $derived(
		data.route ? { ...data.route, name: routeDisplayName } : null
	);
	let displayPitches = $derived(
		(data.route?.pitches ?? []).map((pitch, idx) => ({
			...pitch,
			name: getPitchDisplayName(pitch, idx, $_)
		}))
	);

	function handleRouteSelect(route: Route) {
		const sectorId =
			'sectorId' in route ? (route as import('$lib/types/application').RouteSummary).sectorId : null;
		const sector = sectorId ? sectors.find((s) => s.entry.properties.id === sectorId) : null;
		const targetPath = sector ? sector.path : data.cragPathUrl;
		goto(`${base}/map/crag/${targetPath}/${route.id}`);
	}

	$effect(() => {
		const topoToUse = details?.topoJson ?? data.topo;
		if (topoToUse) {
			sunInfo = calculateSunInfo(topoToUse, data.route ?? null);
			wallDirection = calculateWallDirection(topoToUse, data.route ?? null);
			seasonChartData = calculateBestSeason(topoToUse, data.route ?? null);
		} else {
			sunInfo = { hours: 'N/A', chartData: null };
			wallDirection = 'N/A';
			seasonChartData = null;
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
	let accessTracks = $derived(getAccessTracks(data.access));
	let fallbackAccessTracks = $derived(accessTracks);

	let has2DTopo = $derived(details?.has2DTopo);
	let tags = $derived(data.currentData?.properties?.tags?.filter((tag) => tag != null));
	let equipment = $derived(data.currentData.properties.equipment);
	let images = $derived(details?.images);
	let validationIssue = $derived.by(() =>
		details && ['crag', 'sector'].includes(data.currentData.properties.kind)
			? getCragValidationIssue({
					crag: activeSectorId ? (data.parentEntry?.entry ?? data.cragData) : data.cragData,
					sectors: data.sectors,
					current: data.currentData,
					access: details.access,
					topo: details.topoJson,
					sectorTopos: details.sectorTopos,
					has3DTopo: details.has3DTopo,
					has2DTopo: details.has2DTopo,
					images: details.images,
					cragPath: activeSectorId ? data.currentLocation.path : data.cragPathUrl,
					sectorId: activeSectorId
				})
			: null
	);

	const equipmentIcons: Record<string, string> = {
		Expressschlingen: `${base}/icons/quickdraw.png`,
		Friends: `${base}/icons/friend.png`,
		Keile: `${base}/icons/nut.png`,
		Bohrhaken: `${base}/icons/bolt.png`,
		Sicherung: `${base}/icons/belay.png`
	};

	/** @param {import("$lib/types/files").FelsLocation} sector */
	function getSectorRouteCount(sector: import('$lib/types/files').FelsLocation) {
		return (gradeRoutes ?? []).filter((route) => route.sectorId === sector.entry.properties.id)
			.length;
	}

	function getSectorGradeDistribution(sector: import('$lib/types/files').FelsLocation) {
		if (!gradeRoutes) return [];
		const routes = gradeRoutes.filter((r) => r.sectorId === sector.entry.properties.id);
		return getGradeDistribution(routes);
	}

	function getConicGradient(distribution: ReturnType<typeof getSectorGradeDistribution>) {
		if (distribution.length === 0) return 'transparent';
		if (distribution.length === 1) return distribution[0].color;

		let gradient = 'conic-gradient(';
		let currentPercent = 0;

		distribution.forEach((bucket, index) => {
			const start = currentPercent;
			const end = currentPercent + bucket.percent;
			gradient += `${bucket.color} ${start}% ${end}%`;
			if (index < distribution.length - 1) gradient += ', ';
			currentPercent = end;
		});

		return gradient + ')';
	}

	/** @param {import("$lib/types/files").FelsLocation} sector */
	function getSectorDirection(sector: import('$lib/types/files').FelsLocation) {
		const topo = details?.sectorTopos.find(
			(item) => item.sectorId === sector.entry.properties.id
		)?.topo;
		if (!topo) return null;
		const direction = calculateWallDirection(topo);
		return direction === 'Unknown' ? null : $_('directions.' + direction);
	}

	function getTagLabel(tag: string) {
		const translated = $_('tags.' + tag);
		return translated === 'tags.' + tag ? tag : translated;
	}

	/** @param {import("$lib/types/files").FelsLocation} sector */
	function getSectorTypes(sector: import('$lib/types/files').FelsLocation) {
		return (sector.entry.properties.type ?? []).map((id) => ({
			id,
			name: getTagLabel(id)
		}));
	}

	/** @param {import("$lib/types/files").FelsLocation} sector */
	function getSectorDescription(sector: import('$lib/types/files').FelsLocation) {
		const properties = sector.entry.properties;
		return (
			($locale === 'de'
				? properties.description_de
				: (properties.description_en ?? properties.description_de)) ?? ''
		);
	}

	function openSector(event: MouseEvent, sector: import('$lib/types/files').FelsLocation) {
		event.preventDefault();
		const center = getGeometryCenter(sector.entry.geometry);
		if (center) {
			window.dispatchEvent(
				new CustomEvent('crag-review:focus-map-target', {
					detail: { center, zoom: 18 }
				})
			);
		}
		goto(`${base}/map/crag/${sector.path}`);
	}
</script>

{#if fullscreenImageIndex !== -1}
	<ImageViewer
		{images}
		startIndex={fullscreenImageIndex}
		onClose={() => (fullscreenImageIndex = -1)}
	/>
{/if}

<main class="z-[500] flex h-full min-h-0 w-full flex-1 flex-col">
	<div
		class="header-dynamic flex w-screen flex-row items-center justify-self-center px-6 pr-24 pb-2 transition-colors duration-300 sm:w-auto sm:justify-self-start sm:pr-28 {isScrolled
			? 'border-b border-gray-200 bg-white shadow-sm'
			: ''}"
	>
		<div class="flex max-w-full min-w-0 flex-1 flex-col">
			<div
				class="breadcrumb-dynamic relative z-20 w-full mr-2 sm:mr-3 {breadcrumbMaskClass}"
			>
				<div
					bind:this={breadcrumbScrollContainer}
					onscroll={checkBreadcrumbScroll}
					class="no-scrollbar flex items-center gap-1 overflow-x-auto pl-1 pr-3 py-0.5 text-xs font-medium tracking-wide sm:text-sm sm:pr-4"
				>
					{#each breadcrumbParts as part, i}
						{@const subpath = breadcrumbParts.slice(0, i + 1).join('/')}
						{@const isLastCragPart = i === breadcrumbParts.length - 1}
						<a
							href={isLastCragPart && data.route
								? `${base}/map/crag/${data.cragPathUrl}`
								: `${base}/map/${encodeURIComponent(subpath)}`}
							class="shrink-0 rounded-md px-2 py-0.5 transition-all sm:px-2.5 sm:py-1 no-underline {isLastCragPart && !data.route
								? 'bg-slate-200/80 font-bold text-slate-800'
								: 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 active:scale-95'}"
						>
							{isLastCragPart && data.currentData?.properties?.name
								? data.currentData.properties.name
								: part}
						</a>
						{#if i < breadcrumbParts.length - 1 || data.route}
							<i class="fa-solid fa-chevron-right shrink-0 text-[8px] text-slate-300 sm:text-[10px]"></i>
						{/if}
					{/each}
					{#if data.route}
						<span
							class="shrink-0 rounded-md bg-slate-200/80 px-2 py-0.5 font-bold text-slate-800 sm:px-2.5 sm:py-1"
							aria-current="page"
						>
							{routeDisplayName || data.route.id}
						</span>
					{/if}
				</div>
			</div>
			<div class="flex items-center gap-3">
				<h1 class="title-dynamic my-0 truncate font-bold text-slate-800">
					{data.route ? routeDisplayName : data.currentData?.properties?.name}
				</h1>
				{#if data.route?.grade}
					<span
						class="shrink-0 rounded-md bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 shadow-sm sm:px-4 sm:text-sm"
						style="border-left: 5px solid {getGradeColor(data.route.grade)};"
					>
						{data.route.grade?.value ?? ''}
					</span>
				{/if}
				{#if displayRoute && referencedTracks.length}
					<RouteGpxDownload
						route={displayRoute}
						tracks={referencedTracks}
						{fallbackAccessTracks}
						class="sm:px-3 sm:text-sm"
					/>
				{/if}
			</div>
		</div>
	</div>
	<div
		class="mb-4 min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-6"
		overflow-y
		onscroll={(e) => (isScrolled = e.currentTarget.scrollTop > 10)}
	>
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
		{:else if displayRoute}
			<RouteDetail
				route={displayRoute}
				rockType={data.rockType}
				{wallDirection}
				{sunInfo}
				metrics={routeMetrics}
				onMetrics={handleMetrics}
			>
				{#snippet actions()}
					{#if has3DTopo || has2DTopo}
						<div
							class="buttons-inline no-scrollbar -mx-2 mt-1 mb-4 flex gap-3 overflow-x-auto px-2 pt-1 pb-2 sm:mt-4 sm:mb-6"
						>
							{#if has3DTopo}
								<div class="shrink-0">
									<TopoButton mode="3d" path={routeTopoPath} variant="compact" />
								</div>
							{/if}
							{#if has2DTopo}
								<div class="shrink-0">
									<TopoButton mode="2d" path={routeTopoPath} variant="compact" />
								</div>
							{/if}
						</div>
					{/if}
				{/snippet}

				{#if displayPitches.length}
					<div class="mt-4 mb-5">
						<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">
							{$_('topo.pitches', { default: 'Seillängen' })} ({displayPitches.length})
						</h3>
						<RouteList
							routes={displayPitches}
							title=""
							{activeRouteId}
							{pendingRouteId}
							onRouteSelect={(pitch: Route) => {
								goto(`${base}/map/crag/${data.cragPathUrl}/${pitch.id}`);
							}}
						/>
					</div>
				{/if}

				{#if hasSeasonData}
					<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
						<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">{$_('topo.seasonality')}</h3>
						<div class="mb-6 h-48 w-full">
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
			</RouteDetail>
		{:else}
			{#if (type?.length ?? 0) > 0 || (tags?.length ?? 0) > 0 || topoJson}
				<div class="dynamic-reveal flex flex-col gap-3 sm:mt-4 sm:mb-6">
					{#if (type?.length ?? 0) > 0}
						<div class="flex flex-wrap items-center gap-3 text-sm font-medium text-gray-700">
							{#each type as t}
								<a
									href="{base}/map/{t}/"
									class="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-white no-underline transition-all hover:scale-105"
									style="background-color: {getTypeColor(t) + 'd9'};"
								>
									{$_('types.' + t)}
								</a>
							{/each}
						</div>
					{/if}

					{#if (tags?.length ?? 0) > 0}
						<div class="flex flex-wrap items-center gap-3 text-sm font-medium text-gray-700">
							{#each tags as tag}
								<span
									class="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
									style="background-color: #64748bd9;"
								>
									{getTagLabel(tag)}
								</span>
							{/each}
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

			<div
				class="buttons-inline no-scrollbar -mx-2 mt-1 mb-4 flex gap-3 overflow-x-auto px-2 pt-1 pb-2 sm:mt-4 sm:mb-6"
			>
				{#if has3DTopo}
					<div class="shrink-0">
						<TopoButton mode="3d" path={$page.params.crag} variant="compact"></TopoButton>
					</div>
				{/if}
				{#if has2DTopo}
					<div class="shrink-0">
						<TopoButton mode="2d" path={$page.params.crag} variant="compact"></TopoButton>
					</div>
				{/if}
				{#if topo && topo.link && topo.link.trim() !== ''}
					<a
						href={topo.link}
						target="_blank"
						class="group hover:bg-ink inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold whitespace-nowrap text-gray-600 no-underline shadow-sm transition-all hover:text-white max-sm:h-11"
					>
						<i class="fa-solid fa-route"></i>
						<span>{$_('ui.topo')} (Ext)</span>
					</a>
				{/if}
				{#if transit}
					<div
						class="inline-flex h-10 shrink-0 items-center overflow-hidden rounded-full border border-gray-200 bg-white whitespace-nowrap shadow-sm transition-all max-sm:h-11"
					>
						<span
							class="flex h-full items-center justify-center border-r border-gray-200 bg-gray-50 px-3 text-gray-500"
						>
							<i class="fa-solid fa-train"></i>
						</span>
						<a
							href="https://www.google.com/maps/dir/?api=1&destination={transit[1]},{transit[0]}&travelmode=transit"
							target="_blank"
							class="hover:bg-ink flex h-full items-center border-r border-gray-200 px-4 text-sm font-semibold text-gray-600 no-underline transition-colors hover:text-white"
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
							class="hover:bg-ink flex h-full items-center px-4 text-sm font-semibold text-gray-600 no-underline transition-colors hover:text-white"
						>
							{$_('ui.scotty')}
						</a>
					</div>
				{/if}
				{#if parking}
					<a
						href="https://www.google.com/maps/dir/?api=1&destination={parking[1]},{parking[0]}"
						target="_blank"
						class="group hover:bg-ink inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold whitespace-nowrap text-gray-600 no-underline shadow-sm transition-all hover:text-white max-sm:h-11"
					>
						<i class="fa-solid fa-car"></i>
						<span>{$_('ui.google_maps')}</span>
					</a>
				{/if}
			</div>

			<CragValidationPrompt issue={validationIssue} editorUrl={felsstudioUrl} />

			<div class="dynamic-reveal-images sm:mb-8">
				{#if (images?.length ?? 0) > 0}
					<div class="no-scrollbar -mx-2 mb-4 flex gap-3 overflow-x-auto px-2 pb-2">
						{#each images as image, i}
							<button
								type="button"
								onclick={() => (fullscreenImageIndex = i)}
								class="block h-40 w-auto shrink-0 cursor-pointer border-0 bg-transparent p-0 transition-transform active:scale-95 sm:h-56"
								aria-label="View crag image {i + 1} fullscreen"
							>
								<img class="h-full w-auto rounded-xl object-cover" src={image} alt="Crag" />
							</button>
						{/each}
					</div>
				{/if}

				{#if equipment?.length}
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
			</div>

			<div class="mt-2 mb-6 flex items-center sm:mb-8">
				<div class="prose w-full text-slate-800">
					<span>{description}</span>

					{#if gradeRoutes?.length}
						<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
							<GradeChart
								routes={gradeRoutes}
								fallbackAccessTracks={accessTracks}
								{activeRouteId}
								{pendingRouteId}
								onRouteSelect={handleRouteSelect}
							/>
						</div>
					{/if}

					{#if hasSeasonData}
						<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
							<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">{$_('topo.seasonality')}</h3>
							<div class="mb-6 h-48 w-full">
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

					{#if sectors.length > 0}
						<div class="mt-8 mb-5 w-full sm:mt-12 sm:mb-8">
							<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">
								{$_(
									sectors.every((item) => item.entry.properties.kind === 'sector')
										? 'ui.sectors'
										: 'ui.locations'
								)} ({sectors.length})
							</h3>
							<div class="mt-4 flex flex-col gap-3">
								{#each sectors as sector}
									<button
										class="group flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98] {activeSectorId ===
										sector.entry.properties.id
											? 'border-blue-200 bg-blue-50/50'
											: ''}"
										onclick={(event) => openSector(event, sector)}
										title={getSectorDescription(sector) || sector.entry.properties.name}
									>
										<!-- Left: Grade distribution circle -->
										<div class="shrink-0">
											{#if getSectorRouteCount(sector) > 0}
												<div
													class="relative flex h-11 w-11 items-center justify-center rounded-full shadow-inner"
													style="background: {getConicGradient(getSectorGradeDistribution(sector))}"
												>
													<div
														class="absolute inset-0 m-auto flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm"
													>
														<span class="text-[11px] leading-none font-bold text-slate-700"
															>{getSectorRouteCount(sector)}</span
														>
													</div>
												</div>
											{:else}
												<div
													class="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50"
												>
													<i class="fa-solid fa-route text-slate-400"></i>
												</div>
											{/if}
										</div>

										<!-- Middle: Content -->
										<div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
											<div
												class="truncate text-[15px] leading-tight font-bold text-gray-900 transition-colors group-hover:text-blue-700"
											>
												{sector.entry.properties.name}
											</div>
											<div class="flex flex-wrap items-center gap-1.5">
												{#if getSectorRouteCount(sector) === 0}
													<span
														class="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-500"
													>
														{$_('topo.no_topo')}
													</span>
												{/if}
												{#if getSectorDirection(sector)}
													<div
														class="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-500 uppercase"
													>
														<i class="fa-regular fa-compass"></i>
														<span>{getSectorDirection(sector)}</span>
													</div>
												{/if}
												{#if getSectorTypes(sector).length > 0}
													{#each getSectorTypes(sector).slice(0, 3) as type}
														<span
															class="truncate rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase {getTypeColorClass(
																type.id
															)}"
														>
															{type.name}
														</span>
													{/each}
												{/if}
											</div>
										</div>

										<!-- Right: Chevron -->
										<div
											class="shrink-0 pl-1 text-slate-300 transition-colors group-hover:text-blue-500"
										>
											<i class="fa-solid fa-chevron-right text-sm"></i>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
	{#if data.currentData}
		<div class="buttons-footer shrink-0 border-t border-gray-200 bg-white/80 px-6 backdrop-blur-md">
			<div
				class="no-scrollbar mt-1 flex items-center gap-1 overflow-x-auto pb-1 text-xs font-medium tracking-wide"
			>
				{#each breadcrumbParts as part, i}
					{@const subpath = breadcrumbParts.slice(0, i + 1).join('/')}
					{@const isLastCragPart = i === breadcrumbParts.length - 1}
					<a
						href={isLastCragPart && data.route
							? `${base}/map/crag/${data.cragPathUrl}`
							: `${base}/map/${encodeURIComponent(subpath)}`}
						class="shrink-0 rounded-md px-2 py-0.5 transition-all no-underline {isLastCragPart && !data.route
							? 'bg-slate-200/80 font-bold text-slate-800'
							: 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 active:scale-95'}"
					>
						{isLastCragPart && data.currentData?.properties?.name
							? data.currentData.properties.name
							: part}
					</a>
					{#if i < breadcrumbParts.length - 1 || data.route}
						<i class="fa-solid fa-chevron-right shrink-0 text-[8px] text-slate-300"></i>
					{/if}
				{/each}
				{#if data.route}
					<span
						class="shrink-0 rounded-md bg-slate-200/80 px-2 py-0.5 font-bold text-slate-800"
						aria-current="page"
					>
						{data.route.name || data.route.id}
					</span>
				{/if}
			</div>
			{#if data.route}
				{#if has3DTopo || has2DTopo}
					<div class="no-scrollbar -mx-2 flex gap-3 overflow-x-auto px-2 pt-1 pb-1">
						{#if has3DTopo}
							<div class="shrink-0">
								<TopoButton mode="3d" path={routeTopoPath} variant="compact"></TopoButton>
							</div>
						{/if}
						{#if has2DTopo}
							<div class="shrink-0">
								<TopoButton mode="2d" path={routeTopoPath} variant="compact"></TopoButton>
							</div>
						{/if}
					</div>
				{/if}
			{:else if has3DTopo || has2DTopo || (topo && topo.link && topo.link.trim() !== '') || transit || parking}
				<div class="no-scrollbar -mx-2 flex gap-3 overflow-x-auto px-2 pt-1 pb-1">
					{#if has3DTopo}
						<div class="shrink-0">
							<TopoButton mode="3d" path={$page.params.crag} variant="compact"></TopoButton>
						</div>
					{/if}
					{#if has2DTopo}
						<div class="shrink-0">
							<TopoButton mode="2d" path={$page.params.crag} variant="compact"></TopoButton>
						</div>
					{/if}
					{#if topo && topo.link && topo.link.trim() !== ''}
						<a
							href={topo.link}
							target="_blank"
							class="group hover:bg-ink inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold whitespace-nowrap text-gray-600 no-underline shadow-sm transition-all hover:text-white max-sm:h-11"
						>
							<i class="fa-solid fa-route"></i>
							<span>{$_('ui.topo')} (Ext)</span>
						</a>
					{/if}
					{#if transit}
						<div
							class="inline-flex h-10 shrink-0 items-center overflow-hidden rounded-full border border-gray-200 bg-white whitespace-nowrap shadow-sm transition-all max-sm:h-11"
						>
							<span
								class="flex h-full items-center justify-center border-r border-gray-200 bg-gray-50 px-3 text-gray-500"
							>
								<i class="fa-solid fa-train"></i>
							</span>
							<a
								href="https://www.google.com/maps/dir/?api=1&destination={transit[1]},{transit[0]}&travelmode=transit"
								target="_blank"
								class="hover:bg-ink flex h-full items-center border-r border-gray-200 px-4 text-sm font-semibold text-gray-600 no-underline transition-colors hover:text-white"
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
								class="hover:bg-ink flex h-full items-center px-4 text-sm font-semibold text-gray-600 no-underline transition-colors hover:text-white"
							>
								{$_('ui.scotty')}
							</a>
						</div>
					{/if}
					{#if parking}
						<a
							href="https://www.google.com/maps/dir/?api=1&destination={parking[1]},{parking[0]}"
							target="_blank"
							class="group hover:bg-ink inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold whitespace-nowrap text-gray-600 no-underline shadow-sm transition-all hover:text-white max-sm:h-11"
						>
							<i class="fa-solid fa-car"></i>
							<span>{$_('ui.google_maps')}</span>
						</a>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</main>

<style>
	.breadcrumb-mask-left {
		mask-image: linear-gradient(to right, transparent 0, black 28px);
		-webkit-mask-image: linear-gradient(to right, transparent 0, black 28px);
	}

	.breadcrumb-mask-right {
		mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
		-webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
	}

	.breadcrumb-mask-both {
		mask-image: linear-gradient(to right, transparent 0, black 28px, black calc(100% - 28px), transparent 100%);
		-webkit-mask-image: linear-gradient(to right, transparent 0, black 28px, black calc(100% - 28px), transparent 100%);
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

		.header-dynamic {
			padding-top: calc(0.75rem - (var(--info-panel-high-progress, 0) * 0.25rem));
		}

		.breadcrumb-dynamic {
			max-height: calc((1 - var(--info-panel-high-progress, 0)) * 36px);
			opacity: calc(1 - var(--info-panel-high-progress, 0));
			margin-bottom: calc((1 - var(--info-panel-high-progress, 0)) * 0.25rem);
			overflow: hidden;
		}

		.title-dynamic {
			font-size: calc(1.5rem - (var(--info-panel-high-progress, 0) * 0.375rem));
			line-height: calc(2rem - (var(--info-panel-high-progress, 0) * 0.25rem));
		}

		.buttons-footer {
			max-height: calc(var(--info-panel-high-progress, 0) * 120px);
			opacity: var(--info-panel-high-progress, 0);
			padding-top: calc(var(--info-panel-high-progress, 0) * 0.75rem);
			padding-bottom: calc(var(--info-panel-high-progress, 0) * 0.75rem);
			border-top-color: rgba(229, 231, 235, var(--info-panel-high-progress, 0));
			overflow: hidden;
		}

		.buttons-inline {
			max-height: calc((1 - var(--info-panel-high-progress, 0)) * 100px);
			opacity: calc(1 - var(--info-panel-high-progress, 0));
			margin-top: calc((1 - var(--info-panel-high-progress, 0)) * 0.25rem) !important;
			margin-bottom: calc((1 - var(--info-panel-high-progress, 0)) * 1rem) !important;
			padding-top: calc((1 - var(--info-panel-high-progress, 0)) * 0.25rem) !important;
			padding-bottom: calc((1 - var(--info-panel-high-progress, 0)) * 0.5rem) !important;
			overflow-y: hidden;
			overflow-x: auto;
		}
	}

	@media (min-width: 640px) {
		.header-dynamic {
			padding-top: 1.5rem;
		}

		.breadcrumb-dynamic {
			max-height: 42px;
			opacity: 1;
			margin-bottom: 0.25rem;
		}

		.title-dynamic {
			font-size: 1.5rem;
			line-height: 2rem;
		}

		.buttons-footer {
			display: none;
		}
	}
</style>
