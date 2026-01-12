<script>
	import { _ } from 'svelte-i18n';

	/** @type {{data: any}} */
	let { data } = $props();

	const { search } = data;
	let searchTerm = $state(search);

	function resetSearch() {
		searchTerm = '';
	}
</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>

<div
	class="fixed h-fit no-scrollbar overflow-x-auto sm:w-auto sm:left-26 left-15 right-0 py-2 top-18 sm:top-21 z-[1000] fade">
	<form action="/map/{searchTerm}">
		<div class="flex mx-8 sm:max-w-120 shadow-md rounded-full">
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
				<span class="sr-only">Search</span>
			</button>
		</div>
	</form>
</div>