export function registerServiceWorker(
	scope,
	{ build = [], files = [], version, cacheStorage = globalThis.caches, fetcher = globalThis.fetch }
) {
	const cacheName = `cache-${version}`;
	const assets = [...build, ...files];

	scope.addEventListener('install', (event) => {
		async function addFilesToCache() {
			const cache = await cacheStorage.open(cacheName);
			for (const asset of assets) {
				try {
					await cache.add(asset);
				} catch (e) {
					console.warn('[SW] Failed to cache asset on install:', asset);
				}
			}
		}
		event.waitUntil(addFilesToCache());
		scope.skipWaiting();
	});

	scope.addEventListener('activate', (event) => {
		async function deleteOldCaches() {
			for (const key of await cacheStorage.keys()) {
				if (key !== cacheName && key !== 'felslager-crags') {
					await cacheStorage.delete(key);
				}
			}
		}
		event.waitUntil(deleteOldCaches());
		scope.clients.claim();
	});

	scope.addEventListener('fetch', (event) => {
		if (event.request.method !== 'GET') return;

		if (event.request.url.includes('/api/fs/')) {
			event.respondWith(
				cacheStorage
					.match(event.request, { ignoreSearch: true, ignoreVary: true })
					.then((cachedResponse) => {
						if (cachedResponse) return cachedResponse;
						return fetcher(event.request);
					})
			);
			return;
		}

		async function respond() {
			const url = new URL(event.request.url);
			const cache = await cacheStorage.open(cacheName);

			if (assets.includes(url.pathname)) {
				const cachedResponse = await cache.match(url.pathname);
				if (cachedResponse) return cachedResponse;
			}

			try {
				const response = await fetcher(event.request);
				if (response.status === 200 && !event.request.url.startsWith('chrome-extension')) {
					cache.put(event.request, response.clone());
				}
				return response;
			} catch {
				const cachedResponse = await cache.match(event.request);
				if (cachedResponse) return cachedResponse;
				return Response.error();
			}
		}

		event.respondWith(respond());
	});
}
