<script>
	import { page } from '$app/stores';
	import ListCard from '$lib/components/ListCard.svelte';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();
</script>

<div class="mt-40 sm:mt-56 pb-16 sm:pb-2 sm:max-w-5xl mx-4 sm:mx-auto">
	{#if $page.data.crags.length}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each $page.data.crags as crag}
				<ListCard crag={crag} />
			{/each}
		</div>
	{:else}
		<p class="text-center text-slate-500 py-10 font-medium"> Keine Einträge gefunden </p>
	{/if}
</div>
{@render children?.()}