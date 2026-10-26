<script lang="ts">
	import { base } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { routeHitUrl, type RouteHit } from '$lib/search/catalog-search';
	import { getTypeBadgeClass } from '$lib/assets/js/route-types.js';
	import { getGradeTier, getGradeLabel } from '$lib/assets/js/grades.js';

	let { route }: { route: RouteHit } = $props();

	let types = $derived(route.types ?? []);
	let primaryType = $derived(types[0]);
	let breadcrumb = $derived(route.breadcrumb ?? []);
	let pathParts = $derived((route.path || '').split('/').filter(Boolean));
	let crumbOffset = $derived(Math.max(0, pathParts.length - breadcrumb.length));
	let gradeTier = $derived(route.grade ? getGradeTier(route.grade, primaryType) : null);
	let gradeDisplay = $derived(
		route.grade
			? getGradeLabel(route.grade.value, route.grade.scale, primaryType) ||
					route.grade.standardizedValue
			: null
	);
	let routeUrl = $derived(routeHitUrl(base, route));
</script>

<div
	class="group relative flex w-full items-center gap-3 border-b border-gray-100 py-3 transition-colors hover:bg-gray-50/80 sm:gap-4"
>
	<a href={routeUrl} class="absolute inset-0 z-0" aria-label={route.name} tabindex="-1"></a>

	<div class="relative z-10 flex h-full min-w-0 flex-1 flex-col justify-between">
		<div>
			{#if breadcrumb.length > 0}
				<div
					class="no-scrollbar mb-1.5 flex flex-wrap items-center gap-1 overflow-x-auto text-xs font-medium tracking-wide sm:text-sm"
				>
					{#each breadcrumb as crumb, i}
						{@const isLast = i === breadcrumb.length - 1}
						{@const subpath = pathParts.slice(0, crumbOffset + i + 1).join('/')}
						<a
							href={isLast || !subpath
								? `${base}/map/crag/${route.path}`
								: `${base}/map/${encodeURIComponent(subpath)}`}
							class="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium no-underline transition-all sm:px-2.5 sm:py-0.5 {isLast
								? 'bg-slate-200/80 font-semibold text-slate-800'
								: 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}"
							onclick={(e) => e.stopPropagation()}
						>
							{crumb}
						</a>
						{#if i < breadcrumb.length - 1}
							<i class="fa-solid fa-chevron-right shrink-0 text-[8px] text-slate-300 sm:text-[10px]"
							></i>
						{/if}
					{/each}
				</div>
			{/if}

			<div class="flex items-center gap-2">
				<a href={routeUrl} class="block min-w-0 truncate no-underline">
					<h3
						class="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-blue-600 sm:text-lg"
					>
						{route.name}
					</h3>
				</a>

				{#if gradeDisplay}
					<span
						class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white shadow-xs"
						style="background-color: {gradeTier?.color ?? '#475569'};"
					>
						{gradeDisplay}
					</span>
				{/if}
			</div>
		</div>

		<div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
			{#each types as type}
				<span
					class="rounded px-2 py-0.5 text-[9px] sm:text-[10px] {getTypeBadgeClass(
						type
					)} font-semibold tracking-wide uppercase"
				>
					{$_('types.' + type)}
				</span>
			{/each}

			{#if route.length}
				<span
					class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
				>
					<i class="fa-solid fa-ruler-vertical text-[9px] text-slate-400"></i>
					{route.length} m
				</span>
			{/if}

			{#if route.pitchCount && route.pitchCount > 1}
				<span
					class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
				>
					<i class="fa-solid fa-layer-group text-[9px] text-slate-400"></i>
					{route.pitchCount}
					{$_('topo.pitches', { default: 'pitches' })}
				</span>
			{/if}
		</div>
	</div>
</div>
