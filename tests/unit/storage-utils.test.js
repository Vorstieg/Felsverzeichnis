import { beforeEach, describe, expect, it } from 'vitest';
import { storage } from '$lib/assets/js/storage-utils.js';

describe('storage utilities', () => {
	beforeEach(() => localStorage.clear());

	it('serializes and retrieves values', () => {
		expect(storage.set('topo', { routes: [1, 2] })).toBe(true);
		expect(storage.get('topo')).toEqual({ routes: [1, 2] });
	});

	it('returns defaults for missing and malformed values', () => {
		expect(storage.get('missing', 'fallback')).toBe('fallback');
		localStorage.setItem('broken', '{not json');
		expect(storage.get('broken', [])).toEqual([]);
	});

	it('removes values and handles unavailable window access', () => {
		storage.set('x', true);
		storage.remove('x');
		expect(storage.get('x')).toBeNull();
	});
});
