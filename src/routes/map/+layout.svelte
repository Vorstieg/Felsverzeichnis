<script>
	import ClimbingMap from '$lib/components/ClimbingMap.svelte';
	import { page } from '$app/stores';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();
</script>

<ClimbingMap
	locations={$page.data.locations}
	access={$page.data.access}
	topoPaths={$page.data.topoPaths}
	accessKey={$page.url.pathname + ':' + (($page.data.access?.features || []).map((feature) => feature.id || '').join(','))}
	cameraTarget={$page.data.cameraTarget}
></ClimbingMap>
{@render children?.()}
