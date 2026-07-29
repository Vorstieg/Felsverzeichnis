<script>
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';

	let loading = $state(false);
	let { path, mode } = $props();
</script>
<a
	href="{base}/topo/crag/{path}?mode={mode}"
	onclick={() => loading = true}
	class="group relative flex h-24 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white no-underline shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-blue-300 hover:bg-slate-50 hover:shadow-xl hover:ring-8 hover:ring-blue-500/5"
>
	<div class="z-10 flex flex-row items-center gap-2 px-2 sm:gap-3">
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-50"
		>
			{#if loading}
				<i class="fa-solid fa-spinner fa-spin text-xl text-blue-600"></i>
			{:else if mode === '3d'}
				<i class="fa-solid fa-cube text-xl text-blue-600"></i>
			{:else}
				<i class="fa-solid fa-image text-xl text-blue-600"></i>
			{/if}
		</div>
		<div class="flex flex-col">
													<span
														class="text-base leading-tight font-bold text-slate-800 transition-colors group-hover:text-blue-700 sm:text-lg"
													>{$_('ui.topo_' + mode)}</span
													>
			<span class="text-xs font-medium text-slate-500 sm:text-sm"
			>{$_('ui.topo_description_' + mode)}</span
			>
		</div>
	</div>
</a>
