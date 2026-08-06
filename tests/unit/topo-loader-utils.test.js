import { describe, expect, it } from 'vitest';
import {
	findRouteOrChild,
	getGeometryCenter,
	normalizeSectorData
} from '$lib/assets/js/topo-loader-utils.js';

describe('topo loader helpers', () => {
	it('finds parent routes, pitches, and variants', () => {
		const routes = [{ id: 'parent', pitches: [{ id: 'pitch' }], variants: [{ id: 'variant' }] }];
		expect(findRouteOrChild(routes, 'parent')).toEqual(routes[0]);
		expect(findRouteOrChild(routes, 'pitch')).toEqual({ id: 'pitch', parentId: 'parent' });
		expect(findRouteOrChild(routes, 'variant')).toEqual({ id: 'variant', parentId: 'parent' });
		expect(findRouteOrChild(routes, 'missing')).toBeNull();
	});

	it('normalizes sector properties without mutating the source', () => {
		const source = { id: 'north', properties: { name: 'North', type: 'sport' } };
		const result = normalizeSectorData(source);
		expect(result).toMatchObject({ id: 'north', name: 'North', type: 'sport' });
		expect(result.geometry).toBeUndefined();
		expect(normalizeSectorData(null)).toBeNull();
	});

	it('calculates geometry centers', () => {
		expect(getGeometryCenter({ type: 'Point', coordinates: [16, 48] })).toEqual([16, 48]);
		expect(
			getGeometryCenter({
				type: 'Polygon',
				coordinates: [
					[
						[0, 0],
						[2, 0],
						[2, 2],
						[0, 0]
					]
				]
			})
		).toEqual([4 / 3, 2 / 3]);
		expect(getGeometryCenter({ type: 'Polygon', coordinates: [] })).toBeNull();
		expect(getGeometryCenter(null)).toBeNull();
	});
});
