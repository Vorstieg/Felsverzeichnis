import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/assets/js/fetchCrags', () => ({ default: vi.fn() }));
import fetchCrags from '$lib/assets/js/fetchCrags';
import { load } from '../../src/routes/topo/crag/[...crag]/+page.js';

const topo = {
	routes: [
		{
			id: 'route-1',
			name: 'First route',
			grade: { scale: 'french', value: '6a', standardizedValue: '6a' }
		}
	],
	paths: { type: 'FeatureCollection', features: [] }
};

const crag = {
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [16, 48] },
	properties: {
		id: 'alpine-crag',
		kind: 'crag',
		name: 'Alpine Crag',
		type: ['sports-climbing'],
		description_de: 'Beschreibung'
	}
};

function response(value, ok = true) {
	return { ok, json: async () => value, text: async () => '' };
}

function makeFetch() {
	return async (url) => {
		if (url.endsWith('/areas/alpine-crag/alpine-crag-topo.json')) return response(topo);
		if (url.endsWith('/areas/alpine-crag/alpine-crag.json')) return response(crag);
		if (url.endsWith('/areas/alpine-crag/north/north.json')) return response(sector.entry);
		if (url.endsWith('/areas/alpine-crag/north/north-topo.json'))
			return response({
				routes: [
					{ id: 'sector-route', grade: { scale: 'french', value: '6b', standardizedValue: '6b' } }
				],
				wallAzimuth: 180,
				tags: ['sports-climbing']
			});
		if (url.endsWith('/areas/alpine-crag'))
			return response([{ type: 'dir', name: 'north', path: 'north' }]);
		return response(null, false);
	};
}

const sector = {
	path: 'areas/alpine-crag/north',
	entry: {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [16, 48] },
		properties: { id: 'north', kind: 'sector', name: 'North Wall', type: ['sports-climbing'] }
	}
};

describe('topo page loader', () => {
	beforeEach(() => {
		vi.mocked(fetchCrags).mockReset();
		vi.mocked(fetchCrags).mockResolvedValue([{ entry: crag, path: 'areas/alpine-crag' }, sector]);
	});
	it('loads a crag and aggregates sector routes', async () => {
		const result = await load({
			params: { crag: 'areas/alpine-crag' },
			url: new URL('https://example.test/topo/crag/areas/alpine-crag'),
			fetch: makeFetch()
		});

		expect(result.name).toBe('Alpine Crag');
		expect(fetchCrags).not.toHaveBeenCalled();
		expect(result.sectors).toEqual([sector]);
		expect(result.gradeRoutes).toEqual([
			{
				id: 'sector-route',
				downloadTracks: [],
				grade: { scale: 'french', value: '6b', standardizedValue: '6b' },
				sectorId: 'north',
				sectorName: 'North Wall',
				sectorTags: ['sports-climbing']
			}
		]);
	});

	it('resolves a route child from a crag topo', async () => {
		const result = await load({
			params: { crag: 'areas/alpine-crag/route-1' },
			url: new URL('https://example.test/topo/crag/areas/alpine-crag/route-1'),
			fetch: makeFetch()
		});

		expect(result.path).toBe('areas/alpine-crag');
		expect(result.route).toEqual(topo.routes[0]);
		expect(fetchCrags).not.toHaveBeenCalled();
	});

	it('uses the index as a fallback when the requested entry cannot be fetched directly', async () => {
		const directFetch = makeFetch();
		const result = await load({
			params: { crag: 'areas/alpine-crag' },
			url: new URL('https://example.test/topo/crag/areas/alpine-crag'),
			fetch: (url) => (url.endsWith('/alpine-crag.json') ? response(null, false) : directFetch(url))
		});

		expect(result.name).toBe('Alpine Crag');
		expect(fetchCrags).toHaveBeenCalledOnce();
	});

	it.each(['country', 'region', 'area', 'crag', 'sector'])(
		'keeps a %s with a published ancestor as the selected entry',
		async (kind) => {
			const directFetch = makeFetch();
			const result = await load({
				params: { crag: 'areas/alpine-crag' },
				url: new URL('https://example.test/topo/crag/areas/alpine-crag'),
				fetch: (url) => {
					if (url.endsWith('/areas/areas.json'))
						return response({ properties: { id: 'areas', kind: 'area', name: 'Parent Area' } });
					if (url.endsWith('/alpine-crag.json'))
						return response({ ...crag, properties: { ...crag.properties, kind } });
					return directFetch(url);
				}
			});

			expect(result.name).toBe('Alpine Crag');
			expect(result.path).toBe('areas/alpine-crag');
		}
	);

	it('returns a SvelteKit 404 for unknown paths', async () => {
		await expect(
			load({
				params: { crag: 'missing/crag' },
				url: new URL('https://example.test/topo/crag/missing/crag'),
				fetch: async () => response(null, false)
			})
		).rejects.toMatchObject({ status: 404 });
	});
});
