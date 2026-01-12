<script lang="ts">
	import Chart from 'chart.js/auto';
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';

	let { route } = $props();
	const dispatch = createEventDispatcher();

	let canvas: HTMLCanvasElement;

	let t_steepness = $derived($_('charts.steepness'));
	let t_distance = $derived($_('charts.distance'));

	function processRouteData(currentRoute: any) {
		if (!currentRoute || !currentRoute.points) return null;

		const rawPoints = currentRoute.points.map((p: any) => p.map((c: any) => parseFloat(c)));

		const smoothedPoints = [];
		const windowSize = 4;
		for (let i = 0; i < rawPoints.length; i++) {
			let sumX = 0, sumY = 0, sumZ = 0;
			let count = 0;
			const start = Math.max(0, i - windowSize);
			const end = Math.min(rawPoints.length - 1, i + windowSize);
			for (let j = start; j <= end; j++) {
				sumX += rawPoints[j][0];
				sumY += rawPoints[j][1];
				sumZ += rawPoints[j][2];
				count++;
			}
			smoothedPoints.push([sumX / count, sumY / count, sumZ / count]);
		}

		const segments = [];
		let totalModelDistance = 0;

		let normX = 0;
		let normZ = 0;
		if (currentRoute.orientation) {
			const [ox, , oz] = currentRoute.orientation;
			const len = Math.sqrt(ox * ox + oz * oz);
			if (len > 0) {
				normX = ox / len;
				normZ = oz / len;
			}
		}

		for (let i = 0; i < smoothedPoints.length - 1; i++) {
			const p1 = smoothedPoints[i];
			const p2 = smoothedPoints[i + 1];
			const dx = p2[0] - p1[0];
			const dy = p2[1] - p1[1];
			const dz = p2[2] - p1[2];
			const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

			let angle;
			if (currentRoute.orientation && (normX !== 0 || normZ !== 0)) {
				const h = dx * normX + dz * normZ;
				angle = Math.atan2(Math.abs(dy), -h) * (180 / Math.PI);
			} else {
				const hDist = Math.sqrt(dx * dx + dz * dz);
				angle = Math.atan2(Math.abs(dy), hDist) * (180 / Math.PI);
			}

			// Sanitize angle
			if (isNaN(angle)) angle = 0;

			segments.push({ dist, angle });
			totalModelDistance += dist;
		}

		if (isNaN(totalModelDistance) || totalModelDistance <= 0.001) return null;

		let scale = 1;
		let routeLength = 0;

		if (currentRoute.length) {
			routeLength = parseFloat(currentRoute.length);
		}

		// If length is missing or invalid, fallback to model distance
		if (isNaN(routeLength) || routeLength <= 0) {
			routeLength = totalModelDistance;
		}

		if (routeLength > 0 && totalModelDistance > 0) {
			scale = routeLength / totalModelDistance;
		}

		const steepnessData = [];
		let currentDistance = 0;
		let slabLength = 0;
		let verticalLength = 0;
		let overhangLength = 0;
		let totalRealLength = 0;

		if (segments.length > 0) {
			steepnessData.push({ x: 0, y: segments[0].angle });
		}

		for (const segment of segments) {
			const realSegmentLength = segment.dist * scale;
			totalRealLength += realSegmentLength;

			if (segment.angle < 80) {
				slabLength += realSegmentLength;
			} else if (segment.angle >= 80 && segment.angle <= 100) {
				verticalLength += realSegmentLength;
			} else {
				overhangLength += realSegmentLength;
			}

			currentDistance += realSegmentLength;
			steepnessData.push({ x: currentDistance, y: segment.angle });
		}

		const metrics = {
			slab: totalRealLength > 0 ? ((slabLength / totalRealLength) * 100).toFixed(1) : '0.0',
			vertical: totalRealLength > 0 ? ((verticalLength / totalRealLength) * 100).toFixed(1) : '0.0',
			overhang: totalRealLength > 0 ? ((overhangLength / totalRealLength) * 100).toFixed(1) : '0.0'
		};

		return { steepnessData, metrics, length: routeLength };
	}

	let chartData = $derived(processRouteData(route));

	// Combined config
	let chartConfig = $derived({
		data: chartData,
		translations: {
			steepness: t_steepness,
			distance: t_distance
		}
	});

	$effect(() => {
		if (chartData) {
			dispatch('metrics', chartData.metrics);
		}
	});

	function initChart(node: HTMLCanvasElement, config: any) {
		if (!config || !config.data) return;
		const { data, translations } = config;

		const ctx = node.getContext('2d');
		if (!ctx) return;

		const chart = new Chart(ctx, {
			type: 'line',
			data: {
				datasets: [{
					label: translations.steepness + ' (°)',
					backgroundColor: 'rgb(255, 99, 132)',
					borderColor: (context: any) => {
						const chart = context.chart;
						const { ctx, chartArea, scales } = chart;
						if (!chartArea || !scales.y) return '#999';

						const y = scales.y;
						const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

						const getOffset = (val: number) => {
							const pixel = y.getPixelForValue(val);
							return Math.max(0, Math.min(1, (pixel - chartArea.top) / (chartArea.bottom - chartArea.top)));
						};

						gradient.addColorStop(0, '#ef4444');
						gradient.addColorStop(getOffset(110), '#ef4444');
						gradient.addColorStop(getOffset(100), '#facc15');
						gradient.addColorStop(getOffset(80), '#facc15');
						gradient.addColorStop(getOffset(70), '#2dd4bf');
						gradient.addColorStop(1, '#2dd4bf');

						return gradient;
					},
					data: data.steepnessData,
					pointRadius: 0,
					pointHitRadius: 10,
					borderWidth: 3,
					tension: 0.4,
					fill: false
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						type: 'linear',
						title: { display: true, text: translations.distance + ' (m)' },
						ticks: { maxTicksLimit: 10 },
						max: data.length,
						grid: { lineWidth: 0.5, color: 'rgb(240, 240, 240)' }
					},
					y: {
						title: { display: true, text: translations.steepness + ' (°)' },
						suggestedMin: 0,
						suggestedMax: 120,
						grid: { lineWidth: 0.5, color: 'rgb(240, 240, 240)' }
					}
				},
				plugins: {
					tooltip: {
						mode: 'index',
						intersect: false,
						callbacks: {
							label: function(context: any) {
								return context.parsed.y.toFixed(1) + '°';
							}
						}
					},
					legend: { display: false }
				}
			}
		});

		return {
			update(newConfig: any) {
				if (!newConfig || !newConfig.data) return;
				const { data, translations } = newConfig;

				chart.data.datasets[0].data = data.steepnessData;
				chart.data.datasets[0].label = translations.steepness + ' (°)';

				if (chart.options.scales?.x?.title) {
					chart.options.scales.x.title.text = translations.distance + ' (m)';
					chart.options.scales.x.max = data.length;
				}
				if (chart.options.scales?.y?.title) {
					chart.options.scales.y.title.text = translations.steepness + ' (°)';
				}

				chart.update();
			},
			destroy() {
				chart.destroy();
			}
		};
	}

</script>

{#if chartData}
	<div class="chart-wrapper">
		<canvas bind:this={canvas} use:initChart={chartConfig}></canvas>
	</div>
{/if}

<style>
    .chart-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0; /* Important for flex items */
    }

    canvas {
        width: 100%;
        height: 100%;
    }
</style>