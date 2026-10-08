import { cleanup, render } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BestSeasonChart from '$lib/components/charts/BestSeasonChart.svelte';

const chartMock = vi.hoisted(() => ({ instances: [] }));
vi.mock('chart.js/auto', () => ({
	default: vi.fn(function (_context, config) {
		const chart = { data: config.data, options: config.options, update: vi.fn(), destroy: vi.fn() };
		chartMock.instances.push(chart);
		return chart;
	})
}));

beforeEach(() => {
	chartMock.instances.length = 0;
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function checkFooter(footer) {
	expect(footer([])).toBe('');
	expect(footer([{ parsed: { y: null } }])).toBe('');
	expect(footer([{ parsed: { y: NaN } }])).toBe('');
	expect(footer([{ parsed: { y: 20 } }])).toBe('charts.ideal_conditions');
	expect(footer([{ parsed: { y: 32 } }])).toBe('charts.too_hot');
	expect(footer([{ parsed: { y: 0 } }])).toBe('charts.too_cold');
	expect(footer([{ parsed: { y: 10 } }])).toBe('');
}

it('handles empty tooltip items both initially and after updating chart data', async () => {
	const data = { labels: ['0'], feelsLikeTemps: [20], baseTemps: [15] };
	const { rerender } = render(BestSeasonChart, { props: { data } });
	const chart = chartMock.instances[0];
	checkFooter(chart.options.plugins.tooltip.callbacks.footer);

	await rerender({ data: { ...data, feelsLikeTemps: [32] } });
	expect(chart.update).toHaveBeenCalled();
	checkFooter(chart.options.plugins.tooltip.callbacks.footer);
});
