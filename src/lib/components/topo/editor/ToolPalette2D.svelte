<script>
	import { isMobileViewport } from '$lib/assets/js/mobile-utils.js';
	import { onMount } from 'svelte';

	let {
		activeTool = $bindable('route'),
		selectedSymbol = $bindable('bolt'),
		hasPendingChanges = false,
		onFinishRoute = null,
		onCancelAction = null
	} = $props();

	import { vibrateOnAction } from '$lib/assets/js/mobile-utils.js';
	import { topoSymbols } from '$lib/assets/js/topo-utils.js';
	import { _ } from 'svelte-i18n';

	let isMobile = $state(false);

	onMount(() => {
		isMobile = isMobileViewport();
		const handleResize = () => {
			isMobile = isMobileViewport();
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	function handleFinish(e) {
		e?.stopPropagation?.();
		e?.preventDefault?.();
		vibrateOnAction('light');
		if (onFinishRoute) {
			onFinishRoute();
		}
	}

	function handleCancel(e) {
		e?.stopPropagation?.();
		e?.preventDefault?.();
		vibrateOnAction('light');
		if (onCancelAction) {
			onCancelAction();
		}
	}

	let showSymbolPicker = $state(false);
	const fixpoints = topoSymbols.filter((s) => s.type === 'fixpoint');
	const features = topoSymbols.filter((s) => s.type === 'feature');

	function toggleTool(tool, category) {
		if (activeTool === tool) {
			activeTool = null;
			showSymbolPicker = false;
		} else {
			activeTool = tool;
			// If switching to a symbol tool, ensure the selected symbol is from that category
			const categorySymbols = category === 'fixpoint' ? fixpoints : features;
			if (!categorySymbols.some((s) => s.id === selectedSymbol)) {
				selectedSymbol = categorySymbols[0].id;
			}
			showSymbolPicker = true;
		}
	}
</script>

<!-- Mobile compact mode -->
{#if isMobile}
	<div
		class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-2xl shadow-lg p-3 border border-gray-200 flex gap-2 items-center z-50"
	>
		<!-- Tools -->
		<button
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool ===
			'route'
				? 'bg-blue-100 text-blue-700'
				: 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => (activeTool = activeTool === 'route' ? null : 'route')}
			title={$_('ui.route')}
		>
			<i class="fa-solid fa-route"></i>
		</button>

		<button
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool ===
			'outline'
				? 'bg-amber-100 text-amber-700'
				: 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => (activeTool = activeTool === 'outline' ? null : 'outline')}
			title={$_('ui.outline')}
		>
			<i class="fa-solid fa-draw-polygon"></i>
		</button>

		<button
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool ===
			'fixpoint'
				? 'bg-blue-100 text-blue-700'
				: 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => toggleTool('fixpoint', 'fixpoint')}
			title={$_('ui.fixpoints')}
		>
			<i class="fa-solid fa-circle-dot"></i>
		</button>

		<button
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool ===
			'symbol'
				? 'bg-blue-100 text-blue-700'
				: 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => toggleTool('symbol', 'feature')}
			title={$_('ui.symbol')}
		>
			<i class="fa-solid fa-icons"></i>
		</button>

		<button
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool ===
			'eraser'
				? 'bg-pink-100 text-pink-700'
				: 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => (activeTool = activeTool === 'eraser' ? null : 'eraser')}
			title={$_('ui.delete')}
		>
			<i class="fa-solid fa-eraser"></i>
		</button>

		<!-- Divider -->
		<div class="w-px h-8 bg-gray-300"></div>

		<!-- Action buttons -->
		{#if hasPendingChanges}
			<button
				class="w-12 h-12 flex items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 active:bg-green-200 transition-colors"
				onclick={handleFinish}
				ontouchend={handleFinish}
				title="{$_('ui.finish')} (N)"
			>
				<i class="fa-solid fa-check"></i>
			</button>

			<button
				class="w-12 h-12 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 transition-colors"
				onclick={handleCancel}
				ontouchend={handleCancel}
				title="{$_('ui.cancel')} (Esc)"
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		{/if}
	</div>

	<!-- Symbol picker for mobile -->
	{#if showSymbolPicker && (activeTool === 'symbol' || activeTool === 'fixpoint')}
		<div
			class="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-2xl shadow-lg p-3 border border-gray-200 z-50"
		>
			<div class="grid grid-cols-4 gap-2">
				{#each activeTool === 'fixpoint' ? fixpoints : features as symbol}
					<button
						class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors {selectedSymbol ===
						symbol.id
							? 'bg-blue-100 border-blue-300'
							: 'bg-white border-gray-200 hover:bg-gray-50'}"
						onclick={() => {
							selectedSymbol = symbol.id;
							showSymbolPicker = false;
						}}
						title={$_(`topo.fixpoints.${symbol.id}`)}
					>
						<img src={symbol.icon} alt={symbol.name} class="w-8 h-8" />
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Desktop mode -->
{:else}
	<div class="bg-white rounded-2xl shadow-md p-4 border border-gray-200">
		<h4 class="text-xs font-bold text-gray-500 uppercase mb-3">{$_('ui.tools')}</h4>

		<div class="flex flex-col gap-2">
			<button
				class="flex items-center gap-2 font-semibold shadow-sm border-1 cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool ===
				'route'
					? 'bg-blue-100 border-blue-300 text-blue-700'
					: 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => (activeTool = activeTool === 'route' ? null : 'route')}
			>
				<i class="fa-solid fa-route"></i>
				<span>{$_('ui.route')}</span>
			</button>

			<button
				class="flex items-center gap-2 font-semibold shadow-sm border-1 cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool ===
				'outline'
					? 'bg-amber-100 border-amber-300 text-amber-700'
					: 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => (activeTool = activeTool === 'outline' ? null : 'outline')}
			>
				<i class="fa-solid fa-draw-polygon"></i>
				<span>{$_('ui.outline')}</span>
			</button>

			<button
				class="flex items-center gap-2 font-semibold shadow-sm border cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool ===
				'fixpoint'
					? 'bg-blue-100 border-blue-300 text-blue-700'
					: 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => toggleTool('fixpoint', 'fixpoint')}
			>
				<i class="fa-solid fa-circle-dot"></i>
				<span>{$_('ui.fixpoints')}</span>
			</button>

			{#if showSymbolPicker && activeTool === 'fixpoint'}
				<div class="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded-lg">
					{#each fixpoints as symbol}
						<button
							class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors {selectedSymbol ===
							symbol.id
								? 'bg-blue-100 border-blue-300'
								: 'bg-white border-gray-200 hover:bg-gray-50'}"
							onclick={() => (selectedSymbol = symbol.id)}
							title={$_(`topo.fixpoints.${symbol.id}`)}
						>
							<img src={symbol.icon} alt={symbol.name} class="w-6 h-6" />
							<span class="text-[10px] text-gray-600">{$_(`topo.fixpoints.${symbol.id}`)}</span>
						</button>
					{/each}
				</div>
			{/if}

			<button
				class="flex items-center gap-2 font-semibold shadow-sm border cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool ===
				'symbol'
					? 'bg-blue-100 border-blue-300 text-blue-700'
					: 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => toggleTool('symbol', 'feature')}
			>
				<i class="fa-solid fa-icons"></i>
				<span>{$_('ui.symbol')}</span>
			</button>

			{#if showSymbolPicker && activeTool === 'symbol'}
				<div class="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded-lg">
					{#each features as symbol}
						<button
							class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors {selectedSymbol ===
							symbol.id
								? 'bg-blue-100 border-blue-300'
								: 'bg-white border-gray-200 hover:bg-gray-50'}"
							onclick={() => (selectedSymbol = symbol.id)}
							title={$_(`topo.fixpoints.${symbol.id}`)}
						>
							<img src={symbol.icon} alt={symbol.name} class="w-6 h-6" />
							<span class="text-[10px] text-gray-600">{$_(`topo.fixpoints.${symbol.id}`)}</span>
						</button>
					{/each}
				</div>
			{/if}

			<button
				class="flex items-center gap-2 font-semibold shadow-sm border cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool ===
				'eraser'
					? 'bg-pink-100 border-pink-300 text-pink-700'
					: 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => (activeTool = activeTool === 'eraser' ? null : 'eraser')}
			>
				<i class="fa-solid fa-eraser"></i>
				<span>{$_('ui.delete')}</span>
			</button>
		</div>

		<div class="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
			<p><kbd class="px-1 py-0.5 bg-gray-100 rounded">N</kbd> {$_('ui.finish')}</p>
			<p><kbd class="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd> {$_('ui.cancel')}</p>
		</div>
	</div>
{/if}
