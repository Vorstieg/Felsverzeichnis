<script>
	import { page } from '$app/stores';
	import CragList from '$lib/components/CragList.svelte';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();
</script>
<div class="mt-60 h-screen max-w-3/4 justify-self-center">

	{#if $page.data.crags.length}
		<div class="pb-10">
			<CragList crags={$page.data.crags} />
		</div>
	{:else}
		<p> Keine Einträge gefunden </p>
	{/if}
</div>
{@render children?.()}