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
	} = $props();
</script>

{#if href}
	<a
		class="pointer-events-auto cursor-pointer flex items-center justify-center h-10 max-sm:h-11 text-lg hover:text-white hover:bg-ink rounded-2xl border-1 text-center border-gray-200 transition-all shadow-md shrink-0 z-10 {active ? activeClasses : inactiveClasses} {className ? className : 'w-10 max-sm:w-11'}"
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
		class="pointer-events-auto cursor-pointer flex items-center justify-center h-10 max-sm:h-11 text-lg hover:text-white hover:bg-ink rounded-2xl border-1 text-center border-gray-200 transition-all shadow-md shrink-0 z-10 {active ? activeClasses : inactiveClasses} {className ? className : 'w-10 max-sm:w-11'}"
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
