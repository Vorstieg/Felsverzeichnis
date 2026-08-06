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
						[16.5, 48.7]
					]
				]
			})
		).toEqual([
			[16.2, 48.1],
			[16.8, 48.7]
		]);
	});

	it('supports multi-geometries and rejects missing or empty coordinates', () => {
		expect(
			getGeometryBounds({
				type: 'MultiLineString',
				coordinates: [
					[
						[10, 20],
						[12, 22]
					],
					[
						[8, 24],
						[14, 18]
					]
				]
			})
		).toEqual([
			[8, 18],
			[14, 24]
		]);
		expect(getGeometryBounds(null)).toBeNull();
		expect(getGeometryBounds({ type: 'Point', coordinates: [] })).toBeNull();
		expect(getGeometryBounds({ type: 'Point', coordinates: ['16', 48] })).toBeNull();
	});

	it('calculates a bounds center and handles missing bounds', () => {
		expect(getBoundsCenter([[10, 20], [14, 28]])).toEqual([12, 24]);
		expect(getBoundsCenter(null)).toBeNull();
});

	it('returns no camera target when all locations are invalid', () => {
		expect(
			createLocationsCameraTarget([
				{ geometry: null },
				{ geometry: { type: 'Point', coordinates: [] } }
			])
		).toBeNull();
	});

	it('centers a single valid location at zoom 16', () => {
		expect(
			createLocationsCameraTarget([
				{ geometry: { type: 'Point', coordinates: [16, 48] } }
			])
		).toEqual({ type: 'center', center: [16, 48], zoom: 16 });
	});

	it('fits multiple valid locations into padded bounds', () => {
		expect(
			createLocationsCameraTarget([
				{ geometry: { type: 'Point', coordinates: [16, 48] } },
				{
					geometry: {
						type: 'LineString',
						coordinates: [
							[15, 47],
							[17, 49]
						]
					}
				},
				{ geometry: { type: 'Point', coordinates: [] } }
			])
		).toEqual({
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
