<script lang="ts">
	import Chart from 'chart.js/auto';

	let { routes } = $props();
    let canvas: HTMLCanvasElement;
    let gradeChartData = $derived(calculateGradeStats(routes));

	function calculateGradeStats(routes: any[]) {
		if (!routes || routes.length === 0) return null;
		
		// Standard ordered grades (French scale)
		const gradeOrder = [
			'3a', '3a+', '3b', '3b+', '3c', '3c+',
			'4a', '4a+', '4b', '4b+', '4c', '4c+',
			'5a', '5a+', '5b', '5b+', '5c', '5c+', 
			'6a', '6a+', '6b', '6b+', '6c', '6c+', 
			'7a', '7a+', '7b', '7b+', '7c', '7c+', 
			'8a', '8a+', '8b', '8b+', '8c', '8c+', 
			'9a', '9a+', '9b', '9b+'
		];
		
		const counts: Record<string, number> = {};
		let minIdx = gradeOrder.length;
		let maxIdx = 0;
		let hasData = false;

		routes.forEach(r => {
			if (!r.grade) return;
			let g = r.grade.trim();
			
			let idx = gradeOrder.indexOf(g);
			if (idx === -1) {
				if (gradeOrder.includes(g + 'a')) idx = gradeOrder.indexOf(g + 'a');
			}
			
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
		const colors = [];

		for (let i = minIdx; i <= maxIdx; i++) {
			const grade = gradeOrder[i];
			labels.push(grade);
			dataCounts.push(counts[grade] || 0);
			
			let hue = 130 - (i * 5.5);
			if (hue < 0) hue = 0; 
			
			colors.push(`hsl(${hue}, 85%, 45%)`);
		}
		
		return {
			labels: labels,
			counts: dataCounts,
			colors: colors
		};
	}

	function initGradeChart(node: HTMLCanvasElement, data: any) {
		if (!data) return;
		
		const ctx = node.getContext('2d');
        if(!ctx) return;

		const chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: [...data.labels],
				datasets: [{
					label: 'Routen',
					data: [...data.counts],
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
						backgroundColor: 'rgba(0,0,0,0.8)',
						padding: 10,
						cornerRadius: 8,
						displayColors: true,
						callbacks: {
							label: (ctx: any) => `${ctx.raw} Routen`
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: { stepSize: 1 },
						grid: { color: '#f3f4f6' }
					},
					x: {
						grid: { display: false }
					}
				},
				animation: false
			}
		});

		return {
			update(newData: any) {
				if (!newData) return;
				chart.data.labels = [...newData.labels];
				chart.data.datasets[0].data = [...newData.counts];
				chart.data.datasets[0].backgroundColor = [...newData.colors];
				chart.update();
			},
			destroy() {
				chart.destroy();
			}
		};
	}
</script>

{#if gradeChartData}
    <canvas bind:this={canvas} use:initGradeChart={gradeChartData}></canvas>
{/if}

<style>
    canvas {
        width: 100%;
        height: 100%;
    }
</style>