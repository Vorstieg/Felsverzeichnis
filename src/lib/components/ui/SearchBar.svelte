<script>
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { searchSuggestionsActive } from '$lib/stores/search.js';

	/** @type {{actionBase?: string, searchTerm?: string, showClear?: boolean, onClear?: function, containerClass?: string}} */
	let { actionBase = '/map', searchTerm = $bindable(''), showClear = false, onClear = () => {}, containerClass = "mx-4 sm:mx-8 sm:max-w-120" } = $props();

	let isFocused = $state(false);
	let dropdownHeight = $state(0);

	let suggestions = $derived.by(() => {
		if (!searchTerm || searchTerm.length < 3) return [];
		const lowerSearch = searchTerm.toLowerCase();
		const locations = $page.data.allLocations || $page.data.locations || $page.data.crags || [];
		return locations
			.filter(loc => loc.properties?.name?.toLowerCase().includes(lowerSearch))
			.slice(0, 3);
	});

	let activeIndex = $state(-1);

	$effect(() => {
		if (suggestions) {
			activeIndex = -1;
		}
	});

	$effect(() => {
		$searchSuggestionsActive = (isFocused && suggestions.length > 0) ? dropdownHeight : 0;
	});

	function handleKeydown(e) {
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
				goto(`${base}/map/crag/${selected.properties.path}`);
				isFocused = false;
				searchTerm = '';
			}
		}
	}
</script>

<form action="{actionBase}/{searchTerm}" class="relative">
	<div class="flex shadow-md rounded-full bg-white relative z-[2010] {containerClass}">
		<input 
			bind:value={searchTerm}
			onfocus={() => isFocused = true}
			onblur={() => setTimeout(() => isFocused = false, 200)}
			onkeydown={handleKeydown}
			class="block py-2.5 pl-5 pr-3 w-full z-20 text-base text-slate-800 bg-white rounded-l-full border-3 border-white focus:border-ink focus:outline-none"
			placeholder={$_('page.list.search_placeholder')} 
			autocomplete="off"
		/>
		<button type="submit"
			class="top-0 w-12 p-2.5 bg-white text-sm font-medium border-3 border-white h-full hover:border-ink hover:bg-ink hover:text-white {showClear ? '' : 'rounded-r-full'}">
			<i class="fa-solid fa-magnifying-glass"></i>
			<span class="sr-only">Search</span>
		</button>
		{#if showClear}
			<button type="button" onclick={onClear}
				class="top-0 w-12 p-2.5 bg-white text-sm font-medium border-3 border-white h-full hover:border-ink rounded-r-full hover:bg-ink hover:text-white">
				<i class="fa-solid fa-xmark"></i>
				<span class="sr-only">Clear</span>
			</button>
		{/if}
	</div>

	{#if isFocused && suggestions.length > 0}
		<div bind:clientHeight={dropdownHeight} class="absolute top-full mt-2 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden z-[2000] {containerClass} transition-all duration-300" style="left: 0; right: 0;">
			{#each suggestions as suggestion, i}
				<a 
					href="{base}/map/crag/{suggestion.properties.path}"
					class="block px-6 py-3.5 text-slate-800 text-sm font-medium border-b border-slate-100 last:border-b-0 no-underline transition-colors {i === activeIndex ? 'bg-ink text-white' : 'hover:bg-gray-50'}"
				>
					<div class="flex items-center justify-between">
						<span>{suggestion.properties.name}</span>
						{#if suggestion.properties.type}
							<span class="text-xs {i === activeIndex ? 'text-white/80' : 'text-slate-400'} font-normal uppercase tracking-wider">
								{$_('tags.' + (Array.isArray(suggestion.properties.type) ? suggestion.properties.type[0] : suggestion.properties.type))}
							</span>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</form>
