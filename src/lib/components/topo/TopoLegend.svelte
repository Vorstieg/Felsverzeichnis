<script lang="ts">
import { topoSymbols } from '@vorstieg/topo-renderer';
	import { fly } from 'svelte/transition';

	type LegendGroup = {
		id: string;
		name: string;
		icon: string;
		symbolIds: string[];
	};

	let { open = false, usedTypes = [], onClose = () => {} } = $props();

	const groups: LegendGroup[] = [
		{
			id: 'fixpoints',
			name: 'Fixpoints',
			icon: 'fa-location-dot',
			symbolIds: ['bolt', 'piton', 'hourglass', 'belay', 'abseil']
		},
		{
			id: 'rock',
			name: 'Rock',
			icon: 'fa-mountain',
			symbolIds: [
				'arete',
				'band',
				'cave',
				'chimney',
				'chockstone',
				'corner',
				'cornice',
				'crack',
				'gully',
				'ledge',
				'overhang',
				'ramp',
				'roof',
				'rubble',
				'shoulder',
				'slab',
				'water-streak'
			]
		},
		{
			id: 'route',
			name: 'Route',
			icon: 'fa-route',
			symbolIds: ['crux', 'hidden-route', 'variant', 'visible-route']
		},
		{
			id: 'environment',
			name: 'Environment',
			icon: 'fa-tree',
			symbolIds: ['bivouac', 'dwarf-pine', 'fixed-cable', 'grass', 'leaf-tree', 'needle-tree', 'snow', 'tree']
		}
	];

	const usedSet = $derived(new Set(usedTypes));
	const symbolMap = new Map(topoSymbols.map((symbol) => [symbol.id, symbol]));
	const groupedSymbols = $derived(groups.map((group) => ({
		...group,
		symbols: group.symbolIds.map((id) => symbolMap.get(id)).filter((symbol) => symbol && usedSet.has(symbol.id))
	})).filter((group) => group.symbols.length > 0));

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<aside
		class="topo-legend fixed right-4 top-5 z-[30000] max-h-[58vh] max-w-[calc(100vw-2rem)] overflow-hidden sm:bottom-7 sm:left-7 sm:right-auto sm:top-auto sm:max-h-[min(70vh,42rem)] sm:w-auto sm:max-w-[19rem]"
		aria-label="Topo legend"
		transition:fly={{ y: 18, duration: 180 }}
	>
		<div class="legend-title flex shrink-0 items-center justify-between gap-3 pb-2">
			<h2 class="m-0 flex items-center gap-2 text-sm font-black uppercase text-black">
				<i class="fa-solid fa-map-signs text-xs"></i>
				Topo legend
			</h2>
			<button
				type="button"
				class="legend-close grid h-7 w-7 cursor-pointer place-items-center rounded-full text-black transition-transform hover:scale-105"
				aria-label="Close topo legend"
				onclick={onClose}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>

		<div class="min-h-0 overflow-y-auto pr-2">
			{#each groupedSymbols as group}
				<section class="mb-3 last:mb-0">
					<h3 class="legend-group-title mb-1 flex items-center gap-2 text-[0.6875rem] font-black uppercase text-black">
						<i class="fa-solid {group.icon}"></i>
						{group.name}
					</h3>
					<div class="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-1">
						{#each group.symbols as symbol}
							<div class="legend-row">
								<img class="legend-icon" src={symbol.icon} alt="" aria-hidden="true" />
								<span>{symbol.name}</span>
							</div>
						{/each}
					</div>
				</section>
			{/each}

			{#if groupedSymbols.length === 0}
				<div class="legend-empty text-sm font-black text-black">
					No topo symbols used here.
				</div>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.topo-legend {
		padding-bottom: env(safe-area-inset-bottom);
		pointer-events: auto;
	}

	.legend-row {
		display: flex;
		min-height: 1.75rem;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 800;
		color: black;
	}

	.legend-close {
		background: transparent;
	}

	.legend-icon {
		height: 1.5rem;
		width: 1.5rem;
		flex: 0 0 auto;
		object-fit: contain;
	}
</style>
