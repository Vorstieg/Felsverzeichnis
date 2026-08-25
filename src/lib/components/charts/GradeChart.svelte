<script lang="ts">
	import Chart from 'chart.js/auto';
	import { _ } from 'svelte-i18n';
	import { colors } from '$lib/colors.js';

	let { routes } = $props();
	let canvas: HTMLCanvasElement = $state();
	let gradeChartData = $derived(calculateGradeStats(routes));

	let t_routes_label = $derived($_('charts.routes'));
	let chartConfig = $derived({
		data: gradeChartData,
		translations: {
			routes: t_routes_label
		}
	});

	function calculateGradeStats(routes: any[]) {
		if (!routes || routes.length === 0) return null;

		// Standard ordered grades (French scale)
		const gradeOrder = [
			'1a',
			'1b',
			'1c',
			'2a',
			'2b',
			'2c',
			'3a',
			'3a+',
			'3b',
			'3b+',
			'3c',
			'3c+',
			'4a',
			'4a+',
			'4b',
			'4b+',
			'4c',
			'4c+',
			'5a',
			'5a+',
			'5b',
			'5b+',
			'5c',
			'5c+',
			'6a',
			'6a+',
			'6b',
			'6b+',
			'6c',
			'6c+',
			'7a',
			'7a+',
			'7b',
			'7b+',
			'7c',
			'7c+',
			'8a',
			'8a+',
			'8b',
			'8b+',
			'8c',
			'8c+',
			'9a',
			'9a+',
			'9b',
			'9b+'
		];
		const uiaaToFrench: Record<string, string> = {
			I: '1a',
			II: '2a',
			III: '3a',
			IV: '4a',
			'IV+': '4b',
			'V-': '4c',
			V: '5a',
			'V+': '5b',
			'VI-': '5c',
			VI: '6a',
			'VI+': '6a+',
			'VII-': '6b',
			VII: '6b+',
			'VII+': '6c',
			'VIII-': '6c+',
			VIII: '7a',
			'VIII+': '7a+',
			'IX-': '7b',
			IX: '7b+',
			'IX+': '7c',
			'X-': '7c+',
			X: '8a',
			'X+': '8a+',
			'XI-': '8b',
			XI: '8b+',
			'XI+': '9a'
		};
		const grades = routes
			.map(extractRouteGrade)
			.map(normalizeGrade)
			.filter((grade): grade is string => getGradeIndex(grade) !== -1);

		const counts: Record<string, number> = {};
		let minIdx = gradeOrder.length;
		let maxIdx = 0;
		let hasData = false;

		grades.forEach((g) => {
			const idx = getGradeIndex(g);

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

			let hue = 130 - i * 5.5;
			if (hue < 0) hue = 0;
			segmentColors.push(`hsl(${hue}, 85%, 45%)`);
		}

		return {
			labels: labels,
			counts: dataCounts,
			colors: segmentColors
		};

		function extractRouteGrade(route: any): string | null {
			if (!route) return null;

			const pitchGrades = Array.isArray(route.pitches)
				? route.pitches.map((pitch: any) => pitch?.grade)
				: [];
			const grades = [route.grade, ...pitchGrades].filter(Boolean);
			if (grades.length === 0) return null;

			// Each multi-pitch route contributes only its hardest recognised climbing grade.
			return grades.reduce((hardest, grade) =>
				getGradeIndex(normalizeGrade(grade)) > getGradeIndex(normalizeGrade(hardest))
					? grade
					: hardest
			);
		}

		function getGradeIndex(grade: string | null): number {
			if (!grade) return -1;
			const index = gradeOrder.indexOf(grade);
			return index === -1 && gradeOrder.includes(grade + 'a')
				? gradeOrder.indexOf(grade + 'a')
				: index;
		}

		function normalizeGrade(grade: any): string | null {
			if (grade === null || grade === undefined) return null;
			const value = String(grade).trim();
			if (!value) return null;
			return uiaaToFrench[value.toUpperCase()] || value.toLowerCase();
		}
	}

	function initGradeChart(node: HTMLCanvasElement, config: any) {
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
							label: (ctx: any) => `${ctx.raw} ${translations.routes}`
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
			update(newConfig: any) {
				if (!newConfig || !newConfig.data) return;
				const { data, translations } = newConfig;

				chart.data.labels = [...data.labels];
				chart.data.datasets[0].data = [...data.counts];
				chart.data.datasets[0].backgroundColor = [...data.colors];
				chart.data.datasets[0].label = translations.routes;

				if (chart.options.plugins?.tooltip?.callbacks) {
					chart.options.plugins.tooltip.callbacks.label = (ctx: any) =>
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
		<canvas bind:this={canvas} use:initGradeChart={chartConfig}></canvas>
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
