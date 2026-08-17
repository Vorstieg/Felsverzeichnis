<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { colors } from '$lib/colors.js';

	type Route = {
		id?: string;
		name?: string;
		grade?: string;
		length?: string | number;
		[key: string]: any;
	};

	let {
		routes,
		activeRouteId,
		pendingRouteId,
		onRouteSelect,
		onRouteHover
	}: {
		routes: Route[];
		activeRouteId?: string | null;
		pendingRouteId?: string | null;
		onRouteSelect?: (route: Route) => void;
		onRouteHover?: (route: Route | null) => void;
	} = $props();

	function getGradeColor(grade?: string) {
		if (!grade) return colors.topo.gradeUnknown;
		const value = grade.toLowerCase();
		if (value.startsWith('3') || value.startsWith('4') || value.startsWith('5')) {
			return colors.topo.gradeEasy;
		}
		if (value.startsWith('6')) return colors.topo.gradeMedium;
		if (value.startsWith('7')) return colors.topo.gradeHard;
		if (value.startsWith('8') || value.startsWith('9')) return colors.topo.gradeVeryHard;
		return colors.topo.gradeUnknown;
	}

	function selectRoute(route: Route) {
		onRouteSelect?.(route);
	}

	function handleRowKeydown(event: KeyboardEvent, route: Route) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selectRoute(route);
		}
	}
</script>

<div class="w-full">
	<h3 class="mb-3 px-1 text-lg font-bold text-gray-800">{$_('topo.routes')} ({routes.length})</h3>
	<div class="overflow-x-auto border border-gray-200 bg-white shadow-sm sm:rounded-xl">
		<table class="!m-0 min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					<th scope="col" class="px-6 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase">
						{$_('topo.table.name')}
					</th>
					<th scope="col" class="px-6 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase">
						{$_('topo.table.grade')}
					</th>
					<th scope="col" class="px-6 py-3 text-left text-xs font-bold tracking-wider text-gray-500 uppercase">
						{$_('topo.table.length')}
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 bg-white">
				{#each routes as route}
					<tr
						class="{activeRouteId === route.id ? 'bg-blue-50' : onRouteSelect ? 'cursor-pointer transition-colors hover:bg-blue-50' : ''}"
						role={onRouteSelect ? 'button' : undefined}
						tabindex={onRouteSelect ? 0 : undefined}
						onmouseenter={() => onRouteHover?.(route)}
						onmouseleave={() => onRouteHover?.(null)}
						onclick={() => selectRoute(route)}
						onkeydown={(event) => handleRowKeydown(event, route)}
					>
						<td class="flex items-center px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
							{route.name || '—'}
							{#if pendingRouteId === route.id}
								<i class="fa-solid fa-circle-notch ml-2 animate-spin text-blue-500"></i>
							{/if}
						</td>
						<td class="px-6 py-4 text-sm whitespace-nowrap">
							<span
								class="rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 shadow-sm"
								style="border-left: 5px solid {getGradeColor(route.grade)};"
							>
								{route.grade || '—'}
							</span>
						</td>
						<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
							{route.length ? `${route.length}m` : '—'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
