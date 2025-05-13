<script>
	import { slide } from 'svelte/transition';

	let { selectedTags = $bindable([]), availableTags = [] } = $props();

	let isOpen = $state(false);
	let container;

	function addTag(tag) {
		if (!selectedTags) selectedTags = [];

		if (!selectedTags.includes(tag)) {
			selectedTags = [...selectedTags, tag];
		}
	}

	function removeTag(tag) {
		if (!selectedTags) return;
		selectedTags = selectedTags.filter(t => t !== tag);
	}

	function handleClickOutside(event) {
		if (container && !container.contains(event.target) && isOpen) {
			isOpen = false;
		}
	}

	let unusedTags = $derived(availableTags.filter(t => !(selectedTags || []).includes(t)));
</script>

<svelte:window onclick={handleClickOutside} />

<div class="w-full" bind:this={container}>
	<div class="flex flex-wrap gap-2">
		{#if selectedTags}
			{#each selectedTags as tag}
				<button
					class="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 hover:border-blue-300 transition-colors cursor-pointer"
					onclick={() => removeTag(tag)}
					title="Entfernen"
				>
					{tag}
					<i class="fa-solid fa-xmark text-[10px] opacity-60"></i>
				</button>
			{/each}
		{/if}

		<div class="relative">
			<button
				class="px-2 py-1 rounded-md text-xs border border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center gap-1 cursor-pointer"
				onclick={() => isOpen = !isOpen}
			>
				<i class="fa-solid fa-plus"></i> Tag
			</button>

			{#if isOpen}
				<div
					class="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 max-h-48 overflow-y-auto py-1"
					transition:slide={{duration: 150}}>
					{#if unusedTags.length === 0}
						<div class="px-3 py-2 text-xs text-gray-400 italic">Keine weiteren Tags</div>
					{:else}
						{#each unusedTags as tag}
							<button
								class="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer block"
								onclick={() => addTag(tag)}
							>
								{tag}
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>