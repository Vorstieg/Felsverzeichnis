import { beforeEach, describe, expect, it, vi } from 'vitest';

const entries = [
	{ name: 'Zirbitzkogel', type: ['alpine-tour'], id: 'z' },
	{ name: 'Adlitzgräben', type: ['sports-climbing'], id: 'a' },
	{ name: 'Boulderpark', type: ['bouldering'], id: 'b' }
].map((properties) => ({
	type: 'Feature',
	properties: { ...properties, kind: 'crag' },
	geometry: { type: 'Point', coordinates: [16, 48] }
}));
const files = entries.map((entry) => ({
	name: `${entry.properties.id}.json`,
	path: `${entry.properties.id}/${entry.properties.id}.json`,
	type: 'file'
}));

async function loadFetchCrags() {
	vi.resetModules();
	const module = await import('$lib/assets/js/fetchCrags');
	return module.default;
}

describe('fetchCrags', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url) => ({
				ok: true,
				json: async () =>
					url.endsWith('/?recursive=true')
						? files
						: entries.find((entry) => url.endsWith(`/${entry.properties.id}.json`))
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
		expect(fetch).toHaveBeenCalledTimes(4);
		await fetchCrags();
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it('surfaces failed data requests', async () => {
		fetch.mockResolvedValueOnce({ ok: false });
		const fetchCrags = await loadFetchCrags();
		await expect(fetchCrags()).rejects.toThrow('Failed to fetch entry directory');
	});
});
