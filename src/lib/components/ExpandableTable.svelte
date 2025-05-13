<script lang="ts">
	// Runes $state, $props are globally available
	import { quintOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import type { ComponentType, SvelteComponent, Snippet } from 'svelte'; // Import Snippet type

	// --- Types ---
	interface ColumnDef<T> {
		key: keyof T;
		label: string;
		render?: (item: T) => string | ComponentType<SvelteComponent & {item: T}>;
		headerClass?: string;
		cellClass?: string;
	}
	type DataItem = Record<string, any> & { id: string | number };

	// --- Props ---
	let {
		data = [] as DataItem[],
		columns = [] as ColumnDef<DataItem>[],
		// *** CHANGE: Expect a Snippet function for details ***
		detailsSnippet // Type inferred as Snippet<(item: DataItem) => Record<string, never>>
	}: {
		data?: DataItem[],
		columns?: ColumnDef<DataItem>[],
		detailsSnippet: Snippet<[item: DataItem]> // Explicit type for the details snippet prop
	} = $props();

	// --- State (Using Object Map with $state) ---
	let expandedMap = $state<{ [key: string | number]: boolean }>({});
	// console.log('Component Initialized. Initial expandedMap:', expandedMap);

	// --- Functions ---
	function toggleRow(id: string | number) {
		// console.log(`--- Toggling Row ID: ${id} ---`);
		// console.log('Current expandedMap (before):', { ...expandedMap });
		expandedMap[id] = !expandedMap[id];
		// console.log('Current expandedMap (after):', expandedMap);
	}

	function isExpanded(id: string | number): boolean {
		return !!expandedMap[id];
	}

</script>

<div class="overflow-x-auto shadow-md sm:rounded-lg border border-gray-200">
	<table class="min-w-full divide-y divide-gray-200">
		<thead class="bg-gray-50">
		<tr>
			{#each columns as column}
				<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider {column.headerClass || ''}">
					{column.label}
				</th>
			{/each}
			<th scope="col" class="relative px-6 py-3 w-12">
				<span class="sr-only">Details</span>
			</th>
		</tr>
		</thead>
		<tbody class="bg-white divide-y divide-gray-200">
		{#each data as item (item.id)}
			<tr
				class="hover:bg-gray-50 cursor-pointer"
				on:click={() => toggleRow(item.id)}
				aria-expanded={isExpanded(item.id)}
			>
				{#each columns as column}
					<td class="px-6 py-4 whitespace-nowrap text-sm {column.cellClass || 'text-gray-700'}">
						{#if column.render}
							{#if typeof column.render(item) === 'string'}
								{@html column.render(item)}
							{:else}
								<svelte:component this={column.render(item)} {item} />
							{/if}
						{:else}
							{item[column.key]}
						{/if}
					</td>
				{/each}
				<td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
             <span class="text-indigo-600 hover:text-indigo-900 transition-transform duration-300 inline-block" class:rotate-180={isExpanded(item.id)}>
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                 <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
               </svg>
             </span>
				</td>
			</tr>

			{@const checkExpanded = isExpanded(item.id)}
			{#if checkExpanded}
				<tr class="bg-gray-50 border-l-4 border-indigo-200" transition:fade={{ duration: 150, easing: quintOut }}>
					<td colspan={columns.length + 1} class="p-0">
						<div class="details-content">
							{#if detailsSnippet}
								{@render detailsSnippet(item)}
							{:else}
								<p class="p-4 text-sm text-red-600">Error: Details snippet not provided.</p>
							{/if}
						</div>
					</td>
				</tr>
			{/if}
		{:else}
			<tr>
				<td colspan={columns.length + 1} class="text-center px-6 py-10 text-gray-500">
					No data available.
				</td>
			</tr>
		{/each}
		</tbody>
	</table>
</div>

<style>
    /* Styles remain the same */
    .transition-transform { transition: transform 0.3s ease-in-out; }
    .rotate-180 { transform: rotate(180deg); }
    .details-content { padding: 1rem; }
</style>