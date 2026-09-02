<script>
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import ListCard from '$lib/components/ListCard.svelte';

	/** @type {{data: any}} */
	let { data } = $props();

	async function share() {
		if (navigator.share) {
			await navigator.share({
				title: 'Search Results',
				url: window.location.href
			});
		}
	}
</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>

<main class="z-[500] flex h-full min-h-0 w-full flex-1 flex-col">
	{#if data.locations && data.locations.length > 1}
		<div class="px-5 pt-6 pb-2">
			<h2 class="text-xl font-bold text-slate-800">
				{data.locations.length} {$_('ui.results', { default: 'Results' })}
			</h2>
		</div>
		<div class="mb-4 min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-5 pb-24" overflow-y>
			<div class="flex flex-col gap-0 pb-10 mt-2">
				{#each data.locations as crag}
					<ListCard {crag} />
				{/each}
			</div>
		</div>
	{/if}
</main>
