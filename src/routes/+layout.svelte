<script>
	import '../app.css';
	import { page } from '$app/stores';
	import { siteTitle, siteLink } from '$lib/config.js';
	import { base } from '$app/paths';
	import '@fortawesome/fontawesome-free/css/fontawesome.css';
	import '@fortawesome/fontawesome-free/css/brands.css';
	import '@fortawesome/fontawesome-free/css/solid.css';

	import { _, locale } from 'svelte-i18n';

	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();

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
	<meta name="author" content="{$page.data.meta?.author || 'Vorstieg Software FlexCo'}" />
	<meta property="og:site_name" content="Vorstieg" />
	<meta property="og:type" content="{$page.data.meta?.type || 'website'}" />
	<meta property="og:url" content={$page.data.meta?.url} />
	<meta property="og:locale" content={$locale} />
	<meta property="og:title" content={displayTitle} />
	<meta property="og:description" content={displayDescription} />
	<meta name="twitter:title" content={displayTitle} />
	<meta name="twitter:description" content={displayDescription} />
	<meta property="og:image" content={$page.data.meta?.image} />
	<meta property="og:image:secure_url" content={$page.data.meta?.image} />
	<meta property="og:image:type" content="image/jpg" />
	<meta property="og:image:width" content="1707" />
	<meta property="og:image:height" content="1233" />
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
	<div class="fixed w-full sm:w-auto bottom-[env(safe-area-inset-bottom,0px)] sm:bottom-5 p-0 sm:p-2 sm:left-5 z-[50000]">
		<div class="row h-16 sm:h-auto flex w-full bg-white justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] sm:shadow-md border-t-1 sm:border-1 border-gray-200 rounded-none sm:rounded-full">
			<a href="{base}/map"
				 class="group flex flex-col items-center justify-center sm:flex sm:w-auto w-1/3 cursor-pointer rounded-none sm:rounded-full sm:rounded-r-none bg-white py-1.5 sm:py-3 px-2 sm:px-6 text-center text-[11px] sm:text-sm transition-all duration-200 active:scale-95 active:bg-slate-50 sm:active:scale-100 sm:hover:shadow-lg text-slate-600 sm:hover:text-white sm:hover:bg-ink {($page.url.pathname.startsWith(base + '/map') || $page.url.pathname === base + '/') ? 'sm:bg-slate-200' : ''}">
				<div class="sm:hidden flex items-center justify-center w-16 h-8 rounded-full transition-all duration-200 group-active:scale-90 mb-0.5 {($page.url.pathname.startsWith(base + '/map') || $page.url.pathname === base + '/') ? 'bg-blue-100 text-blue-700' : 'text-slate-600 group-hover:bg-slate-100'}">
					<i class="font-semibold fa-solid fa-map-location-dot text-[18px]"></i>
				</div>
				<span class="font-medium leading-tight transition-transform duration-200 group-active:scale-95 sm:font-semibold {($page.url.pathname.startsWith(base + '/map') || $page.url.pathname === base + '/') ? 'text-blue-800 font-bold sm:font-bold sm:text-ink' : ''}">{$_('menu.map')}</span>
			</a>
			<a href="{base}/list"
				 class="group flex flex-col items-center justify-center sm:flex sm:w-auto w-1/3 cursor-pointer bg-white rounded-none sm:border-l sm:border-r border-slate-200 py-1.5 sm:py-3 px-2 sm:px-6 text-center text-[11px] sm:text-sm transition-all duration-200 active:scale-95 active:bg-slate-50 sm:active:scale-100 sm:hover:shadow-lg text-slate-600 sm:hover:text-white sm:hover:bg-ink {$page.url.pathname.startsWith(base + '/list') ? 'sm:bg-slate-200' : ''}">
				<div class="sm:hidden flex items-center justify-center w-16 h-8 rounded-full transition-all duration-200 group-active:scale-90 mb-0.5 {$page.url.pathname.startsWith(base + '/list') ? 'bg-blue-100 text-blue-700' : 'text-slate-600 group-hover:bg-slate-100'}">
					<i class="font-semibold fa-solid fa-list-ul text-[18px]"></i>
				</div>
				<span class="font-medium leading-tight transition-transform duration-200 group-active:scale-95 sm:font-semibold {$page.url.pathname.startsWith(base + '/list') ? 'text-blue-800 font-bold sm:font-bold sm:text-ink' : ''}">{$_('menu.list')}</span>
			</a>
			<a href="{base}/about"
				 class="group flex flex-col items-center justify-center sm:flex sm:w-auto w-1/3 cursor-pointer bg-white rounded-none sm:rounded-full sm:rounded-l-none py-1.5 sm:py-3 px-2 sm:px-6 text-center text-[11px] sm:text-sm transition-all duration-200 active:scale-95 active:bg-slate-50 sm:active:scale-100 sm:hover:shadow-lg text-slate-600 sm:hover:text-white sm:hover:bg-ink {$page.url.pathname.startsWith(base + '/about') ? 'sm:bg-slate-200' : ''}">
				<div class="sm:hidden flex items-center justify-center w-16 h-8 rounded-full transition-all duration-200 group-active:scale-90 mb-0.5 {$page.url.pathname.startsWith(base + '/about') ? 'bg-blue-100 text-blue-700' : 'text-slate-600 group-hover:bg-slate-100'}">
					<i class="font-semibold fa-solid fa-circle-info text-[18px]"></i>
				</div>
				<span class="font-medium leading-tight transition-transform duration-200 group-active:scale-95 sm:font-semibold {$page.url.pathname.startsWith(base + '/about') ? 'text-blue-800 font-bold sm:font-bold sm:text-ink' : ''}">{$_('menu.info')}</span>
			</a>
		</div>
	</div>
	<main id="main" class="overflow-auto" tabindex="-1">
		{@render children?.()}
	</main>
</div>
<style></style>
