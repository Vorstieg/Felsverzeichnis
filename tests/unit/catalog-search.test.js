import { describe, expect, it, vi } from 'vitest';
import {
	buildFilter,
	countActiveFilters,
	entryHitToLocation,
	entryHitUrl,
	filtersFromParams,
	filtersToParams,
	gradeFromRank,
	gradeIndex,
	hasRouteOnlyFilters,
	interpretSearchTerm,
	quote,
	routeHitUrl,
	searchCatalog
} from '$lib/search/catalog-search';

describe('catalog-search utilities', () => {
	it('converts grade standardizedValue to index and back', () => {
		expect(gradeIndex('1a')).toBe(0);
		expect(gradeIndex('6a')).toBeGreaterThan(0);
		expect(gradeIndex('6a+')).toBeGreaterThan(gradeIndex('6a'));
		expect(gradeIndex(undefined)).toBe(-1);
		expect(gradeIndex('unknown')).toBe(-1);

		expect(gradeFromRank(0)).toBe('1a');
		expect(gradeFromRank(undefined)).toBeUndefined();
	});

	it('quotes strings safely for Meilisearch filter syntax', () => {
		expect(quote('hello')).toBe('"hello"');
		expect(quote('with "quotes" and \\backslashes\\')).toBe(
			'"with \\"quotes\\" and \\\\backslashes\\\\"'
		);
	});

	it('builds Meilisearch filters for entries and routes', () => {
		const filters = {
			types: ['sports-climbing', 'multi-pitch'],
			gradeMin: '6a',
			gradeMax: '7a',
			lengthMin: 20,
			lengthMax: 50,
			pitchesMin: 2,
			pitchesMax: 5,
			kinds: ['crag', 'sector'],
			within: 'europe/austria'
		};

		const routeFilter = buildFilter(filters, 'route');
		expect(routeFilter).toContain('docType = "route"');
		expect(routeFilter).toContain('types IN ["sports-climbing", "multi-pitch"]');
		expect(routeFilter).toContain(`grades ${gradeIndex('6a')} TO ${gradeIndex('7a')}`);
		expect(routeFilter).toContain('length 20 TO 50');
		expect(routeFilter).toContain('pitchCount 2 TO 5');
		expect(routeFilter).toContain('(ancestorPaths = "europe/austria" OR path = "europe/austria")');
		expect(routeFilter.some((f) => f.includes('kind IN'))).toBe(false);

		const entryFilter = buildFilter(filters, 'entry');
		expect(entryFilter).toContain('docType = "entry"');
		expect(entryFilter).toContain('kind IN ["crag", "sector"]');
		expect(entryFilter.some((f) => f.includes('length'))).toBe(false);
		expect(entryFilter.some((f) => f.includes('pitchCount'))).toBe(false);
	});

	it('builds geo bounding box and geo radius filters', () => {
		const geoFilters = {
			bbox: [16.0, 48.0, 16.5, 48.5],
			around: { lat: 48.2, lng: 16.3, radius: 5000 }
		};

		const filter = buildFilter(geoFilters);
		expect(filter).toContain('_geoBoundingBox([48.5, 16.5], [48, 16])');
		expect(filter).toContain('_geoRadius(48.2, 16.3, 5000)');
	});

	it('identifies route-only filters and counts active filters', () => {
		expect(hasRouteOnlyFilters({})).toBe(false);
		expect(hasRouteOnlyFilters({ types: ['bouldering'] })).toBe(false);
		expect(hasRouteOnlyFilters({ lengthMin: 30 })).toBe(true);
		expect(hasRouteOnlyFilters({ pitchesMax: 3 })).toBe(true);

		expect(countActiveFilters({})).toBe(0);
		expect(
			countActiveFilters({
				types: ['sports-climbing'],
				gradeMin: '6a',
				within: 'europe/austria'
			})
		).toBe(3);
	});

	it('serializes filters to URL search params and back', () => {
		const filters = {
			types: ['sports-climbing', 'trad'],
			gradeMin: '5c',
			gradeMax: '7a+',
			lengthMin: 15,
			lengthMax: 40,
			pitchesMin: 2,
			pitchesMax: 6,
			within: 'europe/austria/lower-austria'
		};

		const params = filtersToParams(filters);
		expect(params.get('type')).toBe('sports-climbing,trad');
		expect(params.get('gmin')).toBe('5c');
		expect(params.get('gmax')).toBe('7a+');
		expect(params.get('lmin')).toBe('15');
		expect(params.get('lmax')).toBe('40');
		expect(params.get('pmin')).toBe('2');
		expect(params.get('pmax')).toBe('6');
		expect(params.get('in')).toBe('europe/austria/lower-austria');

		const parsed = filtersFromParams(params);
		expect(parsed).toEqual(filters);
	});

	it('interprets search terms into query or filters', () => {
		const typeResult = interpretSearchTerm('multi-pitch');
		expect(typeResult.q).toBe('');
		expect(typeResult.filters.types).toEqual(['multi-pitch']);

		const pathResult = interpretSearchTerm('europe/austria/hohe-wand');
		expect(pathResult.q).toBe('');
		expect(pathResult.filters.within).toBe('europe/austria/hohe-wand');

		const textResult = interpretSearchTerm('Naglplatte');
		expect(textResult.q).toBe('Naglplatte');
		expect(textResult.filters).toEqual({});
	});

	it('generates correct URLs for entry and route hits', () => {
		expect(
			entryHitUrl('/base', {
				path: 'austria/hohe-wand',
				_geo: { lat: 48.1, lng: 16.2 }
			})
		).toBe('/base/map/crag/austria/hohe-wand#16/48.1/16.2');

		expect(
			entryHitUrl('/base', {
				path: 'austria/hohe-wand',
				kind: 'area',
				_geo: { lat: 48.1, lng: 16.2 }
			})
		).toBe('/base/map/crag/austria/hohe-wand');

		expect(
			entryHitUrl('/base', {
				path: 'austria/niederoesterreich',
				kind: 'region',
				_geo: { lat: 48.1, lng: 16.2 }
			})
		).toBe('/base/map/crag/austria/niederoesterreich');

		expect(
			entryHitUrl('/base', {
				path: 'austria/hohe-wand',
				kind: 'crag',
				_geo: { lat: 48.1, lng: 16.2 }
			})
		).toBe('/base/map/crag/austria/hohe-wand#16/48.1/16.2');

		expect(
			entryHitUrl('/base', {
				path: 'austria/hohe-wand'
			})
		).toBe('/base/map/crag/austria/hohe-wand');

		expect(
			routeHitUrl('/base', {
				path: 'austria/hohe-wand/bizepswandl',
				routeId: 'route 1 & 2'
			})
		).toBe('/base/map/crag/austria/hohe-wand/bizepswandl/route%201%20%26%202');
	});

	it('maps entry hit to FelsLocation', () => {
		const hit = {
			id: 'entry-1',
			docType: 'entry',
			kind: 'crag',
			name: 'Test Crag',
			path: 'europe/austria/test-crag',
			breadcrumb: ['Austria'],
			types: ['sports-climbing'],
			grades: [10],
			routeCount: 5,
			_geo: { lat: 48.0, lng: 16.0 }
		};

		const loc = entryHitToLocation(hit);
		expect(loc.path).toBe('europe/austria/test-crag');
		expect(loc.entry.properties.name).toBe('Test Crag');
		expect(loc.entry.geometry.type).toBe('Point');
		expect(loc.entry.geometry.coordinates).toEqual([16.0, 48.0]);
	});
});

describe('searchCatalog with Meilisearch', () => {
	it('queries multi-search endpoint and combines entries and routes', async () => {
		const mockFetch = vi.fn(async () => ({
			ok: true,
			json: async () => ({
				results: [
					{
						hits: [
							{
								id: 'r1',
								docType: 'route',
								routeId: 'gaisersteig',
								name: 'Gaisersteig',
								path: 'austria/bizeps',
								entryName: 'Bizepswandl',
								types: ['multi-pitch'],
								grades: [10],
								grade: { scale: 'uiaa', value: '3-', standardizedValue: '3a' }
							}
						],
						totalHits: 1
					},
					{
						hits: [
							{
								id: 'e1',
								docType: 'entry',
								kind: 'crag',
								name: 'Bizepswandl',
								path: 'austria/bizeps',
								types: ['sports-climbing'],
								grades: [10, 20],
								routeCount: 10
							}
						],
						totalHits: 1
					}
				]
			})
		}));

		const clientConfig = {
			url: 'http://127.0.0.1:7700',
			apiKey: 'test-key',
			index: 'fels'
		};

		const res = await searchCatalog(
			{
				q: 'gaiser',
				fetch: mockFetch
			},
			clientConfig
		);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(res.routes.length).toBe(1);
		expect(res.routes[0].name).toBe('Gaisersteig');
		expect(res.entries.length).toBe(1);
		expect(res.entries[0].name).toBe('Bizepswandl');
	});

	it('returns empty results if Meilisearch fetch fails or is unconfigured', async () => {
		const mockFetch = vi.fn(async () => {
			throw new Error('Connection refused');
		});

		const clientConfig = {
			url: 'http://127.0.0.1:7700',
			apiKey: 'test-key',
			index: 'fels'
		};

		const res = await searchCatalog(
			{
				q: 'bizeps',
				fetch: mockFetch
			},
			clientConfig
		);

		expect(res).toEqual({
			entries: [],
			routes: [],
			entryTotal: 0,
			routeTotal: 0
		});

		const unconfiguredRes = await searchCatalog({ q: 'bizeps', fetch: mockFetch }, null);
		expect(unconfiguredRes).toEqual({
			entries: [],
			routes: [],
			entryTotal: 0,
			routeTotal: 0
		});
	});
});
