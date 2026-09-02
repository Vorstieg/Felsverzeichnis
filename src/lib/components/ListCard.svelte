<script>
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { normalizeTypes, getTypeBadgeClass } from '$lib/assets/js/route-types.js';

	/** @type {{crag: any}} */
	let { crag } = $props();

	let types = $derived(normalizeTypes(crag.properties.type));
	let parts = $derived((crag.properties.path || '').split('/').filter(Boolean));
</script>

<a href="{base}/map/crag/{crag.properties.path}" class="flex gap-3 sm:gap-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group relative w-full items-center">
	<div class="flex flex-col justify-between flex-1 min-w-0 h-full">
		<div>
			<div class="flex flex-wrap items-center text-[9px] sm:text-[10px] mb-1 font-medium tracking-wide">
				{#each parts as part, i}
					{@const subpath = parts.slice(0, i + 1).join('/')}
					<span class="text-slate-500 transition-colors px-0.5 -mx-0.5 rounded">
						{part}
					</span>
					{#if i < parts.length - 1}
						<i class="fa-solid fa-chevron-right text-[7px] mx-1 text-slate-300"></i>
					{/if}
				{/each}
			</div>
			<h3 class="font-bold text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors truncate">
				{crag.properties.name}
			</h3>
		</div>
		<div class="flex flex-wrap gap-1.5 mt-2">
			{#each types as type}
				<span class="text-[9px] sm:text-[10px] px-2 py-0.5 rounded {getTypeBadgeClass(type)} font-semibold uppercase tracking-wide">
					{$_('types.' + type)}
				</span>
			{/each}
		</div>
	</div>
</a>
