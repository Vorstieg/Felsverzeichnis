import { describe, expect, it } from 'vitest';
import {
	calculateBestSeason,
	calculateSunInfo,
	calculateWallDirection
} from '$lib/assets/js/sun-calculations';
import { findRouteOrChild } from '$lib/assets/js/topo-loader-utils.js';

describe('canonical wall orientation', () => {
	it.each(['pitches', 'variants'])(
		'retains sun information for a selected %s child without orientation',
		(kind) => {
			const topo = {
				coordinates: [0, 0, 0],
				wallAzimuth: 180,
				routes: [{ id: 'parent', orientation3D: [1, 0, 0], [kind]: [{ id: 'child' }] }]
			};
			const child = findRouteOrChild(topo.routes, 'child');
			expect(calculateWallDirection(topo, child)).toBe('E');
			expect(calculateSunInfo(topo, child).chartData.labels).toHaveLength(16);
			expect(calculateBestSeason(topo, child).labels).toHaveLength(12);
		}
	);

	it('uses the topo wallAzimuth for overview directions', () => {
		expect(calculateWallDirection({ routes: [], wallAzimuth: 0 })).toBe('N');
		expect(calculateWallDirection({ routes: [], wallAzimuth: 90 })).toBe('E');
	});
	it('prefers the selected route 3D orientation over wallAzimuth', () => {
		const route = { id: 0, orientation3D: [0, 0, -1] };
		expect(calculateWallDirection({ routes: [route], wallAzimuth: 90 }, route)).toBe('N');
	});
	it('prefers average 3D orientation over the topo azimuth', () => {
		expect(
			calculateWallDirection({
				wallAzimuth: 180,
				routes: [
					{ id: 1, orientation3D: [1, 0, 0] },
					{ id: 2, orientation3D: [0, 0, -1] }
				]
			})
		).toBe('NE');
	});
	it.each([undefined, NaN, Infinity])(
		'uses 3D orientations without a valid topo azimuth (%s)',
		(wallAzimuth) => {
			const route = { id: 1, orientation3D: [1, 0, 0] };
			const topo = { routes: [route], coordinates: [0, 0, 0], wallAzimuth };
			expect(calculateWallDirection(topo)).toBe('E');
			expect(calculateWallDirection(topo, route)).toBe('E');
			expect(calculateSunInfo(topo, route).chartData.labels).toHaveLength(16);
			expect(calculateBestSeason(topo, route).labels).toHaveLength(12);
		}
	);
	it('skips sun and season calculations when both orientation sources are absent', () => {
		const topo = { routes: [], coordinates: [0, 0, 0] };
		expect(calculateSunInfo(topo)).toEqual({ hours: 'Unknown', chartData: null });
		expect(calculateBestSeason(topo)).toBeNull();
	});
	it('falls back to wallAzimuth when a 3D vector has no horizontal heading', () => {
		const route = { id: 1, orientation3D: [0, 1, 0] };
		expect(calculateWallDirection({ routes: [route], wallAzimuth: 90 }, route)).toBe('E');
	});
	it('reports an unknown direction when optional orientation is absent', () => {
		expect(calculateWallDirection({ routes: [] })).toBe('Unknown');
	});
	it('uses valid zero coordinates and canonical altitude in sun calculations', () => {
		const topo = { routes: [], wallAzimuth: 180, coordinates: [0, 0, 0] };
		expect(calculateSunInfo(topo).chartData.labels).toHaveLength(16);
		const seaLevel = calculateBestSeason(topo);
		const mountain = calculateBestSeason({ ...topo, coordinates: [0, 0, 1000] });
		expect(seaLevel.baseTemps).toHaveLength(12);
		expect(seaLevel.baseTemps[0] - mountain.baseTemps[0]).toBeCloseTo(6.5);
	});
});
