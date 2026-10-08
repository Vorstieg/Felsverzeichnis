<script lang="ts">
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { getTypeBadgeClass } from '$lib/assets/js/route-types.js';

	let { crag }: { crag: import('$lib/types/files').FelsLocation } = $props();

	let types = $derived(crag.entry.properties.type ?? []);
	let parts = $derived((crag.path || '').split('/').filter(Boolean));
</script>

<a
	href="{base}/map/crag/{crag.path}"
	class="group relative flex w-full items-center gap-3 border-b border-gray-100 py-3 transition-colors hover:bg-gray-50 sm:gap-4"
>
	<div class="flex h-full min-w-0 flex-1 flex-col justify-between">
		<div>
			<div
				class="mb-1 flex flex-wrap items-center text-[9px] font-medium tracking-wide sm:text-[10px]"
			>
				{#each parts as part, i}
					<span class="-mx-0.5 rounded px-0.5 text-slate-500 transition-colors">
						{part}
					</span>
					{#if i < parts.length - 1}
						<i class="fa-solid fa-chevron-right mx-1 text-[7px] text-slate-300"></i>
					{/if}
				{/each}
			</div>
			<h3
				class="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-blue-600 sm:text-lg"
			>
				{crag.entry.properties.name}
			</h3>
		</div>
		<div class="mt-2 flex flex-wrap gap-1.5">
			{#each types as type}
				<span
					class="rounded px-2 py-0.5 text-[9px] sm:text-[10px] {getTypeBadgeClass(
						type
					)} font-semibold tracking-wide uppercase"
				>
					{$_('types.' + type)}
				</span>
			{/each}
		</div>
	</div>
</a>
