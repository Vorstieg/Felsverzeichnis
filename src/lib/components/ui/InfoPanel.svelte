<script lang="ts">
    import { base } from '$app/paths';
    import { onMount, onDestroy } from 'svelte';

    let { 
        closeUrl = `${base}/map`, 
        onClose = null,
        onShare, 
        children,
        controls,
        isOpen = true,
        hideCloseOnDesktop = false
    } = $props();

    let paneElement: HTMLElement | undefined = $state();
    let controlsElement: HTMLElement | undefined = $state();
    let pane: any = null;
    let isDesktop = $state(true);
    let CupertinoPaneClass: any = null;
    let observer: MutationObserver | null = null;

    onMount(async () => {
        const mod = await import('cupertino-pane');
        CupertinoPaneClass = mod.CupertinoPane || mod.default?.CupertinoPane || mod.default;

        const checkDesktop = () => {
            isDesktop = window.innerWidth >= 640;
        };
        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        
        return () => {
            window.removeEventListener('resize', checkDesktop);
            if (observer) observer.disconnect();
        };
    });

    let lastY = 0;
    let lastTime = 0;
    let dragVelocity = 0;

    const handleTouchStart = () => {
        if (!pane) return;
        lastY = pane.getPanelTransformY();
        lastTime = Date.now();
        dragVelocity = 0;
    };

    const handleTouchMove = () => {
        if (!pane) return;
        const currentY = pane.getPanelTransformY();
        const currentTime = Date.now();
        const dt = currentTime - lastTime;
        if (dt > 0) {
            dragVelocity = (currentY - lastY) / dt;
        }
        lastY = currentY;
        lastTime = currentTime;
    };

    const handleTouchEnd = () => {
        if (dragVelocity < -1.0 || dragVelocity > 1.0) {
            const targetBreak = dragVelocity < -1.0 ? 'top' : 'bottom';
            setTimeout(() => { 
                if (pane) {
                    const originalDuration = pane.settings?.animationDuration;
                    if (pane.settings) pane.settings.animationDuration = 300;
                    
                    pane.moveToBreak(targetBreak);
                    
                    if (pane.settings && originalDuration) {
                        setTimeout(() => { pane.settings.animationDuration = originalDuration; }, 350);
                    }
                }
            }, 10);
        }
    };

    const presentPaneAndSetup = () => {
        if (!pane) return;
        const presentPromise = pane.present({ animate: true });
        document.body.style.overscrollBehaviorY = 'none';
        document.documentElement.style.overscrollBehaviorY = 'none';
        if (paneElement) {
            paneElement.addEventListener('touchstart', handleTouchStart, { passive: true });
            paneElement.addEventListener('touchmove', handleTouchMove, { passive: true });
            paneElement.addEventListener('touchend', handleTouchEnd);
        }
        if (pane.paneEl && !observer) {
            const syncState = () => {
                const trans = pane.paneEl.style.transition;
                if (trans) {
                    document.body.style.setProperty('--info-panel-transition', trans.replace(/transform/g, 'bottom'));
                } else {
                    document.body.style.setProperty('--info-panel-transition', 'none');
                }
                
                const transform = pane.paneEl.style.transform;
                if (transform && transform.includes('translateY')) {
                    const match = transform.match(/translateY\(([-0-9.]+)px\)/);
                    if (match) {
                        const ty = parseFloat(match[1]);
                        const height = window.innerHeight - ty;
                        document.body.style.setProperty('--info-panel-height', height + 'px');
                        
                        if (height > window.innerHeight * 0.7) {
                            document.body.style.setProperty('--controls-opacity', '0');
                            document.body.style.setProperty('--controls-pointer', 'none');
                            document.body.style.setProperty('--controls-scale', '0');
                            if (controlsElement) { controlsElement.style.opacity = '0'; controlsElement.style.pointerEvents = 'none'; controlsElement.style.transform = 'scale(0)'; }
                        } else {
                            document.body.style.setProperty('--controls-opacity', '1');
                            document.body.style.setProperty('--controls-pointer', 'auto');
                            document.body.style.setProperty('--controls-scale', '1');
                            if (controlsElement) { controlsElement.style.opacity = '1'; controlsElement.style.pointerEvents = ''; controlsElement.style.transform = 'scale(1)'; }
                        }
                    }
                }
            };
            observer = new MutationObserver(syncState);
            observer.observe(pane.paneEl, { attributes: true, attributeFilter: ['style'] });
            syncState();
        }
        presentPromise.catch(() => {});
    };

    $effect(() => {
        if (!isDesktop && paneElement && !pane && CupertinoPaneClass) {
            pane = new CupertinoPaneClass(paneElement, {
                parentElement: 'body',
                breaks: {
                    top: { enabled: true, height: window.innerHeight * 0.85, bounce: true },
                    middle: { enabled: true, height: window.innerHeight * 0.5, bounce: true },
                    bottom: { enabled: true, height: window.innerHeight * 0.14, bounce: true },
                },
                initialBreak: 'middle',
                bottomClose: false,
                buttonDestroy: false,
                showDraggable: true,
                onBackdropTap: () => {
                    if (onClose) onClose();
                }
            });
            
            if (isOpen) {
                presentPaneAndSetup();
            }
        } else if (isDesktop && pane) {
            document.body.style.overscrollBehaviorY = 'auto';
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            pane.destroy({ animate: false });
            pane = null;
        }

        return () => {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            if (!isDesktop && paneElement) {
                paneElement.removeEventListener('touchstart', handleTouchStart);
                paneElement.removeEventListener('touchmove', handleTouchMove);
                paneElement.removeEventListener('touchend', handleTouchEnd);
            }
            document.body.style.overscrollBehaviorY = 'auto';
        };
    });

    $effect(() => {
        if (pane) {
            if (isOpen) {
                if (pane.isHidden()) {
                    presentPaneAndSetup();
                }
            } else {
                if (!pane.isHidden()) {
                    pane.hide();
                }
            }
        }
    });

    onDestroy(() => {
        if (pane) {
            pane.destroy({ animate: false });
        }
    });

</script>

{#snippet panelContent()}
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

    <button class="absolute top-4 right-14 cursor-pointer bg-white w-8 h-8 text-sm hover:text-white hover:bg-ink rounded-full border-1 flex items-center justify-center border-gray-200 transition-all z-[5000]"
            onclick={onShare}>
        <i class="fa-solid fa-share-nodes"></i>
    </button>

    {@render children()}
{/snippet}

{#if controls}
     <div bind:this={controlsElement} class="floating-controls fixed left-4 right-4 sm:left-auto sm:bottom-auto {isOpen ? 'sm:right-15' : 'sm:right-5'} sm:top-25 lg:top-30 sm:mt-2 z-[30000] flex flex-col sm:flex-row items-end sm:items-center justify-end pointer-events-none gap-2 sm:transition-all sm:duration-300"
          style="--dynamic-bottom: {isOpen ? 'calc(var(--info-panel-height, 50vh) + 16px)' : 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)'};">
        {@render controls()}
     </div>
{/if}

{#if isDesktop}
    <div class="box flex flex-col border-1 border-gray-200 fixed sm:left-auto left-0 right-0 sm:!right-10 sm:!h-auto top-1/2 lg:!top-30 sm:!top-25 bottom-0 lg:!bottom-20 sm:!bottom-10 w-full sm:w-[25rem] lg:w-[40rem] max-w-[100vw] bg-white rounded-t-3xl rounded-b-none sm:!rounded-3xl shadow-md z-[20000] overflow-hidden transition-transform duration-300 {isOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-[150%]'}">
        {@render panelContent()}
    </div>
{:else}
    <div bind:this={paneElement} class="bg-white flex flex-col overflow-hidden h-full w-full rounded-t-3xl">
        {@render panelContent()}
    </div>
{/if}

<style>
    :global(body > .cupertino-pane-wrapper) {
        z-index: 4000 !important;
    }
    :global(.cupertino-pane-wrapper .pane) {
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
    }
    :global(.cupertino-pane-wrapper .content) {
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        height: 100% !important;
        padding: 0 !important;
    }

    .floating-controls {
        @media (width <= 40rem) {
            bottom: var(--dynamic-bottom, calc(50vh + 16px));
            transition: var(--info-panel-transition, bottom 0.2s ease-out), opacity 0.2s ease-out;
            opacity: var(--controls-opacity, 1);
            pointer-events: var(--controls-pointer, auto);
        }
    }
</style>