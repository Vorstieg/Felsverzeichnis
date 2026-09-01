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
	class="fixed left-0 right-0 top-2 z-[1000] h-fit overflow-visible px-4 py-2 sm:top-21 sm:flex sm:items-center sm:gap-3 sm:px-8">
	<div class="sm:w-120 sm:shrink-0">
		<SearchBar actionBase={`${base}/list`} bind:searchTerm showClear={true} onClear={resetSearch} containerClass="w-full" />
	</div>
	<div class="filter-wrapper fade no-scrollbar fixed left-0 right-0 flex overflow-x-auto py-2 sm:static sm:min-w-0 sm:flex-1 sm:items-center sm:py-0" style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;">
		<div class="w-4 shrink-0 sm:hidden"></div>
		{#each types as type}
			<a href="{base}/list/{type}"
				 class="me-2 flex shrink-0 cursor-pointer items-center justify-center rounded-full p-2 px-4 text-sm font-semibold shadow-md transition-colors hover:bg-ink hover:text-white {search === type ? 'bg-ink text-white' : 'bg-white text-slate-800'}">
				 <span class="mr-2 h-2.5 w-2.5 rounded-full {getTypeDotClass(type)}"></span>
				 {$_('types.' + type)}
			</a>
		{/each}
		<div class="w-4 shrink-0 sm:hidden"></div>
	</div>
</div>

<style>
	.filter-wrapper {
		top: calc(4.5rem + var(--dropdown-offset, 0px));
	}

    @media (width <= 40rem) {
        .fade {
            -webkit-mask: linear-gradient(to right, transparent 0px, #fff 32px, #fff calc(100% - 32px), transparent 100%);
            mask: linear-gradient(to right, transparent 0px, #fff 32px, #fff calc(100% - 32px), transparent 100%);
        }
    }
</style>
