import { describe, expect, it } from 'vitest';
import {
	getAccessTracks,
	getRouteTracks,
	getTourTracks,
	routeTracksToGpx
} from '$lib/assets/js/route-gpx.js';

describe('route GPX export', () => {
	it('exports only referenced geographic tracks with escaped names and elevation', () => {
		const route = {
			name: 'North & South',
			pathRefs: [{ pathId: 'approach', label: 'Walk <in>' }, { pathId: 'missing' }]
		};
		const topo = {
			paths: {
				features: [
					{
						id: 'approach',
						geometry: {
							type: 'LineString',
							coordinates: [
								[16.27, 48.08, 400],
								[16.28, 48.09]
							]
						}
					},
					{
						id: 'other',
						geometry: {
							type: 'LineString',
							coordinates: [
								[17, 49],
								[18, 50]
							]
						}
					}
				]
			}
		};
		const tracks = getRouteTracks(topo, route);
		const gpx = routeTracksToGpx(route, tracks);

		expect(tracks).toHaveLength(1);
		expect(gpx).toContain('<name>North &amp; South</name>');
		expect(gpx).toContain('<name>Walk &lt;in&gt;</name>');
		expect(gpx).toContain('<trkpt lat="48.08" lon="16.27"><ele>400</ele></trkpt>');
		expect(gpx).not.toContain('lat="49"');
	});

	it('ignores paths without usable geographic coordinates', () => {
		const route = { pathRefs: [{ pathId: 'bad' }] };
		const topo = {
			paths: {
				features: [
					{
						id: 'bad',
						geometry: {
							type: 'LineString',
							coordinates: [
								[200, 48],
								[16, 49]
							]
						}
					}
				]
			}
		};
		expect(getRouteTracks(topo, route)).toEqual([]);
	});

	it('keeps approach tracks separate from main route tracks', () => {
		const route = {
			name: 'Ridge',
			pathRefs: [
				{ pathId: 'main', role: 'main' },
				{ pathId: 'walk', role: 'approach' }
			]
		};
		const topo = {
			paths: {
				features: [
					{
						id: 'main',
						geometry: {
							type: 'LineString',
							coordinates: [
								[16, 48],
								[16.1, 48.1]
							]
						}
					},
					{
						id: 'walk',
						geometry: {
							type: 'LineString',
							coordinates: [
								[16.2, 48.2],
								[16.3, 48.3]
							]
						}
					}
				]
			}
		};
		const tracks = getRouteTracks(topo, route);
		expect(tracks.filter((track) => track.role !== 'approach')).toHaveLength(1);
		expect(tracks.filter((track) => track.role === 'approach')).toHaveLength(1);

		const access = {
			features: [
				{
					properties: { kind: 'approach', name: 'Path' },
					geometry: {
						type: 'LineString',
						coordinates: [
							[16.2, 48.2],
							[16.3, 48.3]
						]
					}
				},
				{ properties: { kind: 'parking' }, geometry: { type: 'Point', coordinates: [16, 48] } }
			]
		};
		expect(getAccessTracks(access)).toHaveLength(1);
	});

	it('exports the selected approach, climb, and descent as separate tracks in one GPX', () => {
		const line = [
			[16, 48],
			[16.1, 48.1]
		];
		const tracks = [
			{ name: 'Descent A', role: 'descent', coordinates: line },
			{ name: 'Approach A', role: 'approach', coordinates: line },
			{ name: 'Main route', role: 'main', coordinates: line },
			{ name: 'Approach B', role: 'approach', coordinates: line },
			{ name: 'Descent B', role: 'descent', coordinates: line }
		];
		const selected = getTourTracks(tracks, [], 1, 1);
		expect(selected.map((track) => track.name)).toEqual(['Approach B', 'Main route', 'Descent B']);
		const gpx = routeTracksToGpx({ name: 'Tour' }, selected);
		expect(gpx.match(/<trk>/g)).toHaveLength(3);
		expect(
			gpx.match(/<type>approach<\/type>|<type>main<\/type>|<type>descent<\/type>/g)
		).toHaveLength(3);
		expect(gpx).not.toContain('Approach A');
		expect(gpx).not.toContain('Descent A');
	});

	it('uses separate access data only when the route has no approach reference', () => {
		const line = [
			[16, 48],
			[16.1, 48.1]
		];
		const main = { name: 'Climb', role: 'main', coordinates: line };
		const approach = { name: 'Access', role: 'approach', coordinates: line };
		expect(getTourTracks([main], [approach])).toEqual([approach, main]);
		expect(getTourTracks([approach, main], [{ ...approach, name: 'Fallback' }])).toEqual([
			approach,
			main
		]);
	});
});
