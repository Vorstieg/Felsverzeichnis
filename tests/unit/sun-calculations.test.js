import { describe, expect, it } from 'vitest';
import {
	calculateBestSeason,
	calculateSunInfo,
	calculateWallDirection
} from '$lib/assets/js/sun-calculations';

describe('canonical wall orientation', () => {
	it('uses wallAzimuth when no route has an orientation', () => {
		expect(calculateWallDirection({ routes: [], wallAzimuth: 0 })).toBe('N');
		expect(calculateWallDirection({ routes: [], wallAzimuth: 90 })).toBe('E');
	});
	it('rotates a selected route with the restored model rotation', () => {
		const route = { id: 0, orientation: [0, 0, -1] };
		expect(calculateWallDirection({ routes: [route], wallAzimuth: 90 }, route)).toBe('W');
	});
	it('averages canonical route orientations for the wall', () => {
		expect(
			calculateWallDirection({
				routes: [
					{ id: 1, orientation: [1, 0, 0] },
					{ id: 2, orientation: [0, 0, -1] }
				]
			})
		).toBe('NE');
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
