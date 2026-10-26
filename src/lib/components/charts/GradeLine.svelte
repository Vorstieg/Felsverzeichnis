<script lang="ts">
	import type { Route } from '@vorstieg/fels-types/types';
	import { _ } from 'svelte-i18n';
	import { getGradeDistribution } from '$lib/assets/js/grades.js';

	let { routes, type }: { routes: Route[]; type?: string } = $props();

	let distribution = $derived(getGradeDistribution(routes, type));
</script>

{#if distribution.length > 0}
	<div class="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
		{#each distribution as segment}
			<div
				class="h-full"
				style="width: {segment.percent}%; background-color: {segment.color};"
				title="{segment.label}: {segment.count} {$_('topo.routes')}"
			></div>
		{/each}
	</div>
	<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
		{#each distribution as segment}
			<div class="flex items-center gap-1.5 text-xs text-slate-600">
				<span class="h-2 w-2 rounded-full" style="background-color: {segment.color};"></span>
				<span class="font-medium">{segment.label}</span>
				<span class="text-slate-400">({segment.count})</span>
			</div>
		{/each}
	</div>
{/if}
