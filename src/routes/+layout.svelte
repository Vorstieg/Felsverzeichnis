<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { siteTitle, siteLink } from '$lib/config.js';
	import { base } from '$app/paths';
	import '@fortawesome/fontawesome-free/css/fontawesome.css';
	import '@fortawesome/fontawesome-free/css/brands.css';
	import '@fortawesome/fontawesome-free/css/solid.css';

	import { _, locale } from 'svelte-i18n';
	import ClimbingMap from '$lib/components/ClimbingMap.svelte';

	let { children }: { children?: import('svelte').Snippet } = $props();

	let displayTitle = $derived($page.data.name || $_('site.title'));
	let displayDescription = $derived.by(() => {
		const d = $page.data;
		if ($locale === 'de') {
			return d.description_de || d.description || $_('site.long_description');
		} else {
			return d.description_en || d.description || $_('site.long_description');
		}
	});
</script>

<svelte:head>
	<title>{displayTitle}</title>
	<meta name="title" content={displayTitle} />
	<meta data-key="description" name="description" content={displayDescription} />
	<meta name="author" content={$page.data.meta?.author || 'Vorstieg Software FlexCo'} />
	<meta property="og:site_name" content="Vorstieg" />
	<meta property="og:type" content={$page.data.meta?.type || 'website'} />
	<meta property="og:url" content={$page.data.meta?.url} />
	<meta property="og:locale" content={$locale} />
	<meta property="og:title" content={displayTitle} />
	<meta property="og:description" content={displayDescription} />
	<meta name="twitter:title" content={displayTitle} />
	<meta name="twitter:description" content={displayDescription} />
	<link rel="stylesheet" href="{base}/css/vars.css" />
	<link rel="stylesheet" href="{base}/css/root.css" />
	<link rel="stylesheet" href="{base}/css/typography.css" />
	<link rel="stylesheet" href="{base}/css/layout.css" />
	<link rel="stylesheet" href="{base}/css/utilities.css" />
	<link rel="stylesheet" href="{base}/css/prism.css" />
	<link rel="icon" type="image/svg+xml" href="{base}/icon.svg" />
	<link rel="alternate" type="application/rss+xml" title={siteTitle} href="{siteLink}api/rss.xml" />
</svelte:head>

<div class="layout">
	<ClimbingMap
		locations={$page.data.locations ?? []}
		access={$page.data.access}
		topoPaths={$page.data.topoPaths}
		accessKey={$page.url.pathname +
			':' +
			($page.data.access?.features || []).map((feature) => feature.id || '').join(',')}
		cameraTarget={$page.data.cameraTarget}
		isHidden={$page.url.pathname.startsWith(`${base}/topo/`)}
	/>
	<main id="main" class="pointer-events-none overflow-auto" tabindex="-1">
		<div class="h-full">
			{@render children?.()}
		</div>
	</main>
</div>

<style></style>
