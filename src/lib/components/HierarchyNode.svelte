<script>
	import { base } from '$app/paths';
	import { slide } from 'svelte/transition';
	import { _ } from 'svelte-i18n';
	import HierarchyNode from './HierarchyNode.svelte';

	let { node, depth = 0 } = $props();
	
	let isOpen = $state(depth < 2); // open root and first level by default
	
	let hasChildren = $derived(Object.keys(node.children).length > 0);
	let isCrag = $derived(node.crag && !hasChildren);
	
	function getCragRouteCount(crag) {
		let total = 0;
		if (crag.properties?.sectors) {
			for (const sector of crag.properties.sectors) {
				total += sector.routes?.length || 0;
			}
		}
		return total;
	}
</script>

<div class="my-1 {depth > 0 ? 'ml-4 sm:ml-6 border-l-2 border-slate-100 pl-2 sm:pl-4' : ''}">
	{#if isCrag}
		<a href="{base}/map/crag/{node.crag.properties.path}" class="block py-2.5 px-3 hover:bg-blue-50/50 rounded-xl group transition-all border border-transparent hover:border-blue-100 no-underline">
			<div class="flex items-center gap-3 sm:gap-4">
				<div class="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 group-hover:bg-white group-hover:border-blue-200 group-hover:text-blue-500 flex items-center justify-center shrink-0 transition-all shadow-sm">
					<i class="fa-solid fa-mountain"></i>
				</div>
				<div class="flex-1 min-w-0">
					<div class="font-bold text-slate-800 group-hover:text-blue-700 transition-colors truncate text-sm sm:text-base">
						{node.name}
					</div>
					{#if node.crag.properties.sectors?.length}
						<div class="flex items-center gap-2 mt-0.5 text-[10px] sm:text-xs font-medium text-slate-500">
							<span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
								{node.crag.properties.sectors.length} {node.crag.properties.sectors.length === 1 ? $_('ui.sector') : $_('ui.sectors')}
							</span>
							{#if getCragRouteCount(node.crag) > 0}
								<span class="text-slate-400">&bull;</span>
								<span>{getCragRouteCount(node.crag)} {$_('topo.routes')}</span>
							{/if}
						</div>
					{/if}
				</div>
				<i class="fa-solid fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors text-xs shrink-0 pr-2"></i>
			</div>
		</a>
	{:else}
		<button 
			onclick={() => isOpen = !isOpen}
			class="w-full text-left py-2.5 px-3 hover:bg-slate-50 rounded-xl flex items-center justify-between group transition-colors border border-transparent"
		>
			<div class="flex items-center gap-3 sm:gap-4">
				<div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-slate-200 group-hover:text-slate-700 transition-colors shadow-sm border border-slate-200/60">
					<i class="fa-solid {isOpen ? 'fa-folder-open' : 'fa-folder'}"></i>
				</div>
				<div>
					<span class="font-bold text-slate-800 text-sm sm:text-base group-hover:text-slate-900 transition-colors">{node.name}</span>
					<div class="text-[10px] sm:text-xs font-medium text-slate-500 mt-0.5">
						{Object.keys(node.children).length} {$_('ui.areas', { default: 'Areas' })}
					</div>
				</div>
			</div>
			<div class="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors mr-1 shrink-0">
				<i class="fa-solid fa-chevron-down text-slate-400 group-hover:text-slate-600 transition-transform duration-300 text-[10px] {isOpen ? 'rotate-180' : ''}"></i>
			</div>
		</button>
		
		{#if isOpen}
			<div transition:slide={{ duration: 250, axis: 'y' }}>
				{#each Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name)) as child}
					<HierarchyNode node={child} depth={depth + 1} />
				{/each}
			</div>
		{/if}
	{/if}
</div>
