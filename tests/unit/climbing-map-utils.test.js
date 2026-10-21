import { describe, expect, it } from 'vitest';
import {
	createPlacesData,
	createTopoPathsData,
	getMapPadding,
	getPreferredClimbingType,
	selectionExpression,
	sortClimbingTypes
} from '$lib/assets/js/climbing-map-utils.js';

describe('climbing map utilities', () => {
	it('uses canonical type arrays and keeps file locations outside entries', () => {
		const entry = {
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [16, 48] },
			properties: { id: 'a', name: 'Crag', kind: 'crag', type: ['sports-climbing', 'trad'] }
		};
		const result = createPlacesData([{ entry, path: 'a' }]);
		expect(result.type).toBe('FeatureCollection');
		expect(result.features[0].properties.type).toEqual(['sports-climbing', 'trad']);
		expect(result.features[0].properties.filePath).toBe('a');
		expect(entry.properties).not.toHaveProperty('filePath');
	});

	it('returns an empty collection without locations', () => {
		expect(createPlacesData()).toEqual({ type: 'FeatureCollection', features: [] });
	});

	it('passes canonical LineString paths to the map', () => {
		const path = {
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [
					[1, 2],
					[3, 4]
				]
			},
			properties: { role: 'main' }
		};
		expect(createTopoPathsData([path]).features).toEqual([path]);
		expect(createTopoPathsData().features).toEqual([]);
	});

	it.each([
		[
			{ width: 1200, height: 800 },
			{ top: 0, bottom: 0, left: 0, right: 680 }
		],
		[
			{ width: 800, height: 800 },
			{ top: 0, bottom: 0, left: 0, right: 440 }
		],
		[
			{ width: 640, height: 900 },
			{ top: 0, bottom: 450, left: 0, right: 0 }
		]
	])('calculates responsive map padding', (viewport, expected) => {
		expect(getMapPadding(viewport)).toEqual(expected);
	});

	it('creates a path-prefix selection expression and decodes URL paths', () => {
		const expression = selectionExpression('areas%2Falpine-crag');
		expect(expression).toEqual([
			'==',
			['index-of', ['concat', ['get', 'filePath'], '/'], 'areas/alpine-crag/'],
			0
		]);
		expect(selectionExpression('')).toBeNull();
	});

	it('flags crags that have child sectors', () => {
		const cragPolygon = {
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[16, 48],
						[16.02, 48],
						[16.02, 48.02],
						[16, 48.02],
						[16, 48]
					]
				]
			},
			properties: { id: 'polygon-crag', name: 'Polygon Crag', kind: 'crag', type: ['bouldering'] }
		};
		const childSector = {
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [16.01, 48.01] },
			properties: { id: 'sector-1', name: 'Sector 1', kind: 'sector' }
		};

		const result = createPlacesData([
			{ entry: cragPolygon, path: 'areas/polygon-crag' },
			{ entry: childSector, path: 'areas/polygon-crag/sector-1' }
		]);

		expect(result.features).toHaveLength(3);
		expect(result.features[0].properties.hasSectors).toBe(true);
		expect(result.features[1].properties.isCentroid).toBe(true);
		expect(result.features[1].geometry.type).toBe('Point');
		expect(result.features[2].properties.hasSectors).toBe(false);
	});

	it('generates centroid points for polygon sectors as well', () => {
		const sectorPolygon = {
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[16, 48],
						[16.02, 48],
						[16.02, 48.02],
						[16, 48.02],
						[16, 48]
					]
				]
			},
			properties: {
				id: 'poly-sector',
				name: 'Poly Sector',
				kind: 'sector',
				type: ['sports-climbing']
			}
		};

		const result = createPlacesData([{ entry: sectorPolygon, path: 'areas/crag/poly-sector' }]);

		expect(result.features).toHaveLength(2);
		expect(result.features[0].geometry.type).toBe('Polygon');
		expect(result.features[1].properties.isCentroid).toBe(true);
		expect(result.features[1].geometry.type).toBe('Point');
	});

	it('prioritizes climbing types according to multi-pitch > sports-climbing > bouldering', () => {
		expect(sortClimbingTypes(['bouldering', 'sports-climbing', 'multi-pitch'])).toEqual([
			'multi-pitch',
			'sports-climbing',
			'bouldering'
		]);
		expect(getPreferredClimbingType(['bouldering', 'sports-climbing'])).toBe('sports-climbing');
		expect(getPreferredClimbingType(['sports-climbing', 'multi-pitch'])).toBe('multi-pitch');
		expect(getPreferredClimbingType(['bouldering', 'multi-pitch'])).toBe('multi-pitch');
		expect(getPreferredClimbingType(['trad', 'bouldering'])).toBe('bouldering');
		expect(getPreferredClimbingType(['bouldering'])).toBe('bouldering');
		expect(getPreferredClimbingType('bouldering')).toBe('bouldering');
		expect(getPreferredClimbingType(undefined)).toBe('');
		expect(getPreferredClimbingType([])).toBe('');
		expect(sortClimbingTypes('bouldering')).toEqual(['bouldering']);
	});
});
