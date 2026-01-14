<script>
	import { isMobileViewport } from '$lib/assets/js/mobile-utils.js';
	import { onMount } from 'svelte';

	let { activeTool = $bindable('route'), selectedSymbol = $bindable('bolt'), 
		  onFinishRoute = null, onCancelAction = null } = $props();

	import { vibrateOnAction } from '$lib/assets/js/mobile-utils.js';

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

	const symbols = [
		{ type: 'crack', label: 'Riss', icon: '/icons/topo-symbols/crack.svg' },
		{ type: 'chimney', label: 'Kamin', icon: '/icons/topo-symbols/chimney.svg' },
		{ type: 'slab', label: 'Platte', icon: '/icons/topo-symbols/slab.svg' },
		{ type: 'bolt', label: 'Bohrhaken', icon: '/icons/topo-symbols/bolt.svg' },
		{ type: 'overhang', label: 'Überhang', icon: '/icons/topo-symbols/overhang.svg' },
		{ type: 'tree', label: 'Baum', icon: '/icons/topo-symbols/tree.svg' },
		{ type: 'rubble', label: 'Geröll', icon: '/icons/topo-symbols/rubble.svg' },
		{ type: 'crux', label: 'Crux', icon: '/icons/topo-symbols/crux.svg' },
		{ type: 'piton', label: 'Haken', icon: '/icons/topo-symbols/piton.svg' },
		{ type: 'belay', label: 'Stand', icon: '/icons/topo-symbols/belay.svg' },
		{ type: 'abseil', label: 'Abseilstelle', icon: '/icons/topo-symbols/abseil.svg' }
	];

	let showSymbolPicker = $state(false);

	onMount(() => {
		isMobile = isMobileViewport();
		const handleResize = () => {
			isMobile = isMobileViewport();
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>

<!-- Mobile compact mode -->
{#if isMobile}
	<div class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-2xl shadow-lg p-3 border border-gray-200 flex gap-2 items-center z-50">
		<!-- Tools -->
		<button 
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool === 'route' ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => activeTool = 'route'}
			title="Route"
		>
			<i class="fa-solid fa-route"></i>
		</button>

		<button 
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool === 'outline' ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => activeTool = 'outline'}
			title="Umriss"
		>
			<i class="fa-solid fa-draw-polygon"></i>
		</button>

		<button 
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool === 'symbol' ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => { activeTool = 'symbol'; showSymbolPicker = !showSymbolPicker; }}
			title="Symbol"
		>
			<i class="fa-solid fa-icons"></i>
		</button>

		<button 
			class="w-12 h-12 flex items-center justify-center rounded-full transition-colors {activeTool === 'eraser' ? 'bg-pink-100 text-pink-700' : 'bg-white text-slate-600 hover:bg-gray-50'}"
			onclick={() => activeTool = 'eraser'}
			title="Löschen"
		>
			<i class="fa-solid fa-eraser"></i>
		</button>

		<!-- Divider -->
		<div class="w-px h-8 bg-gray-300"></div>

		<!-- Action buttons -->
		<button 
			class="w-12 h-12 flex items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 active:bg-green-200 transition-colors"
			onclick={handleFinish}
			ontouchend={handleFinish}
			title="Beenden (N)"
		>
			<i class="fa-solid fa-check"></i>
		</button>

		<button 
			class="w-12 h-12 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 transition-colors"
			onclick={handleCancel}
			ontouchend={handleCancel}
			title="Abbrechen (Esc)"
		>
			<i class="fa-solid fa-xmark"></i>
		</button>
	</div>

	<!-- Symbol picker for mobile -->
	{#if showSymbolPicker && activeTool === 'symbol'}
		<div class="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-2xl shadow-lg p-3 border border-gray-200 z-50">
			<div class="grid grid-cols-4 gap-2">
				{#each symbols as symbol}
					<button
						class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors {selectedSymbol === symbol.type ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'}"
						onclick={() => { selectedSymbol = symbol.type; showSymbolPicker = false; }}
						title={symbol.label}
					>
						<img src={symbol.icon} alt={symbol.label} class="w-8 h-8" />
					</button>
				{/each}
			</div>
		</div>
	{/if}

<!-- Desktop mode -->
{:else}
	<div class="bg-white rounded-2xl shadow-md p-4 border border-gray-200">
		<h4 class="text-xs font-bold text-gray-500 uppercase mb-3">Werkzeuge</h4>
		
		<div class="flex flex-col gap-2">
			<button 
				class="flex items-center gap-2 font-semibold shadow-sm border-1 cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool === 'route' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => activeTool = 'route'}
			>
				<i class="fa-solid fa-route"></i>
				<span>Route</span>
			</button>

			<button 
				class="flex items-center gap-2 font-semibold shadow-sm border-1 cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool === 'outline' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => activeTool = 'outline'}
			>
				<i class="fa-solid fa-draw-polygon"></i>
				<span>Umriss</span>
			</button>

			<button 
				class="flex items-center gap-2 font-semibold shadow-sm border cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool === 'symbol' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => { activeTool = 'symbol'; showSymbolPicker = !showSymbolPicker; }}
			>
				<i class="fa-solid fa-icons"></i>
				<span>Symbol</span>
			</button>

			{#if showSymbolPicker && activeTool === 'symbol'}
				<div class="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded-lg">
					{#each symbols as symbol}
						<button
							class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors {selectedSymbol === symbol.type ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'}"
							onclick={() => selectedSymbol = symbol.type}
							title={symbol.label}
						>
							<img src={symbol.icon} alt={symbol.label} class="w-6 h-6" />
							<span class="text-[10px] text-gray-600">{symbol.label}</span>
						</button>
					{/each}
				</div>
			{/if}


			<button 
				class="flex items-center gap-2 font-semibold shadow-sm border cursor-pointer rounded-full py-2 px-4 text-sm transition-colors {activeTool === 'eraser' ? 'bg-pink-100 border-pink-300 text-pink-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'}"
				onclick={() => activeTool = 'eraser'}
			>
				<i class="fa-solid fa-eraser"></i>
				<span>Löschen</span>
			</button>
		</div>

		<div class="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
			<p><kbd class="px-1 py-0.5 bg-gray-100 rounded">N</kbd> Route beenden</p>
			<p><kbd class="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd> Abbrechen</p>
		</div>
	</div>
{/if}
