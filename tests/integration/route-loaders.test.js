import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/assets/js/fetchCrags', () => ({
	default: vi.fn()
}));

vi.mock('$lib/search/catalog-search', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		searchCatalog: vi.fn()
	};
});

import fetchCrags from '$lib/assets/js/fetchCrags';
import { searchCatalog } from '$lib/search/catalog-search';
import { load as loadMapLayout } from '../../src/routes/map/+layout.js';
import { load as loadMapSearch } from '../../src/routes/map/[search]/+page.js';

const alpineCrag = {
	path: 'areas/alpine-crag',
	entry: {
		type: 'Feature',
		properties: { id: 'alpine-crag', name: 'Alpine Crag', kind: 'crag', type: ['sports-climbing'] },
		geometry: { type: 'Point', coordinates: [16, 48] }
	}
};
const valleyCrag = {
	path: 'areas/valley-crag',
	entry: {
		type: 'Feature',
		properties: { id: 'valley-crag', name: 'Valley Crag', kind: 'crag', type: ['sports-climbing'] },
		geometry: { type: 'Point', coordinates: [15, 47] }
	}
};

const alpineHit = {
	id: 'alpine-crag',
	docType: 'entry',
	kind: 'crag',
	name: 'Alpine Crag',
	path: 'areas/alpine-crag',
	breadcrumb: [],
	types: ['sports-climbing'],
	grades: [],
	routeCount: 0,
	_geo: { lat: 48, lng: 16 }
};
const valleyHit = {
	id: 'valley-crag',
	docType: 'entry',
	kind: 'crag',
	name: 'Valley Crag',
	path: 'areas/valley-crag',
	breadcrumb: [],
	types: ['sports-climbing'],
	grades: [],
	routeCount: 0,
	_geo: { lat: 47, lng: 15 }
};

describe('route loaders and redirects', () => {
	beforeEach(() => {
		vi.mocked(fetchCrags).mockReset();
		vi.mocked(searchCatalog).mockReset();
	});

	it('loads map layout locations and exposes them as allLocations', async () => {
		const locations = [alpineCrag];
		vi.mocked(fetchCrags).mockResolvedValue(locations);

		const result = await loadMapLayout({ fetch: globalThis.fetch });

		expect(fetchCrags).toHaveBeenCalledWith({ limit: -1, fetch: globalThis.fetch });
		expect(result).toEqual({ locations, allLocations: locations });
	});

	it('redirects a single map search result with a coordinate hash', async () => {
		vi.mocked(fetchCrags).mockResolvedValue([alpineCrag]);
		vi.mocked(searchCatalog).mockResolvedValue({
			entries: [alpineHit],
			routes: [],
			entryTotal: 1,
			routeTotal: 0
		});

		await expect(loadMapSearch({ params: { search: 'alpine' } })).rejects.toMatchObject({
			status: 302,
			location: '/map/crag/areas/alpine-crag#16/48/16'
		});
	});

	it('returns a bounds camera target for multiple map search results', async () => {
		vi.mocked(fetchCrags).mockResolvedValue([alpineCrag, valleyCrag]);
		vi.mocked(searchCatalog).mockResolvedValue({
			entries: [alpineHit, valleyHit],
			routes: [],
			entryTotal: 2,
			routeTotal: 0
		});

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
		vi.mocked(searchCatalog).mockResolvedValue({
			entries: [],
			routes: [],
			entryTotal: 0,
			routeTotal: 0
		});

		const result = await loadMapSearch({ params: { search: 'missing' } });

		expect(result).toMatchObject({
			locations: [],
			search: 'missing',
			cameraTarget: null,
			routes: []
		});
	});

	it.each(['country', 'region', 'area', 'crag', 'sector'])(
		'opens an existing %s document even when descendants also match',
		async (kind) => {
			const area = {
				path: 'areas',
				entry: {
					...alpineCrag.entry,
					properties: { id: 'areas', kind, name: 'Areas' }
				}
			};
			vi.mocked(fetchCrags).mockResolvedValue([area, alpineCrag, valleyCrag]);

			await expect(loadMapSearch({ params: { search: 'areas' } })).rejects.toMatchObject({
				status: 302,
				location: '/map/crag/areas'
			});
		}
	);

	it('keeps the filtered map for a hierarchy path without a document', async () => {
		vi.mocked(fetchCrags).mockResolvedValue([alpineCrag, valleyCrag]);
		vi.mocked(searchCatalog).mockResolvedValue({
			entries: [alpineHit, valleyHit],
			routes: [],
			entryTotal: 2,
			routeTotal: 0
		});

		const result = await loadMapSearch({ params: { search: 'areas' } });

		expect(result.locations).toEqual([alpineCrag, valleyCrag]);
		expect(result.search).toBe('areas');
		expect(result.cameraTarget.type).toBe('bounds');
	});
});
