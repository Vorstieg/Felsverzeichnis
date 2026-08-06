import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from '../../src/lib/service-worker-runtime.js';

function makeCache() {
	const entries = new Map();
	return {
		add: vi.fn(async (asset) => entries.set(asset, new Response(`cached ${asset}`))),
		match: vi.fn(async (request) =>
			entries.get(typeof request === 'string' ? request : request.url)
		),
		put: vi.fn(async (request, response) =>
			entries.set(typeof request === 'string' ? request : request.url, response)
		),
		entries
	};
}

async function loadWorker() {
	const listeners = new Map();
	const scope = {
		addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
		skipWaiting: vi.fn(),
		clients: { claim: vi.fn() }
	};
	registerServiceWorker(scope, {
		build: ['/app.js'],
		files: ['/icon.svg'],
		version: 'test',
		cacheStorage: globalThis.caches,
		fetcher: globalThis.fetch
	});
	return { listeners, scope };
}

function event(request) {
	let responsePromise;
	return {
		request,
		waitUntil: vi.fn((promise) => promise),
		respondWith: vi.fn((promise) => {
			responsePromise = promise;
		}),
		get responsePromise() {
			return responsePromise;
		}
	};
}

describe('service worker', () => {
	let cachesByName;
	let cache;

	beforeEach(() => {
		vi.restoreAllMocks();
		cache = makeCache();
		cachesByName = new Map([
			['cache-test', cache],
			['felslager-crags', makeCache()],
			['old-cache', makeCache()]
		]);
		vi.stubGlobal('caches', {
			open: vi.fn(async (name) => cachesByName.get(name)),
			keys: vi.fn(async () => [...cachesByName.keys()]),
			delete: vi.fn(async (name) => cachesByName.delete(name)),
			match: vi.fn(async (request) => {
				for (const candidate of cachesByName.values()) {
					const result = await candidate.match(request);
					if (result) return result;
				}
				return undefined;
			})
		});
	});

	it('caches install assets and tolerates an individual asset failure', async () => {
		cache.add.mockImplementation(async (asset) => {
			if (asset === '/icon.svg') throw new Error('404');
			cache.entries.set(asset, new Response(`cached ${asset}`));
		});
		const { listeners, scope } = await loadWorker();
		const install = event();
		listeners.get('install')(install);
		await install.waitUntil.mock.calls[0][0];

		expect(cache.add).toHaveBeenCalledWith('/app.js');
		expect(cache.add).toHaveBeenCalledWith('/icon.svg');
		expect(scope.skipWaiting).toHaveBeenCalled();
	});

	it('deletes old caches but preserves the app and crag caches', async () => {
		const { listeners, scope } = await loadWorker();
		const activate = event();
		listeners.get('activate')(activate);
		await activate.waitUntil.mock.calls[0][0];

		expect(caches.delete).toHaveBeenCalledWith('old-cache');
		expect(caches.delete).not.toHaveBeenCalledWith('cache-test');
		expect(caches.delete).not.toHaveBeenCalledWith('felslager-crags');
		expect(scope.clients.claim).toHaveBeenCalled();
	});

	it('uses cache-first behavior for API requests', async () => {
		const { listeners } = await loadWorker();
		const request = new Request('https://example.test/api/fs/areas/a.json');
		cache.entries.set(request.url, new Response('cached api'));
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const fetchEvent = event(request);
		listeners.get('fetch')(fetchEvent);

		expect(await fetchEvent.responsePromise).toBeInstanceOf(Response);
		expect(await (await fetchEvent.responsePromise).text()).toBe('cached api');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('falls back to cached app responses when the network fails', async () => {
		const { listeners } = await loadWorker();
		const request = new Request('https://example.test/map');
		cache.entries.set(request.url, new Response('cached page'));
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		const fetchEvent = event(request);
		listeners.get('fetch')(fetchEvent);

		expect(await (await fetchEvent.responsePromise).text()).toBe('cached page');
	});

	it('does not intercept non-GET requests', async () => {
		const { listeners } = await loadWorker();
		const fetchEvent = event(new Request('https://example.test/api/fs/update', { method: 'POST' }));
		listeners.get('fetch')(fetchEvent);

		expect(fetchEvent.respondWith).not.toHaveBeenCalled();
	});
});
