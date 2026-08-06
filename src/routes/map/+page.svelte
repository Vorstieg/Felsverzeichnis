<script>
	import { base } from '$app/paths';
	import { types } from '$lib/config';
	import { _ } from 'svelte-i18n';
	import { getTypeDotClass } from '$lib/assets/js/route-types.js';
	import { searchSuggestionsActive } from '$lib/stores/search.js';

	let searchTerm = $state('');
</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>

<div class="fixed h-fit no-scrollbar overflow-x-auto flex sm:w-auto sm:left-26 left-0 right-0 py-2 transition-all duration-300 ease-out z-[1000] fade filter-wrapper" style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;">
	<div class="max-sm:w-4 sm:w-8 shrink-0"></div>
	{#each types as type}
		<a href="{base}/map/{type}"
			 class="cursor-pointer bg-white font-semibold hover:bg-ink hover:text-white mb-2 text-sm me-2 p-2 px-4 rounded-full shadow-md flex items-center justify-center shrink-0 transition-colors">
			 <span class="w-2.5 h-2.5 rounded-full mr-2 {getTypeDotClass(type)}"></span>
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