<script>
	import ClimbingMap from '$lib/components/ClimbingMap.svelte';
	import { page } from '$app/stores';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();
</script>

<ClimbingMap tracks={$page.data.tracks} locations={$page.data.locations} zoom={$page.data.zoom} center={$page.data.center}
						 zoomToLocations={$page.data.zoomToLocations} detailsShown={$page.data.detailsShown}></ClimbingMap>
{@render children?.()}