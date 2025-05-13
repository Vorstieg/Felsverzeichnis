<script lang="ts">
    import Chart from 'chart.js/auto';
    
    let { data } = $props();
    let canvas: HTMLCanvasElement;

    function initChart(node: HTMLCanvasElement, data: any) {
        if (!data) return;

        const ctx = node.getContext('2d');
        if (!ctx) return;

        const idealHigh = new Array(data.labels.length).fill(25);
        const idealLow = new Array(data.labels.length).fill(15);
        const idealMonths = data.feelsLikeTemps.map((t: number) => (t >= 15 && t <= 25) ? 40 : 0);

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...data.labels],
                datasets: [
                    // Vertical Ideal Month Bands
                    {
                        type: 'bar',
                        label: 'Ideal Month Band',
                        data: idealMonths,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
                        radius: 0,
                        borderColor: 'transparent',
                        pointRadius: 0,
                        order: 10
                    },
                    {
                        label: 'Ideal Zone',
                        data: idealHigh,
                        fill: '-1',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderColor: 'transparent',
                        radius: 0,
                        pointRadius: 0,
                        order: 10
                    },
                    // Main Data
                    {
                        label: 'Gefühlte Temperatur (°C)',
                        data: [...data.feelsLikeTemps],
                        borderColor: 'rgb(251, 191, 36)',
                        backgroundColor: 'rgba(251, 191, 36, 0.4)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: false,
                        pointBackgroundColor: (ctx) => {
                            const v = ctx.raw as number;
                            if (v >= 15 && v <= 25) return '#10b981';
                            if (v < 5 || v > 35) return '#ef4444';
                            return '#f59e0b';
                        },
                        order: 1
                    },
                    {
                        label: 'Lufttemperatur (°C)',
                        data: [...data.baseTemps],
                        borderColor: 'rgb(156, 163, 175)',
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
                        filter: (item) => !item.dataset.label.includes('Ideal'),
                        callbacks: {
                            label: (ctx) => {
                                let label = ctx.dataset.label || '';
                                if (label) label += ': ';
                                if (ctx.parsed.y !== null) label += Math.round(ctx.parsed.y) + '°C';
                                return label;
                            },
                            footer: (tooltipItems) => {
                                const v = tooltipItems[0].parsed.y;
                                if (v >= 15 && v <= 25) return 'Ideale Bedingungen';
                                if (v > 30) return 'Zu heiß';
                                if (v < 5) return 'Zu kalt';
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: '#f3f4f6' },
                        title: { display: true, text: 'Temp (°C)' },
                        suggestedMax: 35
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });

        return {
            update(newData: any) {
                if (!newData) return;
                const len = newData.labels.length;
                const newIdealMonths = newData.feelsLikeTemps.map((t: number) => (t >= 15 && t <= 25) ? 40 : 0);
                
                chart.data.labels = [...newData.labels];
                chart.data.datasets[0].data = newIdealMonths;
                chart.data.datasets[1].data = new Array(len).fill(15);
                chart.data.datasets[2].data = new Array(len).fill(25);
                chart.data.datasets[3].data = [...newData.feelsLikeTemps];
                chart.data.datasets[4].data = [...newData.baseTemps];
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

<div class="relative w-full h-full">
    <canvas bind:this={canvas} use:initChart={data}></canvas>
    <div class="absolute top-0 right-0 p-1 z-50 pointer-events-auto">
        <div class="relative flex justify-end">
            <!-- Use button for better mobile interaction -->
            <button 
                class="text-gray-400 hover:text-gray-600 focus:text-gray-600 cursor-help text-xs bg-transparent border-none p-1"
                onclick={toggleTooltip}
                onmouseenter={() => showTooltip = true}
                onmouseleave={() => showTooltip = false}
            >
                <i class="fa-solid fa-circle-info"></i>
            </button>
            {#if showTooltip}
                <div class="absolute right-0 top-6 w-48 p-2 bg-gray-800 text-white text-[10px] rounded shadow-lg z-50 pointer-events-none">
                    Diese Berechnung basiert auf der Wand-Ausrichtung, dem Breitengrad und der Höhe. Lokale Wetterphänomene (Wind, Bewölkung) werden nicht berücksichtigt.
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