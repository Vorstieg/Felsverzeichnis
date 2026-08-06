import { beforeEach, describe, expect, it, vi } from 'vitest';

const features = [
	{ properties: { name: 'Zirbitzkogel', type: 'alpine-tour', path: 'z' } },
	{ properties: { name: 'Adlitzgräben', type: 'sports-climbing', path: 'a' } },
	{ properties: { name: 'Boulderpark', type: 'bouldering', path: 'b' } }
];

async function loadFetchCrags() {
	vi.resetModules();
	const module = await import('$lib/assets/js/fetchCrags.js');
	return module.default;
}

describe('fetchCrags', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features }) })
		);
	});

	it('sorts, searches, and paginates crags', async () => {
		const fetchCrags = await loadFetchCrags();
		expect((await fetchCrags({ limit: -1 })).map((x) => x.properties.name)).toEqual([
			'Adlitzgräben',
			'Boulderpark',
			'Zirbitzkogel'
		]);
		expect((await fetchCrags({ search: 'BOULDER' })).map((x) => x.properties.path)).toEqual(['b']);
		expect((await fetchCrags({ offset: 1, limit: 1 })).map((x) => x.properties.path)).toEqual([
			'b'
		]);
	});

	it('deduplicates concurrent network requests and caches results', async () => {
		const fetchCrags = await loadFetchCrags();
		await Promise.all([fetchCrags(), fetchCrags()]);
		expect(fetch).toHaveBeenCalledTimes(1);
		await fetchCrags();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('surfaces failed data requests', async () => {
		fetch.mockResolvedValueOnce({ ok: false });
		const fetchCrags = await loadFetchCrags();
		await expect(fetchCrags()).rejects.toThrow('Failed to fetch map GeoJSON from API');
	});
});
