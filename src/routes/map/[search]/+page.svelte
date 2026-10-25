<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import ListCard from '$lib/components/ListCard.svelte';
	import RouteCard from '$lib/components/RouteCard.svelte';
	import { types as allTypes } from '$lib/config';
	import { getDisciplineQuickFilters } from '$lib/assets/js/grades.js';
	import { filtersToParams, countActiveFilters } from '$lib/search/catalog-search';

	let { data }: { data: import('./$types').PageData } = $props();

	let activeTab = $state<'all' | 'crags' | 'routes'>('all');
	let locations = $derived(data.locations ?? []);
	let routes = $derived(data.routes ?? []);
	let totalHits = $derived(locations.length + routes.length);
	let effectiveTab = $derived<'all' | 'crags' | 'routes'>(
		(activeTab === 'crags' && locations.length === 0) ||
			(activeTab === 'routes' && routes.length === 0)
			? 'all'
			: activeTab
	);

	let activeTypes = $derived(data.filters?.types ?? []);
	let activeGMin = $derived(data.filters?.gradeMin);
	let activeGMax = $derived(data.filters?.gradeMax);
	let filterCount = $derived(countActiveFilters(data.urlFilters));

	let primaryType = $derived(
		activeTypes.length === 1
			? activeTypes[0]
			: data.search && allTypes.includes(data.search)
				? data.search
				: routes.length > 0 && routes.every((r) => r.types?.[0] === routes[0].types?.[0])
					? routes[0].types?.[0]
					: null
	);
	let gradeQuickFilters = $derived(getDisciplineQuickFilters(primaryType));

	function updateFilter(newFilters: Record<string, unknown>) {
		const merged = { ...data.urlFilters, ...newFilters };
		if (Array.isArray(merged.types) && merged.types.length === 0) delete merged.types;
		const params = filtersToParams(merged, new URLSearchParams());
		const qs = params.toString();
		goto(`${base}/map/${encodeURIComponent(data.search)}${qs ? `?${qs}` : ''}`);
	}

	function toggleGrade(min?: string, max?: string) {
		const isSame = activeGMin === min && activeGMax === max;
		updateFilter({
			gradeMin: isSame ? undefined : min,
			gradeMax: isSame ? undefined : max
		});
	}

	function clearFilters() {
		goto(`${base}/map/${encodeURIComponent(data.search)}`);
	}
</script>

<svelte:head>
	<title>{data.search} - {$_('site.title')}</title>
</svelte:head>

<main class="z-[500] flex h-full min-h-0 w-full flex-1 flex-col">
	<!-- Results Header -->
	<div class="px-5 pt-6 pb-2">
		<div class="flex items-center gap-2.5 pr-24 sm:pr-28">
			<h2 class="text-xl font-bold text-slate-800">
				{totalHits}
				{$_('ui.results', { default: 'Results' })}
			</h2>
			{#if filterCount > 0}
				<button
					type="button"
					onclick={clearFilters}
					class="inline-flex cursor-pointer items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95"
				>
					<i class="fa-solid fa-xmark mr-1 text-[10px]"></i>
					{$_('ui.clear_filters', { default: 'Clear filters' })}
				</button>
			{/if}
		</div>

		<!-- Tabs: All / Crags / Routes -->
		{#if locations.length > 0 && routes.length > 0}
			<div class="mt-3 flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
				<button
					type="button"
					class="flex-1 rounded-lg py-1.5 transition-all {effectiveTab === 'all'
						? 'bg-white text-slate-900 shadow-xs'
						: 'text-slate-500 hover:text-slate-800'}"
					onclick={() => (activeTab = 'all')}
				>
					{$_('ui.all', { default: 'All' })} ({totalHits})
				</button>
				<button
					type="button"
					class="flex-1 rounded-lg py-1.5 transition-all {effectiveTab === 'crags'
						? 'bg-white text-slate-900 shadow-xs'
						: 'text-slate-500 hover:text-slate-800'}"
					onclick={() => (activeTab = 'crags')}
				>
					<i class="fa-solid fa-mountain mr-1 text-[10px]"></i>
					{$_('ui.crags', { default: 'Crags' })} ({locations.length})
				</button>
				<button
					type="button"
					class="flex-1 rounded-lg py-1.5 transition-all {effectiveTab === 'routes'
						? 'bg-white text-slate-900 shadow-xs'
						: 'text-slate-500 hover:text-slate-800'}"
					onclick={() => (activeTab = 'routes')}
				>
					<i class="fa-solid fa-route mr-1 text-[10px]"></i>
					{$_('ui.routes', { default: 'Routes' })} ({routes.length})
				</button>
			</div>
		{/if}

		<!-- Grade range chips -->
		<div class="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
			<span class="mr-1 shrink-0 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
				{$_('ui.grades', { default: 'Grade' })}:
			</span>
			{#each gradeQuickFilters as gf}
				{@const active = activeGMin === gf.min && activeGMax === gf.max}
				<button
					type="button"
					onclick={() => toggleGrade(gf.min, gf.max)}
					class="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-all {active
						? 'bg-ink text-white shadow-xs'
						: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
				>
					{gf.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Results List Content -->
	<div class="mb-4 min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-5 pb-24">
		{#if totalHits === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center text-slate-500">
				<div
					class="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"
				>
					<i class="fa-solid fa-magnifying-glass text-xl"></i>
				</div>
				<h3 class="mt-4 text-base font-bold text-slate-800">
					{$_('ui.no_results_found', { default: 'No matching crags or routes found' })}
				</h3>
				<p class="mt-1 max-w-xs text-xs text-slate-400">
					{$_('ui.no_results_hint', {
						default: 'Try different search keywords or remove applied filters.'
					})}
				</p>
				{#if filterCount > 0}
					<button
						type="button"
						onclick={clearFilters}
						class="mt-4 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
					>
						{$_('ui.reset_filters', { default: 'Reset all filters' })}
					</button>
				{/if}
			</div>
		{:else}
			<div class="mt-2 flex flex-col gap-0 pb-10">
				<!-- Crags Section -->
				{#if (effectiveTab === 'all' || effectiveTab === 'crags') && locations.length > 0}
					{#if effectiveTab === 'all' && routes.length > 0}
						<div
							class="sticky top-0 z-20 bg-white/95 py-2 text-xs font-bold tracking-wider text-slate-400 uppercase backdrop-blur-xs"
						>
							<i class="fa-solid fa-mountain mr-1.5 text-slate-400"></i>
							{$_('ui.crags_and_sectors', { default: 'Crags & Sectors' })} ({locations.length})
						</div>
					{/if}
					{#each locations as crag}
						<ListCard {crag} />
					{/each}
				{/if}

				<!-- Routes Section -->
				{#if (effectiveTab === 'all' || effectiveTab === 'routes') && routes.length > 0}
					{#if effectiveTab === 'all' && locations.length > 0}
						<div
							class="sticky top-0 z-20 mt-6 bg-white/95 py-2 text-xs font-bold tracking-wider text-slate-400 uppercase backdrop-blur-xs"
						>
							<i class="fa-solid fa-route mr-1.5 text-slate-400"></i>
							{$_('ui.routes', { default: 'Routes' })} ({routes.length})
						</div>
					{/if}
					{#each routes as route}
						<RouteCard {route} />
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</main>
