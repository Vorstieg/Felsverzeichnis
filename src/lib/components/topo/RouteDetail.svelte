<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { slide } from 'svelte/transition';
	import type { Route } from '@vorstieg/fels-types/types';
	import type { SteepnessMetrics, SunInfo } from '$lib/types/application';
	import { getTypeColor } from '$lib/assets/js/route-types.js';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import SteepnessDistribution from '$lib/components/charts/SteepnessDistribution.svelte';
	import RouteSteepnessChart from '$lib/components/charts/RouteSteepnessChart.svelte';

	let {
		route,
		rockType = '',
		wallDirection = 'Unknown',
		sunInfo = { hours: 'N/A', chartData: null },
		metrics = null,
		onMetrics,
		showCharts = true,
		actions,
		children
	}: {
		route: Route;
		rockType?: string;
		wallDirection?: string;
		sunInfo?: SunInfo;
		metrics?: SteepnessMetrics | null;
		onMetrics?: (event: CustomEvent<SteepnessMetrics>) => void;
		showCharts?: boolean;
		actions?: import('svelte').Snippet;
		children?: import('svelte').Snippet;
	} = $props();

	let displayWallDirection = $derived(
		wallDirection !== 'N/A' && wallDirection !== 'Unknown'
			? $_('directions.' + wallDirection)
			: wallDirection
	);
	let displaySunHours = $derived(
		sunInfo.hours === 'shade_all_day' || sunInfo.hours === 'no_geodata'
			? $_('sun.' + sunInfo.hours)
			: sunInfo.hours
	);

	function getTagLabel(tag: string) {
		const translated = $_('tags.' + tag);
		return translated === 'tags.' + tag ? tag : translated;
	}

	function getRockTypeLabel(type: string) {
		const key = type.trim().toLowerCase();
		const translated = $_('rock_types.' + key);
		return translated === 'rock_types.' + key ? type : translated;
	}
</script>

<div class="mb-6 flex flex-wrap gap-3 text-sm font-medium text-gray-700 sm:mt-4">
	{#if route.type}
		{#each Array.isArray(route.type) ? route.type : [route.type] as t}
			<span
				class="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-white"
				style="background-color: {getTypeColor(t) + 'd9'};"
			>
				{$_('types.' + t)}
			</span>
		{/each}
	{/if}
	{#if route.tags && route.tags.length > 0}
		{#each route.tags as tag}
			<span
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
				style="background-color: #64748bd9;"
			>
				{getTagLabel(tag)}
			</span>
		{/each}
	{/if}
	{#if wallDirection !== 'N/A' && wallDirection !== 'Unknown'}
		<Tooltip text={$_('topo.wall_direction')}>
			<div class="mt-1 ml-2 flex items-center gap-1.5 text-slate-700">
				<i class="fa-solid fa-compass"></i>
				<span>{displayWallDirection}</span>
			</div>
		</Tooltip>
	{/if}
	{#if sunInfo.hours !== 'N/A' && sunInfo.hours !== 'Unknown' && sunInfo.hours !== 'no_geodata'}
		<Tooltip text={$_('topo.sun_hours')}>
			<div class="mt-1 ml-2 flex items-center gap-1.5 text-slate-700">
				<i class="fa-solid fa-clock"></i>
				<span>{displaySunHours}</span>
			</div>
		</Tooltip>
	{/if}
</div>

{#if actions}
	{@render actions()}
{/if}

<div class="prose mx-auto mb-5">
	{#if route.description}
		<div class="border-b border-gray-200 p-3">
			{route.description}
		</div>
	{/if}

	{#if route.length}
		<div class="border-b border-gray-200 p-3">
			{$_('topo.length')}: {route.length} m
		</div>
	{/if}
	{#if route.boltAmount}
		<div class="border-b border-gray-200 p-3">
			{$_('topo.required_draws')}: {route.boltAmount}
		</div>
	{/if}
	{#if rockType}
		<div class="border-b border-gray-200 p-3">
			{$_('topo.rock_type')}: {getRockTypeLabel(rockType)}
		</div>
	{/if}
</div>

{#if route.points3D?.length && showCharts}
	<div class="mt-6 min-h-[400px] w-full" in:slide={{ duration: 200 }}>
		<div>
			<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">
				{$_('topo.steepness_distribution')}
			</h3>
			<div class="mb-8">
				<SteepnessDistribution {metrics} />
			</div>
		</div>
		<div>
			<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">{$_('topo.steepness')}</h3>
			<div class="mb-8 h-48 w-full">
				<RouteSteepnessChart {route} on:metrics={(e) => onMetrics?.(e)} />
			</div>
		</div>
	</div>
{/if}

{#if children}
	{@render children()}
{/if}
