<script>
	import { base } from '$app/paths';
	import { types } from '$lib/config';
	import { _ } from 'svelte-i18n';

	/** @type {{data: any}} */
	let { data } = $props();

	const { search } = data;
	let searchTerm = $state(search);

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
</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>

<div
	class="fixed h-fit no-scrollbar overflow-x-auto sm:w-auto sm:left-26 left-0 right-0 py-2 top-2 sm:top-21 z-[1000]">
	<form action="/map/{searchTerm}">
		<div class="flex mx-4 sm:mx-8 sm:max-w-120 shadow-md rounded-full">
			<input bind:value={searchTerm}
						 class="block p-2.5 w-full z-20 text-sm bg-white rounded-l-full border-3 border-white focus:border-ink"
						 placeholder={$_('page.list.search_placeholder')} />
			<button type="submit"
							class="top-0 w-12 p-2.5 bg-white text-sm font-medium border-3 border-white h-full hover:border-ink hover:bg-ink hover:text-white">
				<i class="fa-solid fa-magnifying-glass"></i>
				<span class="sr-only">Search</span>
			</button>
			<button onclick={resetSearch}
							class="top-0 w-12 p-2.5 bg-white text-sm font-medium border-3 border-white h-full hover:border-ink rounded-r-full hover:bg-ink hover:text-white">
				<i class="fa-solid fa-xmark"></i>
				<span class="sr-only">Clear</span>
			</button>
		</div>
	</form>
</div>
<div class="fixed h-fit no-scrollbar overflow-x-auto flex sm:w-auto sm:left-26 left-0 right-0 py-2 top-16 sm:top-36 z-[1000] fade">
	<div class="max-sm:w-4 sm:w-8 shrink-0"></div>
	{#each types as type}
		<a href="{base}/map/{type}"
			 class="cursor-pointer {search === type ? 'bg-ink text-white' : 'bg-white text-slate-800'} hover:shadow-xl font-semibold hover:bg-ink hover:text-white mb-2 text-sm me-2 p-2 px-4 rounded-full shadow-md flex items-center justify-center shrink-0 transition-colors">
			 <span class="w-2.5 h-2.5 rounded-full mr-2 {getTypeColor(type)}"></span>
			 {$_('types.' + type)}
		</a>
	{/each}
	<div class="max-sm:w-4 sm:w-8 shrink-0"></div>
</div>

<style>
    @media (width <= 40rem) {
        .fade {
            -webkit-mask: linear-gradient(to right, transparent 0px, #fff 16px, #fff calc(100% - 16px), transparent 100%);
            mask: linear-gradient(to right, transparent 0px, #fff 16px, #fff calc(100% - 16px), transparent 100%);
        }
    }
</style>