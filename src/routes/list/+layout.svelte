<script>
	import { page } from '$app/stores';
	import HierarchyList from '$lib/components/HierarchyList.svelte';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();
</script>
<div class="mt-40 sm:mt-56 pb-16 sm:pb-2 sm:max-w-3/4 mx-4 sm:mx-auto">

	{#if $page.data.crags.length}
		<div>
			<HierarchyList crags={$page.data.crags} />
		</div>
	{:else}
		<p class="text-center text-slate-500 py-10 font-medium"> Keine Einträge gefunden </p>
	{/if}
</div>
{@render children?.()}