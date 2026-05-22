<script>
	import { slide } from 'svelte/transition';
    import { _ } from 'svelte-i18n';

	let { 
        selectedTags = $bindable([]), 
        availableTags = [],
        variant = 'default' // 'default' | 'modern'
    } = $props();

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
					class={`flex items-center gap-1 transition-all cursor-pointer ${
                        variant === 'modern' 
                        ? 'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-blue-600 border-2 border-blue-600 text-white shadow-md hover:bg-blue-700 hover:border-blue-700' 
                        : 'px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 hover:border-blue-300'
                    }`}
					onclick={() => removeTag(tag)}
					title={$_('ui.remove')}
				>
					{$_('tags.' + tag)}
					<i class={`fa-solid fa-xmark opacity-60 ${variant === 'modern' ? 'text-[11px] ml-1' : 'text-[10px]'}`}></i>
				</button>
			{/each}
		{/if}

		<div class="relative">
			<button
				class={`transition-all flex items-center gap-1 cursor-pointer ${
                    variant === 'modern'
                    ? 'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 hover:bg-white'
                    : 'px-2 py-1 rounded-md text-xs border border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                }`}
				onclick={() => isOpen = !isOpen}
			>
				<i class="fa-solid fa-plus"></i> {$_('ui.tag')}
			</button>

			{#if isOpen}
				<div
					class={`absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] max-h-64 overflow-y-auto py-2 custom-scrollbar ${variant === 'modern' ? 'backdrop-blur-md bg-white/95' : ''}`}
					transition:slide={{duration: 150}}>
					{#if unusedTags.length === 0}
						<div class="px-4 py-3 text-xs text-gray-400 italic">{$_('ui.no_more_tags')}</div>
					{:else}
						{#each unusedTags as tag}
							<button
								class={`w-full text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer block ${
                                    variant === 'modern'
                                    ? 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                                }`}
								onclick={() => { addTag(tag); isOpen = false; }}
							>
								{$_('tags.' + tag)}
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
</style>