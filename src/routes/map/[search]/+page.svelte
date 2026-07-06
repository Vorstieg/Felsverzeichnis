<script>
	import { base } from '$app/paths';
	import { types } from '$lib/config';
	import { _ } from 'svelte-i18n';
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import CragList from '$lib/components/CragList.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import { searchSuggestionsActive } from '$lib/stores/search.js';

	/** @type {{data: any}} */
	let { data } = $props();

	let search = $derived(data.search);
	let searchTerm = $state(data.search);

	$effect(() => {
		searchTerm = data.search;
	});

	function resetSearch() {
		searchTerm = '';
	}

	function getTypeColor(typeId) {
		switch(typeId) {
			case 'sports-climbing': return 'bg-blue-500';
			case 'bouldering': return 'bg-orange-500';
			case 'multi-pitch': return 'bg-emerald-500';
			case 'trad': return 'bg-yellow-500';
			default: return 'bg-slate-400';
		}
	}

	async function share() {
		await navigator.share({
			title: 'Search Results',
			url: window.location.href
		});
	}
</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>

<div
	class="fixed h-fit overflow-visible sm:w-auto sm:left-26 left-0 right-0 py-2 top-2 sm:top-21 z-[1000]">
	<SearchBar actionBase="/map" bind:searchTerm showClear={true} onClear={resetSearch} />
</div>
<div class="fixed h-fit no-scrollbar overflow-x-auto flex sm:w-auto sm:left-26 left-0 right-0 py-2 transition-all duration-300 ease-out z-[1000] fade filter-wrapper" style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;">
	<div class="max-sm:w-4 sm:w-8 shrink-0"></div>
	{#each types as type}
		<a href="{base}/map/{type}"
			 class="cursor-pointer {search === type ? 'bg-ink text-white' : 'bg-white text-slate-800'} font-semibold hover:bg-ink hover:text-white mb-2 text-sm me-2 p-2 px-4 rounded-full shadow-md flex items-center justify-center shrink-0 transition-colors">
			 <span class="w-2.5 h-2.5 rounded-full mr-2 {getTypeColor(type)}"></span>
			 {$_('types.' + type)}
		</a>
	{/each}
	<div class="max-sm:w-4 sm:w-8 shrink-0"></div>
</div>

<style>
	.filter-wrapper {
		top: calc(4.5rem + var(--dropdown-offset, 0px));
	}
	@media (min-width: 640px) {
		.filter-wrapper {
			top: calc(9rem + var(--dropdown-offset, 0px));
		}
	}
    @media (width <= 40rem) {
        .fade {
            -webkit-mask: linear-gradient(to right, transparent 0px, #fff 16px, #fff calc(100% - 16px), transparent 100%);
            mask: linear-gradient(to right, transparent 0px, #fff 16px, #fff calc(100% - 16px), transparent 100%);
        }
    }
</style>

{#if data.locations && data.locations.length > 1}
	<InfoPanel closeUrl="{base}/map" onShare={share}>
		<div class="px-5 pt-6 pb-2">
			<h2 class="text-xl font-bold text-slate-800">
				{data.locations.length} {$_('ui.results', { default: 'Results' })}
			</h2>
		</div>
		<div class="flex-1 overflow-y-auto px-5 pb-4">
			<CragList crags={data.locations} isCompact={true} />
		</div>
	</InfoPanel>
{/if}