import { describe, expect, it } from 'vitest';
import { buildFelsstudioUrl, getCragValidationIssue } from '$lib/assets/js/crag-validation.js';

const crag = {
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [16, 48] },
	properties: {
		id: 'crag',
		kind: 'crag',
		name: 'Crag',
		description_de: 'A crag',
		type: ['sports-climbing']
	}
};
const access = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			properties: { kind: 'approach' },
			geometry: {
				type: 'LineString',
				coordinates: [
					[16, 48],
					[16.1, 48.1]
				]
			}
		}
	]
};
const topo = { routes: [], image2D: 'topo.jpg' };
const base = {
	crag,
	current: crag,
	access,
	topo,
	has2DTopo: true,
	images: ['crag.jpg'],
	cragPath: 'area/crag'
};

describe('crag validation', () => {
	it.each(['route', 'pitches', 'variants'])('accepts complete 3D geometry on %s', (location) => {
		const points3D = [
			[0, 0, 0],
			[1, 1, 1]
		];
		const route = {
			id: 'r1',
			name: 'Route',
			type: 'sports-climbing',
			grade: { scale: 'french', value: '6a', standardizedValue: '6a' },
			boltAmount: 5,
			...(location === 'route' ? { points3D } : { [location]: [{ id: 'child', points3D }] })
		};
		const input = { ...base, topo: { routes: [route] }, has2DTopo: false, has3DTopo: true };
		expect(getCragValidationIssue(input)).toBeNull();
		expect(
			getCragValidationIssue({
				...input,
				topo: { routes: [{ ...route, points3D: undefined, pitches: [], variants: [] }] }
			})
		).toMatchObject({ rule: 'routes' });
	});

	it('returns the first issue by priority and does not use freshness metadata', () => {
		expect(
			getCragValidationIssue({
				...base,
				access: null,
				crag: { ...crag, properties: { ...crag.properties, updatedAt: '2001-01-01' } }
			})
		).toMatchObject({ rule: 'access', task: 'access' });
		expect(
			getCragValidationIssue({
				...base,
				crag: { ...crag, properties: { ...crag.properties, description_de: '' } }
			})
		).toMatchObject({ rule: 'core' });
	});

	it('does not require optional sectors, routes, topos, models, or images for a bare valid crag', () => {
		expect(
			getCragValidationIssue({ ...base, topo: null, has2DTopo: false, images: [] })
		).toBeNull();
	});

	it('targets an existing sector for missing topo coverage and incomplete sector routes', () => {
		const sectors = [
			{
				path: 'area/crag/north',
				entry: {
					type: 'Feature',
					geometry: crag.geometry,
					properties: { id: 'north', name: 'North', kind: 'sector' }
				}
			}
		];
		expect(
			getCragValidationIssue({
				...base,
				sectors,
				topo: null,
				has2DTopo: false
			})
		).toMatchObject({ rule: 'topo', target: { cragPath: 'area/crag', sectorId: 'north' } });

		const routeTopo = {
			image2D: 'topo.jpg',
			routes: [
				{
					id: 'r1',
					type: 'sports-climbing',
					name: '',
					grade: { scale: 'french', value: '6a', standardizedValue: '6a' },
					points2D: [
						[0, 0],
						[1, 1]
					],
					fixPoints: ['bolt-1']
				}
			],
			fixPoints: [{ id: 'bolt-1', type: 'bolt' }]
		};
		expect(
			getCragValidationIssue({
				...base,
				sectors,
				sectorTopos: [{ sectorId: 'north', topo: routeTopo, has2DTopo: true }]
			})
		).toMatchObject({ rule: 'routes', target: { cragPath: 'area/crag', sectorId: 'north' } });
	});

	it('checks protection only for protected climbing and creates encoded editor links', () => {
		const boulderTopo = {
			image2D: 'topo.jpg',
			routes: [
				{
					id: 'b1',
					type: 'bouldering',
					name: 'Bloc',
					grade: { scale: 'french', value: '6A', standardizedValue: '6a' },
					points2D: [
						[0, 0],
						[1, 1]
					]
				}
			]
		};
		expect(getCragValidationIssue({ ...base, topo: boulderTopo })).toBeNull();

		const url = buildFelsstudioUrl('https://studio.example/?source=map', {
			cragPath: 'area/a crag',
			sectorId: 'north/wall'
		});
		expect(url).toBe('https://studio.example/crags/editor/area/a%20crag/north/wall?source=map');
	});

	it('links to an existing crag and preserves the configured application base path', () => {
		expect(buildFelsstudioUrl('https://studio.example/studio/', { cragPath: 'area/crag' })).toBe(
			'https://studio.example/studio/crags/editor/area/crag'
		);
		expect(buildFelsstudioUrl('', { cragPath: 'area/crag' })).toBeNull();
	});
});
