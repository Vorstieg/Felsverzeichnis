<script lang="ts">
	import Chart from 'chart.js/auto';
	import { _ } from 'svelte-i18n';
	import { colors } from '$lib/colors.js';

	let { data }: { data: import('$lib/types/application').SeasonData } = $props();
	let canvas: HTMLCanvasElement;

	let t_feels_like = $derived($_('charts.feels_like'));
	let t_air_temp = $derived($_('charts.air_temp'));
	let t_ideal_month = $derived($_('charts.ideal_month_band'));
	let t_ideal_conditions = $derived($_('charts.ideal_conditions'));
	let t_too_hot = $derived($_('charts.too_hot'));
	let t_too_cold = $derived($_('charts.too_cold'));
	let t_temp_scale = $derived($_('charts.temperature'));
	let t_calculation_info = $derived($_('charts.calculation_info'));

	let chartConfig = $derived.by(() => {
		const months = [];
		for (let i = 0; i < 12; i++) {
			months.push($_(`months.${i}`));
		}
		return {
			data,
			translations: {
				feels_like: t_feels_like,
				air_temp: t_air_temp,
				ideal_month: t_ideal_month,
				ideal_conditions: t_ideal_conditions,
				too_hot: t_too_hot,
				too_cold: t_too_cold,
				temp_scale: t_temp_scale,
				months: months
			}
		};
	});

	function initChart(node: HTMLCanvasElement, config: typeof chartConfig) {
		if (!config || !config.data) return;

		const ctx = node.getContext('2d');
		if (!ctx) return;

		const { data, translations } = config;

		const idealHigh = new Array(data.labels.length).fill(25);
		const idealLow = new Array(data.labels.length).fill(15);
		const idealMonths = data.feelsLikeTemps.map((t: number) => (t >= 15 && t <= 25 ? 40 : 0));

		const chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: data.labels.map((idx: string) => translations.months[parseInt(idx)] || idx),
				datasets: [
					// Vertical Ideal Month Bands
					{
						type: 'bar',
						label: translations.ideal_month,
						data: idealMonths,
						backgroundColor: `${colors.chart.good}1a`,
						barPercentage: 1.0,
						categoryPercentage: 1.0,
						borderWidth: 0,
						order: 20
					},
					// Ideal Range Horizontal
					{
						label: 'Ideal Low',
						data: idealLow,
						fill: false,
						pointRadius: 0,
						borderColor: 'transparent',
						order: 10
					},
					{
						label: 'Ideal Zone',
						data: idealHigh,
						fill: '-1',
						backgroundColor: `${colors.chart.good}1a`,
						borderColor: 'transparent',
						pointRadius: 0,
						order: 10
					},
					// Main Data
					{
						label: translations.feels_like + ' (°C)',
						data: [...data.feelsLikeTemps],
						borderColor: colors.chart.temperature,
						backgroundColor: `${colors.chart.temperature}66`,
						borderWidth: 3,
						tension: 0.4,
						fill: false,
						pointBackgroundColor: (ctx) => {
							const v = ctx.parsed.y;
							if (v >= 15 && v <= 25) return colors.chart.good;
							if (v < 5 || v > 35) return colors.chart.danger;
							return colors.chart.warning;
						},
						order: 1
					},
					{
						label: translations.air_temp + ' (°C)',
						data: [...data.baseTemps],
						borderColor: colors.text.muted,
						borderWidth: 2,
						borderDash: [5, 5],
						tension: 0.4,
						pointRadius: 0,
						fill: false,
						order: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						labels: {
							font: { size: 10 },
							boxWidth: 10,
							filter: (item) => !item.text.includes('Ideal')
						}
					},
					tooltip: {
						mode: 'index',
						intersect: false,
						filter: (item) => !(item.dataset.label ?? '').includes('Ideal'),
						callbacks: {
							label: (ctx) => {
								let label = ctx.dataset.label || '';
								if (label) label += ': ';
								if (ctx.parsed.y !== null) label += Math.round(ctx.parsed.y) + '°C';
								return label;
							},
							footer: (tooltipItems) => {
								const v = tooltipItems[0]?.parsed.y;
								if (typeof v !== 'number' || !Number.isFinite(v)) return '';
								if (v >= 15 && v <= 25) return translations.ideal_conditions;
								if (v > 30) return translations.too_hot;
								if (v < 5) return translations.too_cold;
								return '';
							}
						}
					}
				},
				scales: {
					y: {
						beginAtZero: false,
						grid: { color: colors.chart.grid },
						title: { display: true, text: translations.temp_scale + ' (°C)' },
						suggestedMax: 35
					},
					x: {
						grid: { display: false }
					}
				}
			}
		});

		return {
			update(newConfig: typeof chartConfig) {
				if (!newConfig || !newConfig.data) return;
				const { data, translations } = newConfig;
				const len = data.labels.length;
				const newIdealMonths = data.feelsLikeTemps.map((t: number) =>
					t >= 15 && t <= 25 ? 40 : 0
				);

				chart.data.labels = data.labels.map(
					(idx: string) => translations.months[parseInt(idx)] || idx
				);
				chart.data.datasets[0].data = newIdealMonths;
				chart.data.datasets[0].label = translations.ideal_month;
				chart.data.datasets[1].data = new Array(len).fill(15);
				chart.data.datasets[2].data = new Array(len).fill(25);
				chart.data.datasets[3].data = [...data.feelsLikeTemps];
				chart.data.datasets[3].label = translations.feels_like + ' (°C)';
				chart.data.datasets[4].data = [...data.baseTemps];
				chart.data.datasets[4].label = translations.air_temp + ' (°C)';

				if (chart.options.scales?.y?.title) {
					chart.options.scales.y.title.text = translations.temp_scale + ' (°C)';
				}

				// Update tooltip callback closure scope? No, the options object is ref-ed.
				// We need to re-assign the callback or the callback should read from a mutable source.
				// Re-assigning options.plugins.tooltip.callbacks.footer
				if (chart.options.plugins?.tooltip?.callbacks) {
					chart.options.plugins.tooltip.callbacks.footer = (tooltipItems) => {
						const v = tooltipItems[0]?.parsed.y;
						if (typeof v !== 'number' || !Number.isFinite(v)) return '';
						if (v >= 15 && v <= 25) return translations.ideal_conditions;
						if (v > 30) return translations.too_hot;
						if (v < 5) return translations.too_cold;
						return '';
					};
				}

				chart.update();
			},
			destroy() {
				chart.destroy();
			}
		};
	}

	let showTooltip = $state(false);

	function toggleTooltip() {
		showTooltip = !showTooltip;
	}
</script>

<div class="relative h-full w-full">
	<canvas bind:this={canvas} use:initChart={chartConfig}></canvas>
	<div class="pointer-events-auto absolute top-0 right-0 z-50 p-1">
		<div class="relative flex justify-end">
			<!-- Use button for better mobile interaction -->
			<button
				class="cursor-help border-none bg-transparent p-1 text-xs text-gray-400 hover:text-gray-600 focus:text-gray-600"
				aria-label="Show calculation information"
				onclick={toggleTooltip}
				onmouseenter={() => (showTooltip = true)}
				onmouseleave={() => (showTooltip = false)}
			>
				<i class="fa-solid fa-circle-info"></i>
			</button>
			{#if showTooltip}
				<div
					class="pointer-events-none absolute top-6 right-0 z-50 w-48 rounded bg-gray-800 p-2 text-[10px] text-white shadow-lg"
				>
					{t_calculation_info}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	canvas {
		width: 100%;
		height: 100%;
	}
</style>
