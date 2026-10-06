<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import GradeChart from '$lib/components/charts/GradeChart.svelte';
	import SunChart from '$lib/components/charts/SunChart.svelte';
	import BestSeasonChart from '$lib/components/charts/BestSeasonChart.svelte';
	import RouteList from '$lib/components/topo/RouteList.svelte';
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
	import { getAccessTracks } from '$lib/assets/js/route-gpx.js';
	import { hardestRouteGrade } from '$lib/assets/js/route-summary';

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
	let breadcrumbsAtEnd = $state(true);
	let isScrolled = $state(false);

	function checkBreadcrumbScroll() {
		if (breadcrumbScrollContainer) {
			const { scrollLeft, scrollWidth, clientWidth } = breadcrumbScrollContainer;
			breadcrumbsAtEnd = Math.ceil(scrollWidth - clientWidth - scrollLeft) <= 5;
		}
	}

	$effect(() => {
		// Re-evaluate on data changes
		data;
		setTimeout(checkBreadcrumbScroll, 50);

		const handleResize = () => checkBreadcrumbScroll();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
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

	$effect(() => {
		if (details?.topoJson) {
			sunInfo = calculateSunInfo(details.topoJson);
			wallDirection = calculateWallDirection(details.topoJson);
			seasonChartData = calculateBestSeason(details.topoJson, null);
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
	let trackRoutes = $derived((gradeRoutes || []).filter((route) => route.downloadTracks?.length));
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
		if (routes.length === 0) return [];

		let easy = 0,
			medium = 0,
			hard = 0,
			veryHard = 0;
		routes.forEach((r) => {
			const g = hardestRouteGrade(r)?.standardizedValue ?? '';
			if (g.startsWith('3') || g.startsWith('4') || g.startsWith('5')) easy++;
			else if (g.startsWith('6')) medium++;
			else if (g.startsWith('7')) hard++;
			else if (g.startsWith('8') || g.startsWith('9')) veryHard++;
		});

		const total = easy + medium + hard + veryHard;
		if (total === 0) return [];

		return [
			{ count: easy, percent: (easy / total) * 100, colorClass: '#4ade80', label: '< 6a' },
			{ count: medium, percent: (medium / total) * 100, colorClass: '#facc15', label: '6a - 6c+' },
			{ count: hard, percent: (hard / total) * 100, colorClass: '#f97316', label: '7a - 7c+' },
			{ count: veryHard, percent: (veryHard / total) * 100, colorClass: '#d946ef', label: '> 8a' }
		].filter((b) => b.count > 0);
	}

	function getConicGradient(distribution: ReturnType<typeof getSectorGradeDistribution>) {
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

	/** @param {import("$lib/types/files").FelsLocation} sector */
	function getSectorDirection(sector: import('$lib/types/files').FelsLocation) {
		const topo = details?.sectorTopos.find(
			(item) => item.sectorId === sector.entry.properties.id
		)?.topo;
		if (!topo) return null;
		const direction = calculateWallDirection(topo);
		return direction === 'Unknown' ? null : $_('directions.' + direction);
	}

	/** @param {import("$lib/types/files").FelsLocation} sector */
	function getSectorTypes(sector: import('$lib/types/files').FelsLocation) {
		return (sector.entry.properties.type ?? []).map((id) => {
			const translated = $_('tags.' + id);
			return { id, name: translated === 'tags.' + id ? id : translated };
		});
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
		class="header-dynamic flex w-screen flex-row items-center justify-self-center px-6 pr-20 pb-2 transition-colors duration-300 sm:w-auto sm:justify-self-start {isScrolled
			? 'border-b border-gray-200 bg-white shadow-sm'
			: ''}"
	>
		<div class="flex max-w-full min-w-0 flex-col">
			<div
				class="breadcrumb-dynamic relative z-20 w-full {breadcrumbsAtEnd ? '' : 'breadcrumb-mask'}"
			>
				<div
					bind:this={breadcrumbScrollContainer}
					onscroll={checkBreadcrumbScroll}
					class="no-scrollbar flex items-center overflow-x-auto pr-6 text-[10px] font-medium tracking-wide sm:text-xs"
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
							<i class="fa-solid fa-chevron-right mx-1.5 shrink-0 text-[8px] text-slate-300"></i>
						{/if}
					{/each}
				</div>
			</div>
			<h1 class="title-dynamic my-0 font-bold text-slate-800">
				{data.currentData?.properties?.name}
			</h1>
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
									{$_('tags.' + tag)}
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

			<CragValidationPrompt
				issue={validationIssue}
				editorUrl={felsstudioUrl}
				returnTo={data.meta.url}
			/>

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
						{#if gradeRoutes.length < 8}
							<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
								<RouteList routes={gradeRoutes} fallbackAccessTracks={accessTracks} />
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
						{#if gradeRoutes.length >= 8 && trackRoutes.length}
							<div class="not-prose mt-5 mb-5 w-full sm:mt-8 sm:mb-8">
								<RouteList routes={trackRoutes} fallbackAccessTracks={accessTracks} />
							</div>
						{/if}
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
				class="no-scrollbar mt-1 flex items-center overflow-x-auto pb-1 text-[10px] font-medium tracking-wide sm:text-xs"
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
						<i class="fa-solid fa-chevron-right mx-1.5 shrink-0 text-[8px] text-slate-300"></i>
					{/if}
				{/each}
			</div>
			{#if has3DTopo || has2DTopo || (topo && topo.link && topo.link.trim() !== '') || transit || parking}
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

		.header-dynamic {
			padding-top: calc(0.75rem - (var(--info-panel-high-progress, 0) * 0.25rem));
		}

		.breadcrumb-dynamic {
			max-height: calc((1 - var(--info-panel-high-progress, 0)) * 32px);
			opacity: calc(1 - var(--info-panel-high-progress, 0));
			margin-bottom: calc((1 - var(--info-panel-high-progress, 0)) * 0.125rem);
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
			max-height: 32px;
			opacity: 1;
			margin-bottom: 0.125rem;
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
