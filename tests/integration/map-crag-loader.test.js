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
			pathRefs: [{ pathId: 'approach-1', role: 'approach', label: 'Trail' }],
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
		expect(result.topoPaths[0].properties).toMatchObject({
			role: 'approach',
			routeType: 'sports-climbing',
			label: 'Trail'
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
});
