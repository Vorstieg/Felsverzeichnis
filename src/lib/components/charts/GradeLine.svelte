<script lang="ts">
	import type { Route } from '@vorstieg/fels-types/types';
	import { _ } from 'svelte-i18n';

	let { routes }: { routes: Route[] } = $props();

	let distribution = $derived.by(() => {
		if (routes.length === 0) return [];

		let easy = 0,
			medium = 0,
			hard = 0,
			veryHard = 0;
		routes.forEach((r) => {
			const g = r.grade?.standardizedValue ?? '';
			if (
				g.startsWith('3') ||
				g.startsWith('4') ||
				g.startsWith('5') ||
				g.startsWith('2') ||
				g.startsWith('1')
			)
				easy++;
			else if (g.startsWith('6')) medium++;
			else if (g.startsWith('7')) hard++;
			else if (g.startsWith('8') || g.startsWith('9')) veryHard++;
		});

		const total = easy + medium + hard + veryHard;
		if (total === 0) return [];

		return [
			{ count: easy, percent: (easy / total) * 100, colorClass: 'bg-green-400', label: '< 6a' },
			{
				count: medium,
				percent: (medium / total) * 100,
				colorClass: 'bg-yellow-400',
				label: '6a - 6c+'
			},
			{
				count: hard,
				percent: (hard / total) * 100,
				colorClass: 'bg-orange-500',
				label: '7a - 7c+'
			},
			{
				count: veryHard,
				percent: (veryHard / total) * 100,
				colorClass: 'bg-fuchsia-500',
				label: '> 8a'
			}
		].filter((b) => b.count > 0);
	});
</script>

{#if distribution.length > 0}
	<div class="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
		{#each distribution as segment}
			<div
				class="h-full {segment.colorClass}"
				style="width: {segment.percent}%"
				title="{segment.label}: {segment.count} {$_('topo.routes')}"
			></div>
		{/each}
	</div>
	<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
		{#each distribution as segment}
			<div class="flex items-center gap-1.5 text-xs text-slate-600">
				<span class="h-2 w-2 rounded-full {segment.colorClass}"></span>
				<span class="font-medium">{segment.label}</span>
				<span class="text-slate-400">({segment.count})</span>
			</div>
		{/each}
	</div>
{/if}
