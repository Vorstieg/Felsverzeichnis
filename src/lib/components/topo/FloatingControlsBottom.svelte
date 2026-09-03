<script lang="ts">
	let { children = undefined } = $props();
</script>

<div class="fixed left-4 right-4 sm:left-8 sm:bottom-8 sm:right-auto z-[30000] flex flex-col sm:flex-row items-end sm:items-end justify-end sm:justify-start pointer-events-none gap-2 floating-controls-bottom">
	{@render children?.()}
</div>

<style>
	.floating-controls-bottom {
		@media (width <= 40rem) {
			bottom: calc(var(--info-panel-height, 0px) + 16px);
			transition: var(--info-panel-transition, bottom 0.2s ease-out), opacity 0.2s ease-out;
			opacity: var(--controls-opacity, 1);
			pointer-events: var(--controls-pointer, auto);
		}
	}
</style>
