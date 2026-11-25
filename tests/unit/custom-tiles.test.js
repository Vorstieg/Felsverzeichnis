import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { registerCustomTiles, transformTileRequest } from '$lib/assets/js/custom-tiles.js';

describe('custom OSM tiles', () => {
	it('registers one protocol shared across map instances', () => {
		const maplibre = { addProtocol: vi.fn() };
		registerCustomTiles(maplibre);
		registerCustomTiles(maplibre);
		expect(maplibre.addProtocol).toHaveBeenCalledTimes(1);
		expect(maplibre.addProtocol).toHaveBeenCalledWith('pmtiles', expect.any(Function));
	});

	it('uses the configured backend for metadata and tile requests', () => {
		const source = 'pmtiles://https://lager.felsverzeichnis.at/api/tiles/via-ferrata.pmtiles';
		const local = 'http://localhost:3001/api/tiles/via-ferrata.pmtiles';
		expect(transformTileRequest(source, local).url).toBe(`pmtiles://${local}`);
		expect(transformTileRequest(`${source}/14/8919/5695`, local).url).toBe(
			`pmtiles://${local}/14/8919/5695`
		);
		expect(transformTileRequest('https://example.org/tile.pbf', local).url).toBe(
			'https://example.org/tile.pbf'
		);
	});

	for (const name of ['terrain', 'transport']) {
		it(`${name} has valid styles and both overlay layers`, () => {
			const style = JSON.parse(readFileSync(`static/${name}.json`, 'utf8'));
			expect(validateStyleMin(style)).toEqual([]);
			expect(style.sources.viaFerrataTiles.url).toMatch(/^pmtiles:\/\/https:\/\/lager\./);
			const overlays = style.layers.filter((layer) => layer.source === 'viaFerrataTiles');
			expect(new Set(overlays.map((layer) => layer['source-layer']))).toEqual(
				new Set(['via_ferrata', 'hiking_difficulty'])
			);
		});
	}
});
