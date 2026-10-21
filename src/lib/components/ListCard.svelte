<script lang="ts">
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { getTypeBadgeClass } from '$lib/assets/js/route-types.js';

	let { crag }: { crag: import('$lib/types/files').FelsLocation } = $props();

	let types = $derived(crag.entry.properties.type ?? []);
	let parts = $derived((crag.path || '').split('/').filter(Boolean));
</script>

<div
	class="group relative flex w-full items-center gap-3 border-b border-gray-100 py-3 transition-colors hover:bg-gray-50/80 sm:gap-4"
>
	<a
		href="{base}/map/crag/{crag.path}"
		class="absolute inset-0 z-0"
		aria-label="{crag.entry.properties.name}"
		tabindex="-1"
	></a>
	<div class="relative z-10 flex h-full min-w-0 flex-1 flex-col justify-between">
		<div>
			<div
				class="no-scrollbar mb-1.5 flex flex-wrap items-center gap-1 overflow-x-auto text-xs font-medium tracking-wide sm:text-sm"
			>
				{#each parts as part, i}
					{@const subpath = parts.slice(0, i + 1).join('/')}
					{@const isLast = i === parts.length - 1}
					<a
						href={isLast
							? `${base}/map/crag/${crag.path}`
							: `${base}/map/${encodeURIComponent(subpath)}`}
						class="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium no-underline transition-all sm:px-2.5 sm:py-0.5 {isLast
							? 'bg-slate-200/80 font-bold text-slate-800'
							: 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 active:scale-95'}"
						onclick={(e) => e.stopPropagation()}
					>
						{isLast && crag.entry.properties.name ? crag.entry.properties.name : part}
					</a>
					{#if i < parts.length - 1}
						<i class="fa-solid fa-chevron-right shrink-0 text-[8px] text-slate-300 sm:text-[10px]"></i>
					{/if}
				{/each}
			</div>
			<a href="{base}/map/crag/{crag.path}" class="block truncate no-underline">
				<h3
					class="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-blue-600 sm:text-lg"
				>
					{crag.entry.properties.name}
				</h3>
			</a>
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
</div>
