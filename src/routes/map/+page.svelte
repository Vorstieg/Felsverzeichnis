<script>
	import { base } from '$app/paths';
	import { types } from '$lib/config';
	import { _ } from 'svelte-i18n';

	let searchTerm = $state('');
</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>

<div
	class="fixed h-fit no-scrollbar overflow-x-auto sm:w-auto sm:left-26 left-15 right-0 py-2 top-18 sm:top-21 z-[1000]">
	<form action="/map/{searchTerm}">
		<div class="flex mx-8 sm:max-w-120 shadow-md rounded-full">
			<input bind:value={searchTerm}
						 class="block p-2.5 w-full z-20 text-sm bg-white rounded-l-full border-3 border-white focus:border-ink"
						 placeholder={$_('page.list.search_placeholder')} />
			<button type="submit"
							class="top-0 w-12 p-2.5 bg-white text-sm font-medium h-full border-3 border-white rounded-r-full hover:border-ink hover:bg-ink hover:text-white">
				<i class="fa-solid fa-magnifying-glass"></i>
				<span class="sr-only">Search</span>
			</button>
		</div>
	</form>
</div>
<div class="fixed h-fit no-scrollbar overflow-x-auto sm:w-auto sm:left-26 left-15 right-0 py-2 top-36 z-[1000] fade">
	<span class="px-4"></span>
	{#each types as type}
		<a href="{base}/map/{type}"
			 class="cursor-pointer bg-white hover:shadow-xl font-semibold hover:bg-ink hover:text-white mb-2 text-sm me-2 p-2 px-4 rounded-full shadow-md items-center justify-center">{$_('types.' + type)}</a>
	{/each}
	<span class="px-4"></span>
</div>

<style>
    @media (width <= 40rem) {
        .fade {
            -webkit-mask: linear-gradient(to right, transparent 10%, #fff 15% 90%, transparent 95%),
            linear-gradient(to left, transparent 10%, #fff 15% 90%, transparent 95%);
        }
    }
</style>