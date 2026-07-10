<script>
	import { base } from '$app/paths';
	import { types } from '$lib/config';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import { searchSuggestionsActive } from '$lib/stores/search.js';
	import { getTypeDotClass } from '$lib/assets/js/route-types.js';

	/** @type {{data: any}} */
	let { data } = $props();

	let search = $derived(data.search);
	let searchTerm = $state(data.search);

	$effect(() => {
		searchTerm = data.search;
	});

	function resetSearch() {
		searchTerm = '';
		goto(`${base}/list`);
	}
</script>

<svelte:head>
	<title>{$_('page.list.title')}</title>
</svelte:head>

<div class="bg-gray-100 border-1 border-gray-200 fixed h-36 sm:h-50 left-0 right-0 top-0 shadow-md z-[500]"></div>
<div
	class="fixed h-fit overflow-visible sm:w-auto sm:left-8 left-0 right-0 py-2 top-2 sm:top-21 z-[1000]">
	<SearchBar actionBase="/list" bind:searchTerm showClear={true} onClear={resetSearch} containerClass="mx-8 sm:max-w-120" />
</div>
<div
	class="fixed h-fit no-scrollbar flex overflow-x-auto sm:w-auto sm:left-8 left-0 right-0 py-2 transition-all duration-300 ease-out z-[1000] fade filter-wrapper" style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;">
	<div class="max-sm:w-8 sm:w-8 shrink-0"></div>
	{#each types as type}
		<a href="{base}/list/{type}"
			 class="cursor-pointer {search === type ? 'bg-ink text-white' : 'bg-white text-slate-800'} font-semibold hover:bg-ink hover:text-white mb-2 text-sm me-2 p-2 px-4 rounded-full shadow-md flex items-center justify-center shrink-0 transition-colors">
			 <span class="w-2.5 h-2.5 rounded-full mr-2 {getTypeDotClass(type)}"></span>
			 {$_('types.' + type)}
		</a>
	{/each}
	<div class="max-sm:w-8 sm:w-8 shrink-0"></div>
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
            -webkit-mask: linear-gradient(to right, transparent 0px, #fff 32px, #fff calc(100% - 32px), transparent 100%);
            mask: linear-gradient(to right, transparent 0px, #fff 32px, #fff calc(100% - 32px), transparent 100%);
        }
    }
</style>