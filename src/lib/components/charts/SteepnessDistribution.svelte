<script lang="ts">
	import { _ } from 'svelte-i18n';

	let { metrics }: { metrics: import('$lib/types/application').SteepnessMetrics | null } = $props();
</script>

{#if metrics !== null}
	<div class="mb-2 flex h-6 w-full overflow-hidden rounded-md bg-gray-100 shadow-inner">
		{#if metrics.slab > 0}
			<div
				class="flex h-full items-center justify-center bg-teal-400 text-[10px] font-bold text-white"
				style="width: {metrics.slab}%"
				title={$_('charts.slab')}
			>
				{#if metrics.slab > 10}{Math.round(metrics.slab)}%{/if}
			</div>
		{/if}
		{#if metrics.vertical > 0}
			<div
				class="flex h-full items-center justify-center bg-yellow-400 text-[10px] font-bold text-white"
				style="width: {metrics.vertical}%"
				title={$_('charts.vertical')}
			>
				{#if metrics.vertical > 10}{Math.round(metrics.vertical)}%{/if}
			</div>
		{/if}
		{#if metrics.overhang > 0}
			<div
				class="flex h-full items-center justify-center bg-red-500 text-[10px] font-bold text-white"
				style="width: {metrics.overhang}%"
				title={$_('charts.overhang')}
			>
				{#if metrics.overhang > 10}{Math.round(metrics.overhang)}%{/if}
			</div>
		{/if}
	</div>
	<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
		<div class="flex items-center gap-1">
			<div class="h-2 w-2 rounded-full bg-teal-400"></div>
			{$_('charts.slab')} ({metrics.slab}%)
		</div>
		<div class="flex items-center gap-1">
			<div class="h-2 w-2 rounded-full bg-yellow-400"></div>
			{$_('charts.vertical')} ({metrics.vertical}%)
		</div>
		<div class="flex items-center gap-1">
			<div class="h-2 w-2 rounded-full bg-red-500"></div>
			{$_('charts.overhang')} ({metrics.overhang}%)
		</div>
	</div>
{:else}
	<div class="text-sm text-gray-400 italic">{$_('charts.calculating')}</div>
{/if}
