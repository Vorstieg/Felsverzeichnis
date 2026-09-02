<script>
	import { base } from '$app/paths';
	import { types } from '$lib/config';
	import { _ } from 'svelte-i18n';
	import { searchSuggestionsActive } from '$lib/stores/search.js';
	import { getTypeDotClass } from '$lib/assets/js/route-types.js';
</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>

<div class="pointer-events-auto filter-wrapper fade no-scrollbar fixed right-0 z-[1000] flex items-center overflow-x-auto py-2 pl-0 transition-all duration-300 ease-out sm:top-5 sm:h-[50px] sm:py-0" style="--dropdown-offset: {$searchSuggestionsActive > 0 ? $searchSuggestionsActive + 16 : 0}px;">
	<div class="w-4 shrink-0 sm:hidden"></div>
	{#each types as type}
		<a href="{base}/map/{type}"
			 class="me-2 flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-white p-2 px-4 text-sm font-semibold shadow-md transition-colors hover:bg-ink hover:text-white">
			 <span class="mr-2 h-2.5 w-2.5 rounded-full {getTypeDotClass(type)}"></span>
			 {$_('types.' + type)}
		</a>
	{/each}
	<div class="w-4 shrink-0 sm:hidden"></div>
</div>

<style>
	.filter-wrapper {
		top: calc(4.5rem + var(--dropdown-offset, 0px));
		left: 0;
	}
	@media (min-width: 640px) {
		.filter-wrapper {
			top: 1.25rem;
			left: calc(2rem + min(30vw, 16rem) + 0.75rem);
		}
	}

	@media (min-width: 768px) {
		.filter-wrapper {
			left: calc(2rem + min(30vw, 18rem) + 0.75rem);
		}
	}

	@media (min-width: 1024px) {
		.filter-wrapper {
			left: calc(2rem + min(30vw, 20rem) + 0.75rem);
		}
	}
    @media (width <= 40rem) {
        .fade {
            -webkit-mask: linear-gradient(to right, transparent 0px, #fff 16px, #fff calc(100% - 16px), transparent 100%);
            mask: linear-gradient(to right, transparent 0px, #fff 16px, #fff calc(100% - 16px), transparent 100%);
        }
    }
</style>