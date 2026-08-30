<script>
	import { base } from '$app/paths';
	import { types } from '$lib/config';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import InfoPanel from '$lib/components/ui/InfoPanel.svelte';
	import CragList from '$lib/components/CragList.svelte';
	import { searchSuggestionsActive } from '$lib/stores/search.js';
	import { getTypeDotClass } from '$lib/assets/js/route-types.js';

	/** @type {{data: any}} */
	let { data } = $props();

	let search = $derived(data.search);
	let searchTerm = $state(data.search);

	$effect(() => {
		searchTerm = data.search;
	});

	function resetSearch() {
		searchTerm = '';
		goto(`${base}/map`);
	}

	function portal(node) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	async function share() {
		await navigator.share({
			title: 'Search Results',
			url: window.location.href
		});
	}
</script>

<svelte:head>
	<title>{$_('site.title')}</title>
</svelte:head>


{#if data.locations && data.locations.length > 1}
	<InfoPanel onShare={share} hideCloseOnDesktop={true}>
		<div class="px-5 pt-6 pb-2">
			<h2 class="text-xl font-bold text-slate-800">
				{data.locations.length} {$_('ui.results', { default: 'Results' })}
			</h2>
		</div>
		<div class="flex-1 overflow-y-auto px-5 pb-4">
			<CragList crags={data.locations} isCompact={true} />
		</div>
	</InfoPanel>
{/if}
