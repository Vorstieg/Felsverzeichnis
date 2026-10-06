<script>
	import { tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { downloadRouteGpx, getTourTracks } from '$lib/assets/js/route-gpx.js';

	let { route, tracks = [], fallbackAccessTracks = [] } = $props();
	let button = $state();
	let menu = $state();
	let open = $state(false);
	let menuTop = $state(0);
	let menuLeft = $state(0);
	let menuWidth = $state(320);
	let routeApproaches = $derived(tracks.filter((track) => track.role === 'approach'));
	let approaches = $derived(routeApproaches.length ? routeApproaches : fallbackAccessTracks);
	let descents = $derived(tracks.filter((track) => track.role === 'descent'));
	let approachOptions = $derived(approaches.length ? approaches : [null]);
	let descentOptions = $derived(descents.length ? descents : [null]);
	let optionCount = $derived(approachOptions.length * descentOptions.length);

	function portal(node) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	function positionMenu() {
		if (!button || !menu) return;
		const rect = button.getBoundingClientRect();
		menuWidth = Math.min(320, window.innerWidth - 16);
		menuLeft = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
		const menuHeight = menu.offsetHeight;
		const spaceBelow = window.innerHeight - rect.bottom - 8;
		const spaceAbove = rect.top - 8;
		menuTop =
			spaceBelow < menuHeight && spaceAbove > spaceBelow
				? Math.max(8, rect.top - menuHeight - 6)
				: rect.bottom + 6;
	}

	function closeMenu(restoreFocus = false) {
		open = false;
		if (restoreFocus) button?.focus();
	}

	function download(approachIndex, descentIndex) {
		const selectedTracks = getTourTracks(tracks, fallbackAccessTracks, approachIndex, descentIndex);
		const suffix = optionCount > 1 ? `-tour-${approachIndex + 1}-${descentIndex + 1}` : '-tour';
		downloadRouteGpx(route, selectedTracks, suffix, {
			startOfClimb: $_('gpx_waypoints.start_of_climb'),
			endOfClimb: $_('gpx_waypoints.end_of_climb')
		});
		closeMenu(true);
	}

	async function handleClick() {
		if (optionCount === 1) {
			download(0, 0);
			return;
		}
		if (open) {
			closeMenu();
			return;
		}
		open = true;
		await tick();
		positionMenu();
		menu?.querySelector('button')?.focus();
	}

	$effect(() => {
		if (!open) return;
		const handlePointerDown = (event) => {
			if (!button?.contains(event.target) && !menu?.contains(event.target)) closeMenu();
		};
		const handleKeydown = (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeMenu(true);
			}
		};
		document.addEventListener('pointerdown', handlePointerDown, true);
		document.addEventListener('keydown', handleKeydown);
		document.addEventListener('scroll', positionMenu, true);
		window.addEventListener('resize', positionMenu);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown, true);
			document.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('scroll', positionMenu, true);
			window.removeEventListener('resize', positionMenu);
		};
	});
</script>

<div data-gpx-control class="inline-flex shrink-0">
	<button
		bind:this={button}
		type="button"
		onclick={handleClick}
		aria-expanded={open}
		aria-haspopup={optionCount > 1 ? 'true' : undefined}
		aria-label="{$_('ui.download_tour_gpx')}: {route.name}"
		class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:border-blue-400 hover:bg-blue-100"
	>
		<i class="fa-solid fa-download" aria-hidden="true"></i>
		GPX
	</button>
	{#if open}
		<div
			use:portal
			bind:this={menu}
			role="group"
			aria-label={$_('ui.choose_tour_gpx')}
			class="fixed z-[30000] max-h-[min(20rem,calc(100vh-1rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl"
			style="top: {menuTop}px; left: {menuLeft}px; width: {menuWidth}px;"
		>
			<p class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
				{$_('ui.choose_tour_gpx')}
			</p>
			{#each approachOptions as approach, approachIndex}
				{#each descentOptions as descent, descentIndex}
					<button
						type="button"
						onclick={() => download(approachIndex, descentIndex)}
						class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500"
					>
						<span class="min-w-0">
							<span class="block text-sm font-semibold text-slate-800"
								>{approach?.name || route.name}</span
							>
							{#if descent}
								<span class="mt-0.5 block text-xs text-slate-500"
									>{$_('gpx_roles.descent')}: {descent.name}</span
								>
							{/if}
						</span>
						<i class="fa-solid fa-download shrink-0 text-blue-600" aria-hidden="true"></i>
					</button>
				{/each}
			{/each}
		</div>
	{/if}
</div>
