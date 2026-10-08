import { describe, expect, it } from 'vitest';
import {
	createLocationsCameraTarget,
	getBoundsCenter,
	getGeometryBounds
} from '$lib/assets/js/map-camera.js';

describe('map camera utilities', () => {
	it('returns bounds for nested polygon coordinates', () => {
		expect(
			getGeometryBounds({
				type: 'Polygon',
				coordinates: [
					[
						[16.2, 48.3],
						[16.8, 48.1],
						[16.5, 48.7],
						[16.2, 48.3]
					]
				]
			})
		).toEqual([
			[16.2, 48.1],
			[16.8, 48.7]
		]);
	});

	it('supports canonical multipolygons and absent geometry', () => {
		expect(
			getGeometryBounds({
				type: 'MultiPolygon',
				coordinates: [
					[
						[
							[10, 20],
							[12, 22],
							[8, 24],
							[14, 18],
							[10, 20]
						]
					]
				]
			})
		).toEqual([
			[8, 18],
			[14, 24]
		]);
		expect(getGeometryBounds(null)).toBeNull();
	});

	it('calculates a bounds center and handles missing bounds', () => {
		expect(
			getBoundsCenter([
				[10, 20],
				[14, 28]
			])
		).toEqual([12, 24]);
		expect(getBoundsCenter(null)).toBeNull();
	});

	it('returns no camera target without locations', () => {
		expect(createLocationsCameraTarget([])).toBeNull();
	});

	it('centers a single location at zoom 16', () => {
		expect(
			createLocationsCameraTarget([
				{
					path: 'a',
					entry: {
						type: 'Feature',
						properties: { id: 'a', name: 'A', kind: 'crag' },
						geometry: { type: 'Point', coordinates: [16, 48] }
					}
				}
			])
		).toEqual({ type: 'center', center: [16, 48], zoom: 16 });
	});

	it('fits multiple locations into padded bounds', () => {
		const locations = [
			{
				path: 'a',
				entry: {
					type: 'Feature',
					properties: { id: 'a', name: 'A', kind: 'crag' },
					geometry: { type: 'Point', coordinates: [16, 48] }
				}
			},
			{
				path: 'b',
				entry: {
					type: 'Feature',
					properties: { id: 'b', name: 'B', kind: 'area' },
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[15, 47],
								[17, 47],
								[17, 49],
								[15, 47]
							]
						]
					}
				}
			}
		];
		expect(createLocationsCameraTarget(locations)).toEqual({
			type: 'bounds',
			bounds: [
				[15, 47],
				[17, 49]
			],
			padding: 80,
			maxZoom: 13
		});
	});
});
