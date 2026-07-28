<script>
	import ClimbingMap from '$lib/components/ClimbingMap.svelte';
	import { page } from '$app/stores';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();
</script>

<ClimbingMap
	locations={$page.data.locations}
	cameraTarget={$page.data.cameraTarget}
></ClimbingMap>
{@render children?.()}
