<script lang="ts">
	let { metrics } = $props();
</script>

{#if metrics.slab !== 'N/A'}
    <div class="w-full h-6 flex rounded-md overflow-hidden bg-gray-100 mb-2 shadow-inner">
        {#if parseFloat(metrics.slab) > 0}
            <div class="bg-teal-400 h-full flex items-center justify-center text-[10px] text-white font-bold" style="width: {metrics.slab}%" title="Platte">
                {#if parseFloat(metrics.slab) > 10}{Math.round(metrics.slab)}%{/if}
            </div>
        {/if}
        {#if parseFloat(metrics.vertical) > 0}
            <div class="bg-yellow-400 h-full flex items-center justify-center text-[10px] text-white font-bold" style="width: {metrics.vertical}%" title="Senkrecht">
                {#if parseFloat(metrics.vertical) > 10}{Math.round(metrics.vertical)}%{/if}
            </div>
        {/if}
        {#if parseFloat(metrics.overhang) > 0}
            <div class="bg-red-500 h-full flex items-center justify-center text-[10px] text-white font-bold" style="width: {metrics.overhang}%" title="Überhang">
                {#if parseFloat(metrics.overhang) > 10}{Math.round(metrics.overhang)}%{/if}
            </div>
        {/if}
    </div>
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-teal-400"></div>Platte ({metrics.slab}%)</div>
        <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-yellow-400"></div>Senkrecht ({metrics.vertical}%)</div>
        <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-red-500"></div>Überhang ({metrics.overhang}%)</div>
    </div>
{:else}
    <div class="text-gray-400 italic text-sm">Berechne Verteilung...</div>
{/if}