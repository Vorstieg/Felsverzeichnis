<script lang="ts">
	import type { Route } from '@vorstieg/fels-types/types';
	import type { GpxTrack, RouteSummary } from '$lib/types/application';
	import { _ } from 'svelte-i18n';
	import {
		CLIMBING_TYPE_PRIORITY,
		getPreferredClimbingType
	} from '$lib/assets/js/climbing-map-utils.js';
	import GradeChartSection from './GradeChartSection.svelte';

	let {
		routes,
		title,
		fallbackAccessTracks = [],
		activeRouteId,
		pendingRouteId,
		initialExpanded = false,
		onRouteSelect
	}: {
		routes: (RouteSummary | Route)[];
		title?: string;
		fallbackAccessTracks?: GpxTrack[];
		activeRouteId?: Route['id'] | null;
		pendingRouteId?: Route['id'] | null;
		initialExpanded?: boolean;
		onRouteSelect?: (route: Route) => void;
	} = $props();

	let routeGroups = $derived.by(() => {
		if (title) {
			return [{ type: 'custom', title, routes }];
		}
		if (!routes?.length) return [];

		const groups = new Map<string, (RouteSummary | Route)[]>();
		for (const route of routes) {
			const type = getPreferredClimbingType(route.type);
			const list = groups.get(type) ?? [];
			list.push(route);
			groups.set(type, list);
		}

		const sortedTypes = Array.from(groups.keys()).sort((a, b) => {
			const getPriority = (t: string) => {
				if (!t) return 1.5;
				const idx = CLIMBING_TYPE_PRIORITY.indexOf(t);
				return idx === -1 ? 999 : idx;
			};
			return getPriority(a) - getPriority(b);
		});

		return sortedTypes.map((type) => {
			const groupRoutes = groups.get(type)!;
			const typeName = type ? $_('types.' + type, { default: type }) : $_('topo.routes');
			return {
				type,
				title: `${typeName} (${groupRoutes.length})`,
				routes: groupRoutes
			};
		});
	});
</script>

{#each routeGroups as group (group.type)}
	<div class="mt-5 mb-5 w-full first:mt-0 last:mb-0">
		<GradeChartSection
			title={group.title}
			type={group.type}
			routes={group.routes}
			{fallbackAccessTracks}
			{activeRouteId}
			{pendingRouteId}
			{initialExpanded}
			{onRouteSelect}
		/>
	</div>
{/each}
