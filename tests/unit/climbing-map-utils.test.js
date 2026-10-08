import { describe, expect, it } from 'vitest';
import {
	createPlacesData,
	createTopoPathsData,
	getMapPadding,
	selectionExpression
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
});
