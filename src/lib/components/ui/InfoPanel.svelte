<script lang="ts">
    import { base } from '$app/paths';
    import { resize } from '$lib/assets/js/resize.js';

    let { 
        closeUrl = `${base}/map`, 
        onClose = null,
        onShare, 
        children,
        controls,
        isOpen = true,
        hideCloseOnDesktop = false
    } = $props();
</script>

<!-- Extra Controls Slot (e.g. Sun Simulator) -->
{#if controls}
     <div class="floating-controls fixed left-4 right-4 sm:left-auto sm:bottom-auto {isOpen ? 'sm:right-15' : 'sm:right-5'} sm:top-25 lg:top-30 sm:mt-2 z-[30000] flex flex-col sm:flex-row items-end sm:items-center justify-end pointer-events-none gap-2 transition-all duration-300"
          style="--dynamic-bottom: {isOpen ? 'calc(var(--info-panel-height, 50vh) + 16px)' : 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)'};">
        {@render controls()}
     </div>
{/if}

<div use:resize
     class="box flex flex-col border-1 border-gray-200 fixed sm:left-auto left-0 right-0 sm:!right-10 sm:!h-auto top-1/2 lg:!top-30 sm:!top-25 bottom-0 lg:!bottom-20 sm:!bottom-10 w-full sm:w-[25rem] lg:w-[40rem] max-w-[100vw] bg-white rounded-t-3xl rounded-b-none sm:!rounded-3xl shadow-md z-[20000] overflow-hidden transition-transform duration-300 {isOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-[150%]'}">
    
        <!-- Grabber (Mobile) -->
        <div class="bg-gray-200 h-1 w-12 rounded-full self-center mt-2 sm:hidden shrink-0"></div>
    <!-- Close Button -->
    {#if onClose}
        <button class="absolute top-4 right-4 cursor-pointer bg-white w-8 h-8 text-sm hover:text-white hover:bg-ink rounded-full border-1 flex items-center justify-center border-gray-200 transition-all z-[5000] shrink-0 text-gray-600 {hideCloseOnDesktop ? 'sm:hidden' : ''}"
                onclick={onClose}>
            <i class="fa-lg fa-solid fa-xmark"></i>
        </button>
    {:else}
        <a class="absolute top-4 right-4 cursor-pointer bg-white w-8 h-8 text-sm hover:text-white hover:bg-ink rounded-full border-1 flex items-center justify-center border-gray-200 transition-all z-[5000] shrink-0 text-gray-600 {hideCloseOnDesktop ? 'sm:hidden' : ''}"
           href={closeUrl}>
            <i class="fa-lg fa-solid fa-xmark"></i>
        </a>
    {/if}

    <!-- Share Button -->
    <button class="absolute top-4 right-14 cursor-pointer bg-white w-8 h-8 text-sm hover:text-white hover:bg-ink rounded-full border-1 flex items-center justify-center border-gray-200 transition-all z-[5000]"
            onclick={onShare}>
        <i class="fa-solid fa-share-nodes"></i>
    </button>

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

    .floating-controls {
        @media (width <= 40rem) {
            bottom: var(--dynamic-bottom, calc(50vh + 16px));
            transition: var(--info-panel-transition, bottom 0.2s ease-out);
        }
    }
</style>