<script>
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { normalizeTypes, getTypeBadgeClass } from '$lib/assets/js/route-types.js';

	/** @type {{crag: any}} */
	let { crag } = $props();

	let types = $derived(normalizeTypes(crag.properties.type));
	let parts = $derived((crag.properties.path || '').split('/').filter(Boolean));
</script>

<div class="relative flex bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 overflow-hidden h-28 sm:h-32 text-slate-800 group">
	<a href="{base}/map/crag/{crag.properties.path}#16/{crag.geometry.coordinates[1]}/{crag.geometry.coordinates[0]}" class="absolute inset-0 z-10" aria-label="{crag.properties.name}"></a>
	{#if crag.properties.previewImage}
		<img src="{crag.properties.previewImage}" alt="{crag.properties.name}" class="w-28 sm:w-36 h-full object-cover shrink-0 border-r border-slate-100" />
	{/if}
	<div class="p-3 sm:p-4 flex flex-col justify-between flex-1 min-w-0">
		<div>
			<div class="relative z-20 flex flex-wrap items-center text-[10px] sm:text-xs mb-1 font-medium tracking-wide">
				{#each parts as part, i}
					{@const subpath = parts.slice(0, i + 1).join('/')}
					<a href="{base}/list/{encodeURIComponent(subpath)}" class="text-slate-500 hover:text-slate-700 hover:underline transition-colors px-0.5 -mx-0.5 rounded focus:outline-none focus:ring-2 focus:ring-slate-400">
						{part}
					</a>
					{#if i < parts.length - 1}
						<i class="fa-solid fa-chevron-right text-[8px] mx-1.5 text-slate-300"></i>
					{/if}
				{/each}
			</div>
			<h3 class="font-bold text-base sm:text-lg text-slate-800 group-hover:text-blue-600 transition-colors truncate relative z-0">
				{crag.properties.name}
			</h3>
		</div>
		<div class="flex flex-wrap gap-1 mt-auto relative z-20">
			{#each types as type}
				<a href="{base}/list/{type}" class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full {getTypeBadgeClass(type)} font-medium border border-transparent hover:opacity-80 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400">
					{$_('types.' + type)}
				</a>
			{/each}
		</div>
	</div>
</div>
