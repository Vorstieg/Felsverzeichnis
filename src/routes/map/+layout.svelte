<script>
	import ClimbingMap from '$lib/components/ClimbingMap.svelte';
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import { page, navigating } from '$app/stores';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();

	let showPanel = $derived(
		$page.url.pathname.startsWith(`${base}/map/crag/`) || 
		$page.url.pathname.match(/\/map\/.+/) !== null || // any other map subroute like /map/[search]
		$navigating?.to?.url?.pathname?.startsWith(`${base}/map/crag/`)
	);

	let isSearchRoute = $derived(!!$page.params.search);
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

<ClimbingMap
	locations={$page.data.locations}
	access={$page.data.access}
	topoPaths={$page.data.topoPaths}
	accessKey={$page.url.pathname + ':' + (($page.data.access?.features || []).map((feature) => feature.id || '').join(','))}
	cameraTarget={$page.data.cameraTarget}
></ClimbingMap>

<div class="fixed top-2 right-0 left-0 z-[1000] h-fit overflow-visible py-2 sm:top-21 sm:left-26 sm:w-auto pointer-events-none">
	<div class="pointer-events-auto">
		<SearchBar actionBase="/map" searchTerm={currentSearchTerm} showClear={isSearchRoute} onClear={resetSearch} />
	</div>
</div>

{#if showPanel && ($page.url.pathname !== `${base}/map` || $navigating?.to?.url?.pathname !== `${base}/map`)}
	<InfoPanel closeUrl="{base}/map" onShare={share}>
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
