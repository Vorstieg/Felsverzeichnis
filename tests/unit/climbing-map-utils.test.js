import { describe, expect, it } from 'vitest';
import {
	createPlacesData,
	createTopoPathsData,
	getMapPadding,
	selectionExpression
} from '$lib/assets/js/climbing-map-utils.js';

describe('climbing map utilities', () => {
	it('normalizes array and comma-separated place types without mutating features', () => {
		const feature = { properties: { path: 'a', type: ['sports-climbing', 'trad'] } };
		const commaFeature = { properties: { type: 'bus,transit' } };
		const result = createPlacesData([feature, commaFeature, { properties: { type: '' } }]);

		expect(result.type).toBe('FeatureCollection');
		expect(result.features.map((item) => item.properties.type)).toEqual([
			'sports-climbing',
			'bus',
			null
		]);
		expect(feature.properties.type).toEqual(['sports-climbing', 'trad']);
	});

	it('returns an empty collection for non-array locations', () => {
		expect(createPlacesData(null)).toEqual({ type: 'FeatureCollection', features: [] });
	});

	it('keeps only valid LineString topo paths with at least two coordinates', () => {
		const valid = {
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [
					[1, 2],
					[3, 4]
				]
			}
		};
		const invalid = [
			{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } },
			{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 2]] } },
			null
		];

		expect(createTopoPathsData([valid, ...invalid]).features).toEqual([valid]);
		expect(createTopoPathsData(undefined).features).toEqual([]);
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
			['index-of', ['concat', ['get', 'path'], '/'], 'areas/alpine-crag/'],
			0
		]);
		expect(selectionExpression('bad%')).toEqual([
			'==',
			['index-of', ['concat', ['get', 'path'], '/'], 'bad%/'],
			0
		]);
		expect(selectionExpression('')).toBeNull();
	});
});
