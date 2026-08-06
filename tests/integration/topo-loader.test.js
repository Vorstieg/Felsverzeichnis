import { describe, expect, it } from 'vitest';
import { load } from '../../src/routes/topo/crag/[...crag]/+page.js';

const topo = {
	name: 'Alpine Crag topo',
	routes: [{ id: 'route-1', name: 'First route', grade: '6a' }],
	paths: { type: 'FeatureCollection', features: [] }
};

const crag = {
	properties: {
		name: 'Alpine Crag',
		type: 'sports-climbing',
		description_de: 'Beschreibung',
		sectors: [{ id: 'north', name: 'North Wall', type: 'sports-climbing' }]
	}
};

function response(value, ok = true) {
	return { ok, json: async () => value, text: async () => '' };
}

function makeFetch() {
	return async (url) => {
		if (url.endsWith('/areas/alpine-crag/alpine-crag-topo.json')) return response(topo);
		if (url.endsWith('/areas/alpine-crag/alpine-crag.json')) return response(crag);
		if (url.endsWith('/areas/alpine-crag/north/north-topo.json'))
			return response({
				routes: [{ id: 'sector-route', grade: '6b' }],
				wallAzimuth: 180,
				tags: ['sports-climbing']
			});
		if (url.endsWith('/areas/alpine-crag')) return response([]);
		return response(null, false);
	};
}

describe('topo page loader', () => {
	it('loads a crag and aggregates sector routes', async () => {
		const result = await load({
			params: { crag: 'areas/alpine-crag' },
			url: new URL('https://example.test/topo/crag/areas/alpine-crag'),
			fetch: makeFetch()
		});

		expect(result.cragName).toBe('Alpine Crag');
		expect(result.isSectorPath).toBe(false);
		expect(result.sectors).toEqual(crag.properties.sectors);
		expect(result.gradeRoutes).toEqual([
			{
				id: 'sector-route',
				grade: '6b',
				sectorId: 'north',
				sectorName: 'North Wall',
				sectorWallAzimuth: 180,
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
	});

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
