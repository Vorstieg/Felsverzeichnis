<script lang="ts">
	let {
		icon = '',
		title = '',
		active = false,
		activeClasses = 'bg-blue-50 text-blue-600 border-blue-200',
		inactiveClasses = 'bg-white text-gray-600',
		onclick = () => {},
		onmouseenter = () => {},
		onfocus = () => {},
		href = undefined,
		class: className = '',
		children = undefined
	}: {
		icon?: string;
		title?: string;
		active?: boolean;
		activeClasses?: string;
		inactiveClasses?: string;
		onclick?: () => void;
		onmouseenter?: () => void;
		onfocus?: () => void;
		href?: string;
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

{#if href}
	<a
		class="hover:bg-ink pointer-events-auto z-10 flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-1 border-gray-200 text-center text-lg shadow-md transition-all hover:text-white max-sm:h-11 {active
			? activeClasses
			: inactiveClasses} {className ? className : 'w-10 max-sm:w-11'}"
		{href}
		{onmouseenter}
		{onfocus}
		aria-label={title}
		{title}
	>
		{#if icon}
			<i class="fa-solid {icon}"></i>
		{/if}
		{@render children?.()}
	</a>
{:else}
	<button
		class="hover:bg-ink pointer-events-auto z-10 flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-1 border-gray-200 text-center text-lg shadow-md transition-all hover:text-white max-sm:h-11 {active
			? activeClasses
			: inactiveClasses} {className ? className : 'w-10 max-sm:w-11'}"
		{onclick}
		{onmouseenter}
		{onfocus}
		aria-label={title}
		{title}
	>
		{#if icon}
			<i class="fa-solid {icon}"></i>
		{/if}
		{@render children?.()}
	</button>
{/if}
