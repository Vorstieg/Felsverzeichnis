<script lang="ts">
    import Chart from 'chart.js/auto';
    import { _ } from 'svelte-i18n';

	let { data } = $props();
	let canvas: HTMLCanvasElement;

	let t_sun_altitude = $derived($_('charts.sun_altitude'));
	let chartConfig = $derived.by(() => {
		return {
			data,
			translations: {
				sun_altitude: t_sun_altitude,
				conditions: {
					'sun.sunny': $_('sun.sunny'),
					'sun.shadow': $_('sun.shadow'),
					'sun.low_sun': $_('sun.low_sun')
				}
			}
		};
	});

	function initSunChart(node: HTMLCanvasElement, config: any) {
		if (!config || !config.data) return;
		const { data, translations } = config;

		let conditions = [...data.conditions];

		const ctx = node.getContext('2d');
		if (!ctx) return;

		const chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: [...data.labels],
				datasets: [{
					label: translations.sun_altitude + ' (°)',
					data: [...data.altitudes],
					backgroundColor: [...data.colors],
					borderRadius: 4,
					borderSkipped: false
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx: any) => {
								const key = conditions[ctx.dataIndex];
								const label = translations.conditions[key] || key;
								return `${ctx.raw.toFixed(1)}° - ${label}`;
							}
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						max: 90,
						display: false,
						grid: { display: false }
					},
					x: {
						grid: { display: false },
						ticks: { font: { size: 10 } }
					}
				},
				animation: false
			}
		});

		return {
			update(newConfig: any) {
				if (!newConfig || !newConfig.data) return;
				const { data, translations } = newConfig;

				conditions = [...data.conditions];
				chart.data.labels = [...data.labels];
				chart.data.datasets[0].data = [...data.altitudes];
				chart.data.datasets[0].backgroundColor = [...data.colors];
				chart.data.datasets[0].label = translations.sun_altitude + ' (°)';

				if (chart.options.plugins?.tooltip?.callbacks) {
					chart.options.plugins.tooltip.callbacks.label = (ctx: any) => {
						const key = conditions[ctx.dataIndex];
						const label = translations.conditions[key] || key;
						return `${ctx.raw.toFixed(1)}° - ${label}`;
					};
				}

				chart.update();
			},
			destroy() {
				chart.destroy();
			}
		};
	}
</script>

<div class="chart-wrapper">
	<canvas bind:this={canvas} use:initSunChart={chartConfig}></canvas>
</div>

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