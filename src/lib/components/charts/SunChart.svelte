<script lang="ts">
	import Chart from 'chart.js/auto';

	let { data } = $props();
    let canvas: HTMLCanvasElement;

	function initSunChart(node: HTMLCanvasElement, data: any) {
		if (!data) return;
		
		let conditions = [...data.conditions];
		
		const ctx = node.getContext('2d');
        if(!ctx) return;

		const chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: [...data.labels],
				datasets: [{
					label: 'Sonnenhöhe (°)',
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
							label: (ctx: any) => `${ctx.raw.toFixed(1)}° - ${conditions[ctx.dataIndex]}`
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
			update(newData: any) {
				if (!newData) return;
				conditions = [...newData.conditions];
				chart.data.labels = [...newData.labels];
				chart.data.datasets[0].data = [...newData.altitudes];
				chart.data.datasets[0].backgroundColor = [...newData.colors];
				chart.update();
			},
			destroy() {
				chart.destroy();
			}
		};
	}
</script>

<canvas bind:this={canvas} use:initSunChart={data}></canvas>

<style>
    canvas {
        width: 100%;
        height: 100%;
    }
</style>