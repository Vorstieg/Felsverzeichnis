import { describe, expect, it, vi } from 'vitest';
import { slowRasterTileDecay } from '$lib/assets/js/map-raster-lod.js';

describe('slowRasterTileDecay', () => {
	it('does nothing when the requested source is unavailable', () => {
		const map = { getSource: vi.fn(() => undefined) };

		expect(slowRasterTileDecay(map)).toBeUndefined();
		expect(map.getSource).toHaveBeenCalledWith('worldImagery');
	});

	it('installs a tile zoom calculator on the requested source', () => {
		const source = {};
		const map = { getSource: vi.fn(() => source) };

		slowRasterTileDecay(map, 'satellite', 0.15);

		expect(map.getSource).toHaveBeenCalledWith('satellite');
		expect(source.calculateTileZoom).toEqual(expect.any(Function));
	});

	it('reduces the default near-tile zoom adjustment by the decay factor', () => {
		const source = {};
		slowRasterTileDecay({ getSource: () => source }, 'imagery', 0.25);

		// Equal camera/tile distances and a forward-facing tile produce a zero offset.
		expect(source.calculateTileZoom(12, 0, 10, 10, 0)).toBe(12);
	});

	it('uses the far-tile branch when the default zoom offset is below -1', () => {
		const source = {};
		slowRasterTileDecay({ getSource: () => source }, 'imagery', 0.25);

		const result = source.calculateTileZoom(12, 0, 10, 0.01, 0);

		// The far branch is requestedZoom - decay + (offset + 1),
		// where offset is log2(0.01 / 10) = about -9.97.
		expect(result).toBeCloseTo(2.78, 2);
	});

	it('keeps the calculation finite when lateral tile distance is zero', () => {
		const source = {};
		slowRasterTileDecay({ getSource: () => source }, 'imagery');

		expect(source.calculateTileZoom(12, 0, 10, 0, 90)).toBeCloseTo(-7.08, 2);
	});
});
