<script lang="ts">
	import Chart from 'chart.js/auto';
	import type { Route } from '@vorstieg/fels-types/types';
	import type { GpxTrack, RouteSummary } from '$lib/types/application';
	import { _ } from 'svelte-i18n';
	import { gradeRank, hardestRouteGrade } from '$lib/assets/js/route-summary';
	import { colors } from '$lib/colors.js';
	import { getGradeColor, getGradeLabel, getGradeScaleOrder } from '$lib/assets/js/grades.js';
	import RouteList from '$lib/components/topo/RouteList.svelte';
	import GradeLine from '$lib/components/charts/GradeLine.svelte';

	let {
		routes,
		title,
		type,
		fallbackAccessTracks = [],
		activeRouteId,
		pendingRouteId,
		initialExpanded = false,
		onRouteSelect
	}: {
		routes: (RouteSummary | Route)[];
		title?: string;
		type?: string;
		fallbackAccessTracks?: GpxTrack[];
		activeRouteId?: Route['id'] | null;
		pendingRouteId?: Route['id'] | null;
		initialExpanded?: boolean;
		onRouteSelect?: (route: Route) => void;
	} = $props();

	let gradeChartData = $derived(calculateGradeStats(routes as Route[], type));

	let userExpanded = $state<boolean | null>(null);

	$effect(() => {
		routes;
		userExpanded = null;
	});

	let isExpanded = $derived(userExpanded !== null ? userExpanded : initialExpanded);

	let t_routes_label = $derived($_('charts.routes'));
	let chartConfig = $derived({
		data: gradeChartData,
		translations: {
			routes: t_routes_label
		}
	});

	function calculateGradeStats(routes: Route[], climbingType?: string) {
		if (routes.length === 0) return null;

		const order = getGradeScaleOrder(climbingType);
		const grades = routes
			.map((r) => hardestRouteGrade(r, climbingType))
			.filter((grade) => gradeRank(grade, climbingType) !== -1);

		const counts: Record<string, number> = {};
		let minIdx = order.length;
		let maxIdx = 0;
		let hasData = false;

		grades.forEach((g) => {
			const idx = gradeRank(g, climbingType);

			if (idx !== -1 && idx < order.length) {
				const gradeKey = order[idx];
				counts[gradeKey] = (counts[gradeKey] || 0) + 1;
				if (idx < minIdx) minIdx = idx;
				if (idx > maxIdx) maxIdx = idx;
				hasData = true;
			}
		});

		if (!hasData) return null;

		const labels = [];
		const dataCounts = [];
		const segmentColors = [];

		for (let i = minIdx; i <= maxIdx; i++) {
			const grade = order[i];
			labels.push(getGradeLabel(grade, undefined, climbingType) || grade);
			dataCounts.push(counts[grade] || 0);
			segmentColors.push(getGradeColor({ standardizedValue: grade }, climbingType));
		}

		return {
			labels: labels,
			counts: dataCounts,
			colors: segmentColors
		};
	}

	function initGradeChart(node: HTMLCanvasElement, config: typeof chartConfig) {
		if (!config || !config.data) return;
		const { data, translations } = config;

		const ctx = node.getContext('2d');
		if (!ctx) return;

		const chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: [...data.labels],
				datasets: [
					{
						label: translations.routes,
						data: [...data.counts],
						backgroundColor: [...data.colors],
						borderRadius: 4,
						borderSkipped: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: colors.ui.overlay,
						padding: 10,
						cornerRadius: 8,
						displayColors: true,
						callbacks: {
							label: (ctx) => `${ctx.raw} ${translations.routes}`
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: { stepSize: 1 },
						grid: { color: colors.chart.grid }
					},
					x: {
						grid: { display: false }
					}
				},
				animation: false
			}
		});

		return {
			update(newConfig: typeof chartConfig) {
				if (!newConfig || !newConfig.data) return;
				const { data, translations } = newConfig;

				chart.data.labels = [...data.labels];
				chart.data.datasets[0].data = [...data.counts];
				chart.data.datasets[0].backgroundColor = [...data.colors];
				chart.data.datasets[0].label = translations.routes;

				if (chart.options.plugins?.tooltip?.callbacks) {
					chart.options.plugins.tooltip.callbacks.label = (ctx) =>
						`${ctx.raw} ${translations.routes}`;
				}

				chart.update();
			},
			destroy() {
				chart.destroy();
			}
		};
	}
</script>

{#if title}
	<div class="mb-3 flex items-center justify-between px-1">
		<h3 class="my-0 text-lg font-bold text-gray-800">
			{title}
		</h3>
		<button
			type="button"
			onclick={() => (userExpanded = !isExpanded)}
			class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
		>
			<span>{isExpanded ? $_('topo.hide_routes') : $_('topo.show_routes')}</span>
			<i class="fa-solid fa-chevron-{isExpanded ? 'up' : 'down'} text-[10px]"></i>
		</button>
	</div>
{/if}

{#if !isExpanded}
	<div
		class="cursor-pointer transition-opacity hover:opacity-90"
		role="button"
		tabindex="0"
		onclick={() => (userExpanded = true)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				userExpanded = true;
			}
		}}
		aria-label={$_('topo.show_routes')}
	>
		<GradeLine routes={routes as Route[]} {type} />
	</div>
{:else}
	{#if gradeChartData}
		<div class={title ? 'h-40 w-full sm:h-56' : 'chart-wrapper'}>
			<div class="chart-wrapper">
				<canvas use:initGradeChart={chartConfig}></canvas>
			</div>
		</div>
	{/if}

	<div class="mt-4">
		<RouteList
			routes={routes as RouteSummary[]}
			title=""
			{fallbackAccessTracks}
			{activeRouteId}
			{pendingRouteId}
			{onRouteSelect}
		/>
	</div>
{/if}

<style>
	.chart-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
	}
	canvas {
		width: 100%;
		height: 100%;
	}
</style>
