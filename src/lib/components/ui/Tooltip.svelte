<script lang="ts">
	let { text, children } = $props();

	let hovered = $state(false);
	let x = $state(0);
	let y = $state(0);
	let triggerEl: HTMLElement;

	function updatePosition() {
		if (triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			x = rect.left + rect.width / 2;
			y = rect.top;
		}
	}

	function toggle(e: MouseEvent) {
		updatePosition();
		hovered = !hovered;
	}

	function enter() {
		updatePosition();
		hovered = true;
	}

	function leave() {
		hovered = false;
	}
</script>

<button
	bind:this={triggerEl}
	onmouseenter={enter}
	onmouseleave={leave}
	onclick={toggle}
	class="inline-block cursor-help bg-transparent border-none p-0 text-inherit"
	type="button"
>
	{@render children()}
</button>

{#if hovered}
	<div
		class="fixed z-[9999] px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 whitespace-nowrap"
		style="left: {x}px; top: {y}px;"
	>
		{text}
		<div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
	</div>
{/if}
