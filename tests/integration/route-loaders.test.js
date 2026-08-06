import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/assets/js/fetchCrags.js', () => ({
	default: vi.fn()
}));

import fetchCrags from '$lib/assets/js/fetchCrags.js';
import { load as loadList } from '../../src/routes/list/+page.js';
import { load as loadListSearch } from '../../src/routes/list/[search]/+page.js';
import { load as loadMapLayout } from '../../src/routes/map/+layout.js';
import { load as loadMapSearch } from '../../src/routes/map/[search]/+page.js';

const alpineCrag = {
	properties: {
		name: 'Alpine Crag',
		path: 'areas/alpine-crag',
		type: 'sports-climbing'
	},
	geometry: { type: 'Point', coordinates: [16, 48] }
};

const valleyCrag = {
	properties: {
		name: 'Valley Crag',
		path: 'areas/valley-crag',
		type: 'sports-climbing'
	},
	geometry: { type: 'Point', coordinates: [15, 47] }
};

describe('route loaders and redirects', () => {
	beforeEach(() => {
		vi.mocked(fetchCrags).mockReset();
	});

	it('loads the complete list and exposes it as allLocations', async () => {
		const crags = [alpineCrag, valleyCrag];
		vi.mocked(fetchCrags).mockResolvedValue(crags);

		const result = await loadList();

		expect(fetchCrags).toHaveBeenCalledWith({ limit: -1 });
		expect(result).toEqual({ crags, allLocations: crags });
	});

	it('loads map layout locations and exposes them as allLocations', async () => {
		const locations = [alpineCrag];
		vi.mocked(fetchCrags).mockResolvedValue(locations);

		const result = await loadMapLayout();

		expect(fetchCrags).toHaveBeenCalledWith({ limit: -1 });
		expect(result).toEqual({ locations, allLocations: locations });
	});

	it('returns multiple list search results without redirecting', async () => {
		const crags = [alpineCrag, valleyCrag];
		vi.mocked(fetchCrags).mockResolvedValue(crags);

		const result = await loadListSearch({ params: { search: 'crag' } });

		expect(fetchCrags).toHaveBeenCalledWith({ search: 'crag', limit: -1 });
		expect(result).toEqual({ crags, search: 'crag' });
	});

	it('redirects a single list search result to its map crag page', async () => {
		vi.mocked(fetchCrags).mockResolvedValue([alpineCrag]);

		await expect(loadListSearch({ params: { search: 'alpine' } })).rejects.toMatchObject({
			status: 302,
			location: '/map/crag/areas/alpine-crag'
		});
	});

	it('redirects a single map search result with a coordinate hash', async () => {
		vi.mocked(fetchCrags).mockResolvedValue([alpineCrag]);

		await expect(loadMapSearch({ params: { search: 'alpine' } })).rejects.toMatchObject({
			status: 302,
			location: '/map/crag/areas/alpine-crag#16/48/16'
		});
	});

	it('returns a bounds camera target for multiple map search results', async () => {
		vi.mocked(fetchCrags).mockResolvedValue([alpineCrag, valleyCrag]);

		const result = await loadMapSearch({ params: { search: 'crag' } });

		expect(result.locations).toEqual([alpineCrag, valleyCrag]);
		expect(result.search).toBe('crag');
		expect(result.cameraTarget).toEqual({
			type: 'bounds',
			bounds: [
				[15, 47],
				[16, 48]
			],
			padding: 80,
			maxZoom: 13
		});
	});

	it('returns no camera target for an empty map search', async () => {
		vi.mocked(fetchCrags).mockResolvedValue([]);

		const result = await loadMapSearch({ params: { search: 'missing' } });

		expect(result).toEqual({
			locations: [],
			search: 'missing',
			cameraTarget: null
		});
	});
});
