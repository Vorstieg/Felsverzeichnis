import { describe, expect, it, vi } from 'vitest';
import { fsApiUrl } from '$lib/config';
import { load as loadMap } from '../../src/routes/map/crag/[...crag]/+page.js';
import { load as loadTopo } from '../../src/routes/topo/crag/[...crag]/+page.js';

vi.mock('$lib/assets/js/fetchCrags', () => ({
	default: vi.fn(async () => {
		throw new TypeError('Index unavailable');
	})
}));

const kinds = ['country', 'region', 'area', 'crag', 'sector'];

function fixture(kind) {
	const path = 'missing-parent/place';
	const childPath = `${path}/child`;
	const entry = {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [16, 48] },
		properties: { kind, id: 'place', name: 'Selected entry', description_de: 'Description' }
	};
	const child = { ...entry, properties: { ...entry.properties, id: 'child', name: 'Child entry' } };
	const topo = {
		routes: [
			{
				id: 'route',
				name: 'Route',
				points2D: [
					[0, 0],
					[1, 1]
				]
			}
		]
	};
	const childTopo = { routes: [{ id: 'child-route', name: 'Child route' }] };
	const access = { type: 'FeatureCollection', features: [] };
	const files = [
		{ type: 'dir', path: 'child', name: 'child' },
		{ type: 'file', path: 'photo.jpg', name: 'photo.jpg' },
		{ type: 'file', path: 'place.glb', name: 'place.glb' }
	];
	const documents = new Map([
		[`${path}/place.json`, entry],
		[`${path}/place-topo.json`, topo],
		[`${path}/place-access.json`, access],
		[path, files],
		[`${childPath}/child.json`, child],
		[`${childPath}/child-topo.json`, childTopo],
		[childPath, []]
	]);
	const fetch = async (url) => {
		const value = documents.get(url.slice(fsApiUrl.length + 1));
		return value === undefined
			? new Response(null, { status: 404 })
			: new Response(JSON.stringify(value));
	};
	const args = {
		params: { crag: path },
		url: new URL(`https://example.test/map/crag/${path}`),
		parent: async () => ({ locations: [], allLocations: [] }),
		fetch
	};
	return { args, entry, child, path, childPath, topo, access };
}

describe.each(kinds)('%s entries use the same loading rules', (kind) => {
	it('loads its own assets and children in map and topo views without an ancestor', async () => {
		const { args, entry, child, path, childPath, topo, access } = fixture(kind);
		const map = await loadMap(args);
		const details = await map.streamed.details;
		const topoPage = await loadTopo(args);

		expect(map.currentData).toEqual(entry);
		expect(map.parentEntry).toBeNull();
		expect(map.sectors).toEqual([{ path: childPath, entry: child }]);
		expect(details.topoJson).toEqual(topo);
		expect(details.access).toEqual(access);
		expect(details.images).toEqual([`${fsApiUrl}/${path}/photo.jpg`]);
		expect(details.has2DTopo).toBe(true);
		expect(details.has3DTopo).toBe(true);
		expect(topoPage.path).toBe(path);
		expect(topoPage.sectors).toEqual(map.sectors);
		expect(topoPage.topo).toEqual(details.topoJson);
		expect(topoPage.access).toEqual(details.access);
		expect(topoPage.gradeRoutes).toEqual(details.gradeRoutes);
		expect(topoPage.modelUrl).toBe(`${fsApiUrl}/${path}/place.glb`);
	});

	it('resolves a route from its own topo', async () => {
		const { args, path } = fixture(kind);
		const result = await loadTopo({ ...args, params: { crag: `${path}/route` } });
		expect(result.path).toBe(path);
		expect(result.route.id).toBe('route');
	});
});
