<script>

	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import { page, navigating } from '$app/stores';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();

	let currentPathname = $derived(
		$navigating?.to?.url?.pathname?.startsWith(`${base}/map/`) 
			? $navigating.to.url.pathname 
			: $page.url.pathname
	);
	let showPanel = $derived(
		currentPathname.startsWith(`${base}/map/`) && currentPathname !== `${base}/map/`
	);
	
	let isAboutRoute = $derived(currentPathname.endsWith('/about'));
	let isSearchRoute = $derived(!!$page.params.search);
	let panelBreak = $derived((isAboutRoute || isSearchRoute) ? 'top' : 'middle');

	let currentSearchTerm = $derived($page.params.search || '');

	function resetSearch() {
		goto(`${base}/map`);
	}

	function share() {
		if (navigator.share) {
			navigator.share({ title: 'Felsverzeichnis', url: window.location.href });
		}
	}
</script>



<div class="pointer-events-none fixed left-0 right-0 top-2 z-[1000] h-fit overflow-visible py-2 sm:top-3 sm:w-auto">
	<div class="pointer-events-auto mx-4 sm:mx-0 sm:ml-8 sm:w-[30vw] sm:max-w-64 md:max-w-72 lg:max-w-80">
		<SearchBar actionBase={`${base}/map`} searchTerm={currentSearchTerm} showClear={isSearchRoute} onClear={resetSearch} containerClass="w-full" />
	</div>
</div>

{#if showPanel}
	<InfoPanel closeUrl="{base}/map" onShare={share} initialBreak={panelBreak}>
		{#if $navigating && $navigating.to?.url?.pathname?.startsWith(`${base}/map/crag/`)}
			<div class="px-5 pt-6 pb-2">
				<div class="flex animate-pulse flex-col space-y-4 pt-4">
					<div class="h-8 w-3/4 rounded bg-slate-200"></div>
					<div class="h-40 w-full rounded-2xl bg-slate-200"></div>
					<div class="h-4 w-5/6 rounded bg-slate-200"></div>
					<div class="h-4 w-3/4 rounded bg-slate-200"></div>
					<div class="h-4 w-1/2 rounded bg-slate-200"></div>
					<div class="mt-4 h-10 w-full rounded-full bg-slate-200"></div>
					<div class="h-10 w-full rounded-full bg-slate-200"></div>
				</div>
			</div>
		{:else}
			{@render children?.()}
		{/if}
	</InfoPanel>
{:else}
	{@render children?.()}
{/if}
