<script>
	import CragList from '$lib/components/CragList.svelte';

	/** @type {{data: any}} */
	let { data } = $props();

	const { crags, search } = data;
	let searchTerm = $state(search);

	function resetSearch() {
		searchTerm = '';
	}

</script>


<svelte:head>

</svelte:head>
<div class="pt-50 h-screen  max-w-3/4 justify-self-center">

	{#if crags.length}
		<div class="pb-10">
			<CragList crags={crags} />
		</div>
	{:else}
		<p> Keine Einträge gefunden </p>
	{/if}
</div>

<div class="bg-gray-100 border-1 border-gray-200 fixed h-40 left-0 right-0 top-0 shadow-md z-[500]"></div>
<div class="fixed h-fit py-2 sm:w-auto left-0 sm:left-8 top-18 right-0 sm:top-21 z-[1000]">
	<form action="/list/{searchTerm}">
		<div class="flex mx-8 sm:max-w-120 shadow-md rounded-full">
			<input bind:value={searchTerm}
						 class="block p-2.5 w-full z-20 text-sm bg-white rounded-l-full border-3 border-white focus:border-ink"
						 placeholder="Suchen ... " />
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