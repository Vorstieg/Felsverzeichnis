<script>
	import { _ } from 'svelte-i18n';
	import CragList from '$lib/components/CragList.svelte';

	/** @type {{data: any}} */
	let { data } = $props();


</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>


{#if data.locations && data.locations.length > 1}
	<div class="px-5 pt-6 pb-2">
		<h2 class="text-xl font-bold text-slate-800">
			{data.locations.length} {$_('ui.results', { default: 'Results' })}
		</h2>
	</div>
	<div class="flex-1 overflow-y-auto px-5 pb-4">
		<CragList crags={data.locations} isCompact={true} />
	</div>
{/if}
