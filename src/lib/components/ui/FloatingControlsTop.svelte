<script lang="ts">
	let { children }: { children?: import('svelte').Snippet } = $props();
</script>

<div
	class="style-selector-btn pointer-events-none fixed right-4 z-[1000] flex flex-col items-end gap-2 sm:right-auto sm:left-8 sm:items-start"
>
	{@render children?.()}
</div>

<style>
	.style-selector-btn {
		@media (width > 40rem) {
			top: 5.75rem;
		}
		@media (width <= 40rem) {
			top: 1.25rem;
			bottom: auto;
			transition:
				opacity 0.2s ease-out,
				transform 0.2s ease-out,
				top 0.2s ease-out;
			opacity: var(--controls-opacity, 1);
			transform: scale(var(--controls-scale, 1));
			transform-origin: center;
			pointer-events: var(--controls-pointer, auto);
		}
	}
</style>
