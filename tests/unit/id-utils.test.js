import { beforeEach, describe, expect, it } from 'vitest';
import {
	generateId,
	generateOutlineId,
	generateRouteId,
	generateSymbolId,
	initializeIdCounters,
	resetIdCounters
} from '$lib/assets/js/id-utils.js';

describe('topo ID utilities', () => {
	beforeEach(() => resetIdCounters());

	it('generates independent sequential IDs', () => {
		expect(generateRouteId()).toBe('route-1');
		expect(generateRouteId()).toBe('route-2');
		expect(generateOutlineId()).toBe('outline-1');
		expect(generateSymbolId()).toBe('symbol-1');
		expect(generateId('pitch')).toBe('pitch-1');
	});

	it('initializes counters after existing topo content', () => {
		initializeIdCounters({
			routes: [{ id: 'route-4', pitches: [{ id: 'pitch-7' }] }, { id: 'route-2' }],
			outlines: [{ id: 'outline-3' }],
			fixPoints: [{ id: 'symbol-8' }]
		});

		expect(generateRouteId()).toBe('route-5');
		expect(generateOutlineId()).toBe('outline-4');
		expect(generateSymbolId()).toBe('symbol-9');
		expect(generateId('pitch')).toBe('pitch-8');
	});
});
