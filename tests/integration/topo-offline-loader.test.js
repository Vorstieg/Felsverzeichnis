import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fsApiUrl } from '$lib/config';
import { createCragCache } from '$lib/assets/js/crag-cache';
import { load } from '../../src/routes/topo/crag/[...crag]/+page.js';

vi.mock('$app/environment', () => ({ browser: true }));

const cragPath = 'country/region/area/crag';
const sectorPath = `${cragPath}/north`;
const crag = { properties: { id: 'crag', kind: 'crag', name: 'Cached Crag' } };
const sector = { properties: { id: 'north', kind: 'sector', name: 'North Wall' } };
const cragTopo = { routes: [{ id: 'crag-route', name: 'Crag route' }] };
const sectorTopo = { routes: [{ id: 'sector-route', name: 'Sector route' }] };
const access = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [
					[16, 48],
					[16.1, 48.1]
				]
			},
			properties: { type: 'approach' }
		}
	]
};
let stored;
let onlineFetch;
const directory = [
	{ name: 'crag.json', path: 'crag.json', type: 'file' },
	{ name: 'crag-topo.json', path: 'crag-topo.json', type: 'file' },
	{ name: 'north', path: 'north', type: 'dir' }
];
const sectorDirectory = [
	{ name: 'north.json', path: 'north.json', type: 'file' },
	{ name: 'north-topo.json', path: 'north-topo.json', type: 'file' },
	{ name: 'north.glb', path: 'north.glb', type: 'file' }
];

beforeEach(async () => {
	stored = new Map();
	vi.stubGlobal('caches', {
		open: async () => ({
			match: async (url) => stored.get(url)?.clone(),
			put: async (url, response) => stored.set(url, response.clone())
		})
	});
	const documents = new Map([
		[`${cragPath}/crag.json`, crag],
		[`${cragPath}/crag-topo.json`, cragTopo],
		[`${cragPath}/crag-access.json`, access],
		[`${sectorPath}/north.json`, sector],
		[`${sectorPath}/north-topo.json`, sectorTopo],
		[cragPath, directory],
		[sectorPath, sectorDirectory],
		[`${sectorPath}/?recursive=true`, sectorDirectory],
		[
			`${cragPath}/?recursive=true`,
			[...directory, ...sectorDirectory.map((file) => ({ ...file, path: `north/${file.path}` }))]
		]
	]);
	onlineFetch = vi.fn(async (url) => {
		const path = url.slice(fsApiUrl.length + 1);
		if (path.endsWith('/hash.txt')) return new Response('hash-1');
		if (path.endsWith('.glb')) return new Response('model');
		return documents.has(path)
			? new Response(JSON.stringify(documents.get(path)))
			: new Response(null, { status: 404 });
	});
	await createCragCache({ apiUrl: fsApiUrl, fetch: onlineFetch, useCache: true }).cacheCragFolder(
		cragPath
	);
	expect(stored.has(`${fsApiUrl}/?recursive=true`)).toBe(false);
});

afterEach(() => vi.unstubAllGlobals());

it('prefetches ancestor entries and inherited access after a cold direct sector visit', async () => {
	stored.clear();
	onlineFetch.mockClear();
	const args = {
		params: { crag: sectorPath },
		url: new URL(`https://example.test/topo/crag/${sectorPath}`),
		fetch: onlineFetch
	};
	const online = await load(args);
	expect(online.access).toEqual(access);
	await vi.waitFor(() => {
		for (const path of [
			`${cragPath}/crag.json`,
			`${cragPath}/crag-access.json`,
			`${sectorPath}/north.json`,
			`${sectorPath}/north-topo.json`,
			`${sectorPath}/north.glb`,
			sectorPath
		])
			expect(stored.has(`${fsApiUrl}/${path}`)).toBe(true);
	});
	expect(onlineFetch).not.toHaveBeenCalledWith(`${fsApiUrl}/?recursive=true`);
	expect(onlineFetch).not.toHaveBeenCalledWith(`${fsApiUrl}/${cragPath}/?recursive=true`);

	const offline = await load({
		...args,
		fetch: async () => {
			throw new TypeError('Offline');
		}
	});
	expect(offline.path).toBe(sectorPath);
	expect(offline.name).toBe('North Wall');
	expect(offline.access).toEqual(access);
	expect(offline.topo).toEqual(sectorTopo);
	expect(offline.has3D).toBe(true);
});

it.each([
	[cragPath, cragPath, null],
	[`${cragPath}/crag-route`, cragPath, cragTopo.routes[0]],
	[sectorPath, sectorPath, null],
	[`${sectorPath}/sector-route`, sectorPath, sectorTopo.routes[0]]
])('loads prefetched topo %s after an offline reload', async (requestedPath, path, route) => {
	const result = await load({
		params: { crag: requestedPath },
		url: new URL(`https://example.test/topo/crag/${requestedPath}`),
		fetch: async () => {
			throw new TypeError('Offline');
		}
	});

	expect(result.path).toBe(path);
	expect(result.name).toBe(path === sectorPath ? 'North Wall' : 'Cached Crag');
	expect(result.route).toEqual(route);
	expect(result.sectors).toEqual(path === sectorPath ? [] : [{ path: sectorPath, entry: sector }]);
	expect(result.topo).toEqual(path === sectorPath ? sectorTopo : cragTopo);
	expect(result.gradeRoutes[0].id).toBe('sector-route');
	expect(result.has3D).toBe(path === sectorPath);
});

it('returns 404 for an uncached path while offline', async () => {
	await expect(
		load({
			params: { crag: 'country/region/area/missing' },
			url: new URL('https://example.test/topo/crag/country/region/area/missing'),
			fetch: async () => {
				throw new TypeError('Offline');
			}
		})
	).rejects.toMatchObject({ status: 404 });
});
