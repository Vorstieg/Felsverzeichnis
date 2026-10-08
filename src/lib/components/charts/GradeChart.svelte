<script lang="ts">
	import Chart from 'chart.js/auto';
	import type { Route } from '@vorstieg/fels-types/types';
	import { _ } from 'svelte-i18n';
	import { gradeOrder, gradeRank, hardestRouteGrade } from '$lib/assets/js/route-summary';
	import { colors } from '$lib/colors.js';

	let { routes }: { routes: Route[] } = $props();
	let gradeChartData = $derived(calculateGradeStats(routes));

	let t_routes_label = $derived($_('charts.routes'));
	let chartConfig = $derived({
		data: gradeChartData,
		translations: {
			routes: t_routes_label
		}
	});

	function calculateGradeStats(routes: Route[]) {
		if (routes.length === 0) return null;

		const grades = routes.map(hardestRouteGrade).filter((grade) => gradeRank(grade) !== -1);

		const counts: Record<string, number> = {};
		let minIdx = gradeOrder.length;
		let maxIdx = 0;
		let hasData = false;

		grades.forEach((g) => {
			const idx = gradeRank(g);

			if (idx !== -1) {
				counts[gradeOrder[idx]] = (counts[gradeOrder[idx]] || 0) + 1;
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
			const grade = gradeOrder[i];
			labels.push(grade);
			dataCounts.push(counts[grade] || 0);

			let hue;
			if (i <= 23) {
				// Green tier (1a to 5c+): hue 140 to 80
				hue = 140 - (i / 23) * 60;
			} else if (i <= 29) {
				// Yellow tier (6a to 6c+): hue 65 to 40
				hue = 65 - ((i - 24) / 5) * 25;
			} else if (i <= 35) {
				// Red tier (7a to 7c+): hue 25 to 0
				hue = 25 - ((i - 30) / 5) * 25;
			} else {
				// Purple tier (8a to 9b+): hue 290 to 260
				hue = 290 - ((i - 36) / 9) * 30;
			}
			segmentColors.push(`hsl(${hue}, 85%, 45%)`);
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

{#if gradeChartData}
	<div class="chart-wrapper">
		<canvas use:initGradeChart={chartConfig}></canvas>
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
