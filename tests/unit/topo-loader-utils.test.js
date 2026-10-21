import { describe, expect, it } from 'vitest';
import {
	findRouteOrChild,
	getGeometryCenter,
	getParentRoute,
	getPitchDisplayName,
	getRouteDisplayName
} from '$lib/assets/js/topo-loader-utils.js';

describe('topo loader helpers', () => {
	it('finds parent routes, pitches, and variants', () => {
		const routes = [{ id: 'parent', pitches: [{ id: 'pitch' }], variants: [{ id: 'variant' }] }];
		expect(findRouteOrChild(routes, 'parent')).toEqual(routes[0]);
		expect(findRouteOrChild(routes, 'pitch')).toEqual({ id: 'pitch', parentId: 'parent' });
		expect(findRouteOrChild(routes, 'variant')).toEqual({ id: 'variant', parentId: 'parent' });
		expect(findRouteOrChild(routes, 'missing')).toBeNull();
		expect(getParentRoute(routes, 'parent')).toEqual(routes[0]);
		expect(getParentRoute(routes, 'pitch')).toEqual(routes[0]);
		expect(getParentRoute(routes, 'variant')).toEqual(routes[0]);
		expect(getParentRoute(routes, 'missing')).toBeNull();
	});

	it('resolves pitch and route display names', () => {
		const explicitPitch = { id: 'p1', name: 'Traverse' };
		const unnamedPitch = { id: 'p2' };
		const numberedPitch = { id: 'p3', pitchNumber: 4 };

		expect(getPitchDisplayName(explicitPitch, 0)).toBe('Traverse');
		expect(getPitchDisplayName(unnamedPitch, 0)).toBe('Pitch 1');
		expect(getPitchDisplayName(unnamedPitch, 1)).toBe('Pitch 2');
		expect(getPitchDisplayName(numberedPitch, 0)).toBe('Pitch 4');

		const tDe = (key, opts) => {
			if (key === 'topo.pitch_numbered') return `Seillänge ${opts.values.number}`;
			if (key === 'topo.pitch') return 'Seillänge';
			return key;
		};
		const tEn = (key, opts) => {
			if (key === 'topo.pitch_numbered') return `Pitch ${opts.values.number}`;
			if (key === 'topo.pitch') return 'Pitch';
			return key;
		};

		expect(getPitchDisplayName(unnamedPitch, 0, tDe)).toBe('Seillänge 1');
		expect(getPitchDisplayName(unnamedPitch, 1, tDe)).toBe('Seillänge 2');
		expect(getPitchDisplayName(unnamedPitch, 0, tEn)).toBe('Pitch 1');

		const parentRoute = {
			id: 'multi',
			name: 'Grosswand',
			pitches: [unnamedPitch, explicitPitch]
		};

		expect(getRouteDisplayName(parentRoute, null, tDe)).toBe('Grosswand');
		expect(getRouteDisplayName(unnamedPitch, parentRoute, tDe)).toBe('Seillänge 1');
		expect(getRouteDisplayName(explicitPitch, parentRoute, tDe)).toBe('Traverse');
		expect(getRouteDisplayName({ id: 'solo' }, null, tDe)).toBe('solo');
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
