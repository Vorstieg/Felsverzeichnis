import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCragCache } from '$lib/assets/js/crag-cache.js';

describe('crag cache helpers', () => {
	let cache;
	let caches;

	beforeEach(() => {
		cache = {
			match: vi.fn(async () => null),
			put: vi.fn(async () => {})
		};
		caches = { open: vi.fn(async () => cache) };
	});

	it('normalizes trailing folder slashes during prefetch', async () => {
		const fetch = vi.fn(async (url) => {
			if (url.endsWith('/hash.txt')) return new Response('hash-1');
			if (url.endsWith('/?recursive=true')) {
				return new Response(JSON.stringify([{ type: 'dir', path: 'images' }]));
			}
			return new Response('[]');
		});
		const { cacheCragFolder } = createCragCache({
			apiUrl: 'https://example.test/api/fs',
			fetch,
			cacheStorage: caches
		});

		await cacheCragFolder('areas/alpine-crag/north/');

		expect(fetch).toHaveBeenCalledWith(
			'https://example.test/api/fs/areas/alpine-crag/north/?recursive=true'
		);
		expect(fetch).not.toHaveBeenCalledWith(
			'https://example.test/api/fs/areas/alpine-crag/north//?recursive=true'
		);
	});
});
