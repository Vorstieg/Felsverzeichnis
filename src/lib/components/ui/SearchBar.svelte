<script lang="ts">
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { searchSuggestionsActive } from '$lib/stores/search.js';
	import Logo from '$lib/components/ui/Logo.svelte';
	import { getGeometryBounds, getBoundsCenter } from '$lib/assets/js/map-camera.js';

	let {
		actionBase = '/map',
		searchTerm = $bindable(''),
		showClear = false,
		onClear = () => {},
		containerClass = 'mx-4 sm:mx-8 sm:max-w-120'
	}: {
		actionBase?: string;
		searchTerm?: string;
		showClear?: boolean;
		onClear?: () => void;
		containerClass?: string;
	} = $props();

	let isFocused = $state(false);
	let dropdownHeight = $state(0);

	let suggestions = $derived.by(() => {
		if (!searchTerm || searchTerm.length < 3) return [];
		const lowerSearch = searchTerm.toLowerCase();
		const locations = $page.data.allLocations ?? $page.data.locations ?? [];
		return locations
			.filter((loc) => loc.entry.properties?.name?.toLowerCase().includes(lowerSearch))
			.slice(0, 3);
	});

	let activeIndex = $state(-1);

	$effect(() => {
		if (suggestions) {
			activeIndex = -1;
		}
	});

	$effect(() => {
		$searchSuggestionsActive = isFocused && suggestions.length > 0 ? dropdownHeight : 0;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (!isFocused || suggestions.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
		} else if (e.key === 'Enter') {
			if (activeIndex >= 0) {
				e.preventDefault();
				const selected = suggestions[activeIndex];
				goto(cragUrl(selected));
				const center = getBoundsCenter(getGeometryBounds(selected?.entry.geometry));
				if (center) {
					window.dispatchEvent(
						new CustomEvent('crag-review:focus-map-target', {
							detail: { center, zoom: 16 }
						})
					);
				}
				isFocused = false;
				searchTerm = '';
			}
		}
	}

	function cragUrl(location: import('$lib/types/files').FelsLocation) {
		const center = getBoundsCenter(getGeometryBounds(location?.entry.geometry));
		const hash = center ? `#16/${center[1]}/${center[0]}` : '';
		return `${base}/map/crag/${location.path}${hash}`;
	}
</script>

<form action="{actionBase}/{searchTerm}" class="relative">
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
			onblur={() => setTimeout(() => (isFocused = false), 200)}
			onkeydown={handleKeydown}
			class="z-20 block w-full border-0 bg-transparent py-2.5 pr-3 pl-3 text-base text-slate-800 outline-none focus:ring-0 focus:outline-none"
			placeholder={$_('page.list.search_placeholder')}
			autocomplete="off"
		/>
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

	{#if isFocused && suggestions.length > 0}
		<div
			bind:clientHeight={dropdownHeight}
			class="absolute top-full z-[2000] mt-2 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl {containerClass} transition-all duration-300"
			style="left: 0; right: 0;"
		>
			{#each suggestions as suggestion, i}
				<a
					href={cragUrl(suggestion)}
					onmousedown={(e) => e.preventDefault()}
					onclick={() => {
						const center = getBoundsCenter(getGeometryBounds(suggestion.entry.geometry));
						if (center) {
							window.dispatchEvent(
								new CustomEvent('crag-review:focus-map-target', {
									detail: { center, zoom: 16 }
								})
							);
						}
						isFocused = false;
						searchTerm = '';
					}}
					class="block border-b border-slate-100 px-6 py-3.5 text-sm font-medium text-slate-800 no-underline transition-colors last:border-b-0 {i ===
					activeIndex
						? 'bg-ink text-white'
						: 'hover:bg-gray-50'}"
				>
					<div class="flex items-center justify-between">
						<span>{suggestion.entry.properties.name}</span>
						{#if suggestion.entry.properties.type?.[0] != null}
							<span
								class="text-xs {i === activeIndex
									? 'text-white/80'
									: 'text-slate-400'} font-normal tracking-wider uppercase"
							>
								{$_('tags.' + suggestion.entry.properties.type[0])}
							</span>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</form>
