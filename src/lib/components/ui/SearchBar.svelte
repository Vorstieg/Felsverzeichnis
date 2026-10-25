<script lang="ts">
	import { onDestroy } from 'svelte';
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { searchSuggestionsActive, searchActive } from '$lib/stores/search.js';
	import Logo from '$lib/components/ui/Logo.svelte';
	import { getPreferredClimbingType } from '$lib/assets/js/climbing-map-utils.js';
	import { getTypeBadgeClass } from '$lib/assets/js/route-types.js';
	import { getGradeTier, getGradeLabel } from '$lib/assets/js/grades.js';
	import { getGeometryBounds } from '$lib/assets/js/map-camera.js';
	import {
		searchCatalog,
		isSearchConfigured,
		entryHitUrl,
		routeHitUrl,
		type EntryHit,
		type RouteHit
	} from '$lib/search/catalog-search';

	let {
		actionBase = '/map',
		searchTerm = $bindable(''),
		showClear = false,
		onClear = () => {},
		containerClass = 'mx-4 sm:mx-8 sm:max-w-120',
		isFocused = $bindable(false)
	}: {
		actionBase?: string;
		searchTerm?: string;
		showClear?: boolean;
		onClear?: () => void;
		containerClass?: string;
		isFocused?: boolean;
	} = $props();

	let dropdownHeight = $state(0);
	let activeIndex = $state(-1);

	let entryHits = $state<EntryHit[]>([]);
	let routeHits = $state<RouteHit[]>([]);
	let isLoading = $state(false);

	type SuggestionItem = { type: 'entry'; data: EntryHit } | { type: 'route'; data: RouteHit };

	let unifiedSuggestions = $derived<SuggestionItem[]>([
		...entryHits.map((data) => ({ type: 'entry' as const, data })),
		...routeHits.map((data) => ({ type: 'route' as const, data }))
	]);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let abortController: AbortController | null = null;

	$effect(() => {
		const term = searchTerm.trim();
		if (debounceTimer) clearTimeout(debounceTimer);
		if (abortController) abortController.abort();

		if (!term || term.length < 2 || !isSearchConfigured()) {
			entryHits = [];
			routeHits = [];
			isLoading = false;
			activeIndex = -1;
			return;
		}

		isLoading = true;
		debounceTimer = setTimeout(async () => {
			const controller = new AbortController();
			abortController = controller;
			try {
				const result = await searchCatalog({
					q: term,
					entryLimit: 3,
					routeLimit: 4,
					signal: controller.signal
				});
				if (!controller.signal.aborted) {
					entryHits = result.entries;
					routeHits = result.routes;
					activeIndex = -1;
					isLoading = false;
				}
			} catch {
				if (!controller.signal.aborted) {
					isLoading = false;
				}
			}
		}, 160);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			if (abortController) abortController.abort();
		};
	});

	$effect(() => {
		$searchSuggestionsActive = isFocused && unifiedSuggestions.length > 0 ? dropdownHeight : 0;
		$searchActive = isFocused || Boolean(searchTerm && searchTerm.trim().length > 0);
	});

	onDestroy(() => {
		$searchActive = false;
		$searchSuggestionsActive = 0;
	});

	function getTagLabel(tag: string) {
		const translated = $_('tags.' + tag);
		return translated === 'tags.' + tag ? tag : translated;
	}

	function selectItem(item: SuggestionItem) {
		const locations = ($page.data.allLocations ??
			$page.data.locations ??
			[]) as import('$lib/types/files').FelsLocation[];
		if (item.type === 'entry') {
			goto(entryHitUrl(base, item.data));
			const isAreaOrRegion = ['area', 'region', 'country'].includes(item.data.kind);
			if (isAreaOrRegion) {
				const loc = locations.find((l) => l.path === item.data.path);
				const bounds =
					loc?.entry?.geometry && loc.entry.geometry.type !== 'Point'
						? getGeometryBounds(loc.entry.geometry)
						: null;
				if (bounds) {
					window.dispatchEvent(
						new CustomEvent('crag-review:focus-map-target', {
							detail: { bounds, padding: 80, maxZoom: 14, path: item.data.path }
						})
					);
				}
			} else if (item.data._geo) {
				window.dispatchEvent(
					new CustomEvent('crag-review:focus-map-target', {
						detail: {
							center: [item.data._geo.lng, item.data._geo.lat],
							zoom: 16,
							path: item.data.path
						}
					})
				);
			}
		} else {
			goto(routeHitUrl(base, item.data));
			if (item.data._geo) {
				window.dispatchEvent(
					new CustomEvent('crag-review:focus-map-target', {
						detail: {
							center: [item.data._geo.lng, item.data._geo.lat],
							zoom: 16,
							path: item.data.path
						}
					})
				);
			}
		}
		isFocused = false;
		searchTerm = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isFocused || unifiedSuggestions.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % unifiedSuggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = activeIndex <= 0 ? unifiedSuggestions.length - 1 : activeIndex - 1;
		} else if (e.key === 'Enter') {
			if (activeIndex >= 0 && activeIndex < unifiedSuggestions.length) {
				e.preventDefault();
				selectItem(unifiedSuggestions[activeIndex]);
			}
		} else if (e.key === 'Escape') {
			isFocused = false;
		}
	}
</script>

<form action="{actionBase}/{encodeURIComponent(searchTerm)}" class="relative">
	<div
		class="relative z-[2010] flex items-stretch rounded-full bg-white shadow-md {containerClass} focus-within:border-ink overflow-hidden border-3 border-white transition-colors"
	>
		<a
			href="{base}/map/about"
			class="hover:text-ink flex shrink-0 cursor-pointer items-center justify-center pl-4 text-slate-800 transition-colors"
			title="Info & Impressum"
		>
			<Logo class="h-6 w-6" />
		</a>
		<input
			bind:value={searchTerm}
			onfocus={() => (isFocused = true)}
			onblur={() => setTimeout(() => (isFocused = false), 220)}
			onkeydown={handleKeydown}
			class="z-20 block w-full border-0 bg-transparent py-2.5 pr-3 pl-3 text-base text-slate-800 outline-none focus:ring-0 focus:outline-none"
			placeholder={$_('page.list.search_placeholder')}
			autocomplete="off"
		/>
		{#if isLoading}
			<div class="flex w-8 shrink-0 items-center justify-center text-slate-400">
				<i class="fa-solid fa-circle-notch fa-spin text-sm"></i>
			</div>
		{/if}
		<button
			type="submit"
			class="hover:bg-ink flex w-12 shrink-0 items-center justify-center bg-white text-sm font-medium transition-colors outline-none hover:text-white focus:outline-none"
		>
			<i class="fa-solid fa-magnifying-glass"></i>
			<span class="sr-only">Search</span>
		</button>
		{#if showClear}
			<button
				type="button"
				onclick={onClear}
				class="hover:bg-ink flex w-12 shrink-0 items-center justify-center bg-white text-sm font-medium transition-colors outline-none hover:text-white focus:outline-none"
			>
				<i class="fa-solid fa-xmark"></i>
				<span class="sr-only">Clear</span>
			</button>
		{/if}
	</div>

	{#if isFocused && unifiedSuggestions.length > 0}
		<div
			bind:clientHeight={dropdownHeight}
			class="absolute top-full z-[2000] mt-2 max-h-[80vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl {containerClass} divide-y divide-slate-100 transition-all duration-300"
			style="left: 0; right: 0;"
		>
			{#if entryHits.length > 0}
				<div>
					<div class="px-5 pt-3 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
						<i class="fa-solid fa-mountain mr-1.5 text-slate-300"></i>
						{$_('ui.crags_and_sectors', { default: 'Crags & Sectors' })}
					</div>
					{#each entryHits as entry, i}
						{@const unifiedIndex = i}
						{@const isSelected = activeIndex === unifiedIndex}
						<a
							href={entryHitUrl(base, entry)}
							onmousedown={(e) => e.preventDefault()}
							onclick={(e) => {
								e.preventDefault();
								selectItem({ type: 'entry', data: entry });
							}}
							class="block px-5 py-3 text-sm no-underline transition-colors {isSelected
								? 'bg-ink text-white'
								: 'text-slate-800 hover:bg-slate-50'}"
						>
							<div class="flex items-center justify-between gap-2">
								<div class="min-w-0">
									<div class="truncate font-semibold">{entry.name}</div>
									{#if entry.breadcrumb && entry.breadcrumb.length > 0}
										<div class="truncate text-xs {isSelected ? 'text-white/75' : 'text-slate-400'}">
											{entry.breadcrumb.join(' · ')}
										</div>
									{/if}
								</div>
								<div class="flex shrink-0 items-center gap-1.5">
									{#if entry.routeCount > 0}
										<span
											class="rounded-full px-2 py-0.5 text-xs {isSelected
												? 'bg-white/20 text-white'
												: 'bg-slate-100 text-slate-600'}"
										>
											{entry.routeCount}
											{$_('topo.routes', { default: 'routes' })}
										</span>
									{:else if getPreferredClimbingType(entry.types)}
										<span
											class="text-xs font-normal tracking-wider uppercase {isSelected
												? 'text-white/80'
												: 'text-slate-400'}"
										>
											{getTagLabel(getPreferredClimbingType(entry.types) || '')}
										</span>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}

			{#if routeHits.length > 0}
				<div>
					<div class="px-5 pt-3 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
						<i class="fa-solid fa-route mr-1.5 text-slate-300"></i>
						{$_('ui.routes', { default: 'Routes' })}
					</div>
					{#each routeHits as route, i}
						{@const unifiedIndex = entryHits.length + i}
						{@const isSelected = activeIndex === unifiedIndex}
						{@const primaryType = route.types?.[0]}
						{@const tier = route.grade ? getGradeTier(route.grade, primaryType) : null}
						{@const gradeDisplay = route.grade
							? getGradeLabel(route.grade.value, route.grade.scale, primaryType) ||
								route.grade.standardizedValue
							: null}
						<a
							href={routeHitUrl(base, route)}
							onmousedown={(e) => e.preventDefault()}
							onclick={(e) => {
								e.preventDefault();
								selectItem({ type: 'route', data: route });
							}}
							class="block px-5 py-3 text-sm no-underline transition-colors {isSelected
								? 'bg-ink text-white'
								: 'text-slate-800 hover:bg-slate-50'}"
						>
							<div class="flex items-center justify-between gap-2">
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<span class="truncate font-semibold">{route.name}</span>
										{#if gradeDisplay}
											<span
												class="py-0.2 shrink-0 rounded-full px-2 text-[11px] font-bold text-white shadow-2xs"
												style="background-color: {tier?.color ?? '#475569'};"
											>
												{gradeDisplay}
											</span>
										{/if}
									</div>
									<div class="truncate text-xs {isSelected ? 'text-white/75' : 'text-slate-400'}">
										{#if route.breadcrumb && route.breadcrumb.length > 0}
											{route.breadcrumb.join(' · ')}
										{:else}
											{route.entryName}
										{/if}
									</div>
								</div>

								<div class="flex shrink-0 items-center gap-1.5 text-xs">
									{#if route.types && route.types[0]}
										<span
											class="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase {getTypeBadgeClass(
												route.types[0]
											)}"
										>
											{$_('types.' + route.types[0])}
										</span>
									{/if}
									{#if route.length}
										<span class="{isSelected ? 'text-white/80' : 'text-slate-500'} text-[11px]">
											{route.length}m
										</span>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</form>
