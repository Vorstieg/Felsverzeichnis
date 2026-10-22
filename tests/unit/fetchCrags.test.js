import { beforeEach, describe, expect, it, vi } from 'vitest';

const entries = [
	{ name: 'Zirbitzkogel', type: ['alpine-tour'], id: 'z' },
	{ name: 'Adlitzgräben', type: ['sports-climbing'], id: 'a' },
	{ name: 'Boulderpark', type: ['bouldering'], id: 'b' }
].map((properties) => ({
	type: 'Feature',
	properties: { ...properties, path: properties.id, kind: 'crag' },
	geometry: { type: 'Point', coordinates: [16, 48] }
}));

async function loadFetchCrags() {
	vi.resetModules();
	const module = await import('$lib/assets/js/fetchCrags');
	return module.default;
}

describe('fetchCrags', () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.restoreAllMocks();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					type: 'FeatureCollection',
					features: entries
				})
			}))
		);
	});

	it('sorts, searches, and paginates crags', async () => {
		const fetchCrags = await loadFetchCrags();
		expect((await fetchCrags({ limit: -1 })).map((x) => x.entry.properties.name)).toEqual([
			'Adlitzgräben',
			'Boulderpark',
			'Zirbitzkogel'
		]);
		expect((await fetchCrags({ search: 'BOULDER' })).map((x) => x.path)).toEqual(['b']);
		expect((await fetchCrags({ offset: 1, limit: 1 })).map((x) => x.path)).toEqual(['b']);
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

	it('hydrates from localStorage in browser mode and revalidates stale cache in the background', async () => {
		window.localStorage.setItem(
			'felsverzeichnis:crags-cache-v1',
			JSON.stringify({
				timestamp: 1,
				crags: [{ path: 'b', entry: entries[2] }]
			})
		);
		const fetchCrags = await loadFetchCrags();
		const staleResult = await fetchCrags({ limit: -1 });
		expect(staleResult.map((x) => x.path)).toEqual(['b']);
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
		const refreshedResult = await fetchCrags({ limit: -1 });
		expect(refreshedResult.map((x) => x.path)).toEqual(['a', 'b', 'z']);
	});
});
