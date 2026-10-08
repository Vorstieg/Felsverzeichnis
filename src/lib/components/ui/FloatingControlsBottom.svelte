<script lang="ts">
	let { children }: { children?: import('svelte').Snippet } = $props();
</script>

<div
	class="floating-controls-bottom pointer-events-none fixed right-4 left-4 z-[30000] flex flex-col items-end justify-end gap-2 sm:right-auto sm:bottom-8 sm:left-8 sm:flex-row sm:items-end sm:justify-start"
>
	{@render children?.()}
</div>

<style>
	.floating-controls-bottom {
		@media (width <= 40rem) {
			bottom: calc(var(--info-panel-height, 0px) + 16px);
			transition:
				var(--info-panel-transition, bottom 0.2s ease-out),
				opacity 0.2s ease-out;
			opacity: var(--controls-opacity, 1);
			pointer-events: var(--controls-pointer, auto);
		}
	}
</style>
