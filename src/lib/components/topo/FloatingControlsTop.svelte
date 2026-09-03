<script lang="ts">
	let { children = undefined } = $props();
</script>

<div class="fixed sm:left-8 sm:right-auto right-4 z-[1000] flex flex-col items-end sm:items-start style-selector-btn gap-2 pointer-events-none">
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
			transition: opacity 0.2s ease-out, transform 0.2s ease-out, top 0.2s ease-out;
			opacity: var(--controls-opacity, 1);
			transform: scale(var(--controls-scale, 1));
			transform-origin: center;
			pointer-events: var(--controls-pointer, auto);
		}
	}
</style>
