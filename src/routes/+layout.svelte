<script>
	import '../app.css';
	import { page } from '$app/stores';
	import { siteTitle, siteLink } from '$lib/config.js';
	import { base } from '$app/paths';
	import '@fortawesome/fontawesome-free/css/fontawesome.css';
	import '@fortawesome/fontawesome-free/css/brands.css';
	import '@fortawesome/fontawesome-free/css/solid.css';

	import { init, addMessages, _, locale, getLocaleFromNavigator } from 'svelte-i18n';
	import en from '$lib/i18n/locales/en.json';
	import de from '$lib/i18n/locales/de.json';

	addMessages('en', en);
	addMessages('de', de);

	import { browser } from '$app/environment';

	init({
		fallbackLocale: 'de',
		initialLocale: browser ? getLocaleFromNavigator() : 'de'
	});

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
	<link rel="icon" href="{base}/favicon.png" />
	<link rel="alternate" type="application/rss+xml" title={siteTitle} href="{siteLink}api/rss.xml" />
</svelte:head>

<div class="layout">
    <div class="fixed w-full sm:w-auto bottom-0 sm:bottom-auto p-2 sm:right-10 sm:top-5 z-[3000]">
        <div class="row h-16 sm:h-auto flex w-full bg-white justify-center shadow-md border-1 border-gray-200 rounded-full">
            <a href="{base}/map"
                 class="font-semibold grid sm:w-auto w-1/3 cursor-pointer rounded-full bg-white rounded-r-none py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
                 type="button">
                <i class="font-semibold sm:hidden! fa-solid fa-map-location-dot mb-2"></i>
                {$_('menu.map')}
            </a>
            <a href="{base}/list"
                 class="font-semibold grid sm:w-auto w-1/3 cursor-pointer bg-white rounded-none sm:border-l sm:border-r border-slate-200 py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
                 type="button">
                <i class="font-semibold sm:hidden! fa-solid fa-list-ul mb-2"></i>
                {$_('menu.list')}
            </a>
            <a href="{base}/about"
                 class="font-semibold grid sm:w-auto w-1/3 cursor-pointer bg-white rounded-full rounded-l-none border-l border-slate-200 py-3 px-6 text-center text-sm transition-all hover:shadow-lg text-slate-600 hover:text-white hover:bg-ink active focus:font-bold active:font-bold"
                 type="button">
                <i class="font-semibold sm:hidden! fa-solid fa-circle-info mb-2"></i>
                {$_('menu.info')}
            </a>
        </div>
    </div>
	<div class="absolute hidden h-fit fixed w-full sm:block sm:w-auto bottom-0 sm:bottom-auto p-2 left-5 sm:left-15 top-4 z-[1000]">
		<span class="text-4xl md:text-5xl font-black text-stroke-8 text-stroke-white">{$_('site.title')}</span>
	</div>
	<main id="main" class="overflow-auto" tabindex="-1">
		{@render children?.()}
	</main>
</div>
<style></style>
