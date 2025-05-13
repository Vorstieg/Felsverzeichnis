<script lang="ts">
    import { base } from '$app/paths';
    import { resize } from '$lib/assets/js/resize.js';

    let { 
        closeUrl = `${base}/map`, 
        onShare, 
        children,
        controls 
    } = $props();
</script>

<div use:resize
     class="box flex flex-col border-1 border-gray-200 fixed sm:left-auto left-0 right-0 sm:!right-10 sm:!h-auto top-1/2 lg:!top-30 sm:!top-25 bottom-0 lg:!bottom-20 sm:!bottom-10 w-auto sm:w-[25rem] lg:w-[40rem] bg-white rounded-t-3xl rounded-b-none sm:!rounded-3xl shadow-md z-[20000]">
    
        <!-- Grabber (Mobile) -->
        <div class="bg-gray-200 h-1 w-12 rounded-full self-center mt-2 sm:hidden"></div>
    <!-- Close Button -->
    <a class="fixed right-5 sm:right-15 cursor-pointer bg-white w-8 h-8 pt-1.5 text-sm mt-2 hover:text-white hover:bg-ink rounded-full border-1 text-center border-gray-200 transition-all ml-3 z-[5000]"
       href={closeUrl}>
        <i class="fa-lg fa-solid fa-xmark"></i>
    </a>

    <!-- Share Button -->
    <button class="fixed right-15 sm:right-25 cursor-pointer bg-white w-8 h-8 pt-0.5 text-sm mt-2 hover:text-white hover:bg-ink rounded-full border-1 text-center border-gray-200 transition-all ml-3 z-[5000]"
            onclick={onShare}>
        <i class="fa-solid fa-share-nodes"></i>
    </button>

    <!-- Extra Controls Slot (e.g. Sun Simulator) -->
    {#if controls}
         <div class="fixed right-25 sm:right-35 mt-2 z-[5000] flex items-center justify-end pointer-events-none">
            {@render controls()}
         </div>
    {/if}

    <!-- Content -->
    {@render children()}
</div>

<style>
    :global(.grabber.top) {
        height: 100px;
        width: 90%; /* Reduced width */
        position: absolute;
        top: -5px;
        right: 0;  /* Anchor to the right */
        cursor: pointer;
    }
</style>