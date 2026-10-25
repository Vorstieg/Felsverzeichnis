import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fsApiUrl as API } from '$lib/config';
import { load } from '../../src/routes/map/crag/[...crag]/+page.js';

const crag = {
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [16, 48] },
	properties: {
		name: 'Alpine Crag',
		id: 'alpine-crag',
		kind: 'crag',
		type: ['sports-climbing'],
		description_de: 'Beschreibung'
	}
};

const topo = {
	routes: [
		{
			id: 'route-1',
			type: 'sports-climbing',
			pathRefs: [
				{ pathId: 'main-1', role: 'main', label: 'Route Line' },
				{ pathId: 'approach-1', role: 'approach', label: 'Trail' }
			],
			points2D: [
				[0.1, 0.9],
				[0.9, 0.1]
			]
		}
	],
	paths: {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				id: 'main-1',
				geometry: {
					type: 'LineString',
					coordinates: [
						[16, 48],
						[16.02, 48.02]
					]
				},
				properties: { name: 'Main Line' }
			},
			{
				type: 'Feature',
				id: 'approach-1',
				geometry: {
					type: 'LineString',
					coordinates: [
						[16, 48],
						[16.01, 48.01]
					]
				},
				properties: { name: 'Old label' }
			}
		]
	}
};

const access = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			properties: { kind: 'transit' },
			geometry: { type: 'Point', coordinates: [16.1, 48.1] }
		},
		{
			type: 'Feature',
			properties: { kind: 'parking' },
			geometry: { type: 'Point', coordinates: [16.2, 48.2] }
		}
	]
};

function response(value, ok = true) {
	return { ok, json: async () => value, text: async () => String(value) };
}

function makeCache() {
	const entries = new Map();
	return {
		match: vi.fn(async (url) => entries.get(typeof url === 'string' ? url : url.url)),
		put: vi.fn(async (url, value) => entries.set(url, value)),
		entries
	};
}

function makeFetch({ offlineCrag = false, topoDocument = topo } = {}) {
	return vi.fn(async (url) => {
		if (offlineCrag && url.endsWith('/areas/alpine-crag/alpine-crag.json'))
			throw new Error('offline');
		if (url.endsWith('/areas/alpine-crag/alpine-crag.json')) return response(crag);
		if (url.endsWith('/areas/alpine-crag/alpine-crag-access.json')) return response(access);
		if (url.endsWith('/areas/alpine-crag/alpine-crag-topo.json')) return response(topoDocument);
		if (url.endsWith('/areas/alpine-crag/')) return response([]);
		if (url.endsWith('/areas/alpine-crag')) return response([]);
		if (url.endsWith('/areas/alpine-crag/hash.txt')) return response('hash-1');
		if (url.endsWith('/areas/alpine-crag/?recursive=true'))
			return response([
				{ type: 'file', name: 'alpine-crag-topo.json', path: 'alpine-crag-topo.json' },
				{ type: 'file', name: 'alpine-crag-access.json', path: 'alpine-crag-access.json' }
			]);
		return response(null, false);
	});
}

function makeArgs(fetch, params = { crag: 'areas/alpine-crag' }) {
	return {
		params,
		url: new URL(`https://example.test/map/crag/${params.crag}`),
		fetch,
		parent: async () => ({
			locations: [{ entry: crag, path: 'areas/alpine-crag' }],
			allLocations: [{ entry: crag, path: 'areas/alpine-crag' }]
		})
	};
}

describe('map crag loader', () => {
	let cache;

	beforeEach(() => {
		vi.restoreAllMocks();
		cache = makeCache();
		vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
	});

	it('resolves crag data, enriches topo paths, and streams details', async () => {
		const result = await load(makeArgs(makeFetch()));

		expect(result.name).toBe('Alpine Crag');
		expect(result.cameraTarget).toEqual({ type: 'center', center: [16, 48], zoom: 16 });
		expect(result.topoPaths).toHaveLength(1);
		expect(result.topoPaths[0].properties).toMatchObject({
			role: 'main',
			routeType: 'sports-climbing',
			label: 'Route Line'
		});

		const details = await result.streamed.details;
		expect(details.access).toEqual(access);
		expect(details.transit).toEqual([16.1, 48.1]);
		expect(details.parking).toEqual([16.2, 48.2]);
		expect(details.has2DTopo).toBe(true);
		expect(details.has3DTopo).toBe(false);
	});

	it('detects a 2D topo when points exist only on multi-pitch pitches', async () => {
		const pitchOnlyTopo = {
			...topo,
			routes: [
				{
					...topo.routes[0],
					points2D: undefined,
					pitches: [
						{
							id: 'pitch-1',
							points2D: [
								[0.1, 0.9],
								[0.9, 0.1]
							]
						}
					]
				}
			]
		};

		const result = await load(makeArgs(makeFetch({ topoDocument: pitchOnlyTopo })));

		expect((await result.streamed.details).has2DTopo).toBe(true);
	});

	it('uses cached JSON when the crag request is unavailable', async () => {
		const cachedCrag = new Response(JSON.stringify(crag), {
			headers: { 'content-type': 'application/json' }
		});
		cache.entries.set(`${API}/areas/alpine-crag/alpine-crag.json`, cachedCrag);

		const result = await load(makeArgs(makeFetch({ offlineCrag: true })));

		expect(result.currentData.properties.name).toBe('Alpine Crag');
		expect(cache.match).toHaveBeenCalledWith(`${API}/areas/alpine-crag/alpine-crag.json`, {
			ignoreVary: true,
			ignoreSearch: true
		});
	});

	it('returns a 404 when the parent locations do not contain the requested crag', async () => {
		await expect(
			load({
				...makeArgs(makeFetch()),
				parent: async () => ({ locations: [], allLocations: [] }),
				params: { crag: 'missing/crag' }
			})
		).rejects.toMatchObject({ status: 404 });
	});

	it.each([
		['country', 'austria'],
		['region', 'austria/tyrol'],
		['area', 'austria/tyrol/innsbruck']
	])('displays an existing %s entry without a crag ancestor', async (kind, path) => {
		const id = path.split('/').at(-1);
		const entry = {
			...crag,
			properties: { id, kind, name: `Selected ${kind}`, description_de: 'Hierarchy description' }
		};
		const fetch = vi.fn(async (url) => {
			if (url === `${API}/${path}/${id}.json`) return response(entry);
			if (url === `${API}/${path}`)
				return response([{ type: 'file', name: 'overview.jpg', path: 'overview.jpg' }]);
			return response(null, false);
		});
		const result = await load({
			...makeArgs(fetch, { crag: path }),
			parent: async () => ({
				locations: [{ entry, path }],
				allLocations: [
					{ entry, path },
					{ entry: crag, path: `${path}/alpine-crag` }
				]
			})
		});

		expect(result.currentData).toEqual(entry);
		expect(result.name).toBe(`Selected ${kind}`);
		expect(result.description_de).toBe('Hierarchy description');
		expect(result.meta.title).toBe(`Selected ${kind}`);
		expect(result.currentLocation.getFolder()).toBe(path);
		expect(result.currentLocation.sectorId).toBeNull();
		expect(result.sectors).toEqual([{ entry: crag, path: `${path}/alpine-crag` }]);
		expect(await result.streamed.details).toMatchObject({
			images: [`${API}/${path}/overview.jpg`],
			gradeRoutes: [],
			sectorTopos: [],
			has2DTopo: false,
			has3DTopo: false
		});
	});

	it('keeps crag and sector loading when hierarchy documents are absent', async () => {
		const path = 'areas/alpine-crag/north';
		const sector = {
			...crag,
			properties: { id: 'north', kind: 'sector', name: 'North Wall' }
		};
		const fetchCrag = makeFetch();
		const result = await load({
			...makeArgs(
				async (url) => (url === `${API}/${path}/north.json` ? response(sector) : fetchCrag(url)),
				{ crag: path }
			),
			parent: async () => ({
				locations: [{ entry: crag, path: 'areas/alpine-crag' }],
				allLocations: [
					{ entry: crag, path: 'areas/alpine-crag' },
					{ entry: sector, path }
				]
			})
		});

		expect(result.currentData).toEqual(sector);
		expect(result.cragData).toEqual(sector);
		expect(result.parentEntry.entry).toEqual(crag);
		expect(result.currentLocation.getCurrentPath()).toBe(`${path}/north.json`);
		expect(result.cragPathUrl).toBe(path);
		await result.streamed.details;
	});

	it('falls back to parent access when sector access has empty features and aggregates sector topoPaths for parent crags', async () => {
		const sectorPath = 'areas/alpine-crag/north';
		const sector = {
			...crag,
			properties: { id: 'north', kind: 'sector', name: 'North Wall' }
		};
		const fetchForSector = vi.fn(async (url) => {
			if (url.endsWith('/areas/alpine-crag/north/north.json')) return response(sector);
			if (url.endsWith('/areas/alpine-crag/north/north-access.json'))
				return response({ type: 'FeatureCollection', features: [] });
			if (url.endsWith('/areas/alpine-crag/alpine-crag-access.json')) return response(access);
			if (url.endsWith('/areas/alpine-crag/north/north-topo.json')) return response(topo);
			return response(null, false);
		});

		const sectorResult = await load({
			...makeArgs(fetchForSector, { crag: sectorPath }),
			parent: async () => ({
				locations: [{ entry: crag, path: 'areas/alpine-crag' }],
				allLocations: [
					{ entry: crag, path: 'areas/alpine-crag' },
					{ entry: sector, path: sectorPath }
				]
			})
		});
		const sectorDetails = await sectorResult.streamed.details;
		expect(sectorDetails.access).toEqual(access);

		const fetchForParentWithoutOwnTopo = vi.fn(async (url) => {
			if (url.endsWith('/areas/alpine-crag/alpine-crag.json')) return response(crag);
			if (url.endsWith('/areas/alpine-crag/alpine-crag-access.json')) return response(access);
			if (url.endsWith('/areas/alpine-crag/north/north-topo.json')) return response(topo);
			if (url.endsWith('/areas/alpine-crag')) return response([]);
			return response(null, false);
		});

		const parentResult = await load({
			...makeArgs(fetchForParentWithoutOwnTopo, { crag: 'areas/alpine-crag' }),
			parent: async () => ({
				locations: [{ entry: crag, path: 'areas/alpine-crag' }],
				allLocations: [
					{ entry: crag, path: 'areas/alpine-crag' },
					{ entry: sector, path: sectorPath }
				]
			})
		});
		expect(parentResult.topoPaths).toEqual([]);
		const parentDetails = await parentResult.streamed.details;
		expect(parentDetails.topoPaths).toHaveLength(1);
		expect(parentDetails.topoPaths[0].properties).toMatchObject({
			role: 'main',
			routeType: 'sports-climbing',
			label: 'Route Line'
		});
	});

	it('resolves an individual route on a crag and shows route-specific tracks', async () => {
		const result = await load(makeArgs(makeFetch(), { crag: 'areas/alpine-crag/route-1' }));

		expect(result.route).toBeDefined();
		expect(result.route.id).toBe('route-1');
		expect(result.routeId).toBe('route-1');
		expect(result.cragPathUrl).toBe('areas/alpine-crag');
		expect(result.meta.title).toBe('route-1 - Alpine Crag');
		expect(result.topoPaths).toHaveLength(2);
		expect(result.topoPaths.map((p) => p.properties.role)).toEqual(['main', 'approach']);
	});

	it('returns a 404 for a missing route on an existing crag', async () => {
		await expect(
			load(makeArgs(makeFetch(), { crag: 'areas/alpine-crag/missing-route' }))
		).rejects.toMatchObject({ status: 404 });
	});

	it('resolves an individual route belonging to a child sector', async () => {
		const sectorPath = 'areas/alpine-crag/north';
		const sector = {
			...crag,
			properties: { id: 'north', kind: 'sector', name: 'North Wall' }
		};
		const fetchForSector = vi.fn(async (url) => {
			if (url.endsWith('/areas/alpine-crag/alpine-crag.json')) return response(crag);
			if (url.endsWith('/areas/alpine-crag/alpine-crag-access.json')) return response(access);
			if (url.endsWith('/areas/alpine-crag/north/north.json')) return response(sector);
			if (url.endsWith('/areas/alpine-crag/north/north-access.json')) return response(access);
			if (url.endsWith('/areas/alpine-crag/north/north-topo.json')) return response(topo);
			if (url.endsWith('/areas/alpine-crag')) return response([]);
			return response(null, false);
		});

		const result = await load({
			...makeArgs(fetchForSector, { crag: `${sectorPath}/route-1` }),
			parent: async () => ({
				locations: [{ entry: crag, path: 'areas/alpine-crag' }],
				allLocations: [
					{ entry: crag, path: 'areas/alpine-crag' },
					{ entry: sector, path: sectorPath }
				]
			})
		});

		expect(result.route).toBeDefined();
		expect(result.route.id).toBe('route-1');
		expect(result.cragPathUrl).toBe(sectorPath);
		expect(result.meta.title).toBe('route-1 - North Wall');
	});

	it('targets center at zoom 16 for short climbing routes to prevent zooming out', async () => {
		const shortTopo = {
			...topo,
			routes: [
				{
					id: 'short-route',
					type: 'multi-pitch',
					pathRefs: [
						{ pathId: 'short-main', role: 'main' },
						{ pathId: 'long-approach', role: 'approach' }
					]
				}
			],
			paths: {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: 'short-main',
						geometry: {
							type: 'LineString',
							coordinates: [
								[16.0538, 47.8329],
								[16.0539, 47.8331]
							]
						}
					},
					{
						type: 'Feature',
						id: 'long-approach',
						geometry: {
							type: 'LineString',
							coordinates: [
								[16.04, 47.82],
								[16.0538, 47.8329]
							]
						}
					}
				]
			}
		};

		const fetchShort = vi.fn(async (url) => {
			if (url.endsWith('/areas/alpine-crag/alpine-crag.json')) return response(crag);
			if (url.endsWith('/areas/alpine-crag/alpine-crag-topo.json')) return response(shortTopo);
			if (url.endsWith('/areas/alpine-crag')) return response([]);
			return response(null, false);
		});

		const result = await load(makeArgs(fetchShort, { crag: 'areas/alpine-crag/short-route' }));
		expect(result.cameraTarget).toEqual({
			type: 'center',
			center: [(16.0538 + 16.0539) / 2, (47.8329 + 47.8331) / 2],
			zoom: 16
		});
	});
});
