/** @param {ServiceWorkerGlobalScope} scope
 * @param {{build?: string[], files?: string[], version: string, cacheStorage?: CacheStorage, fetcher?: typeof fetch}} options */
export function registerServiceWorker(
	scope,
	{ build = [], files = [], version, cacheStorage = globalThis.caches, fetcher = globalThis.fetch }
) {
	const cacheName = `cache-${version}`;
	const assets = [...build, ...files];

	scope.addEventListener('install', (event) => {
		async function addFilesToCache() {
			const cache = await cacheStorage.open(cacheName);
			await Promise.all(
				assets.map(async (asset) => {
					try {
						await cache.add(asset);
					} catch {
						console.warn('[SW] Failed to cache asset on install:', asset);
					}
				})
			);
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
			const hasSearch = event.request.url.includes('?');
			event.respondWith(
				cacheStorage
					.match(event.request, { ignoreSearch: !hasSearch, ignoreVary: true })
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

			const cachedFallbackPromise = cache.match(event.request);

			const networkPromise = fetcher(event.request).then((response) => {
				if (response.status === 200 && !event.request.url.startsWith('chrome-extension')) {
					cache.put(event.request, response.clone());
				}
				return response;
			});

			try {
				const cachedResponse = await cachedFallbackPromise;
				if (cachedResponse) {
					/** @type {Promise<Response>} */
					const timeoutPromise = new Promise((resolve) =>
						setTimeout(() => resolve(cachedResponse), 1500)
					);
					return await Promise.race([networkPromise, timeoutPromise]);
				}
				return await networkPromise;
			} catch {
				const cachedResponse = await cachedFallbackPromise;
				if (cachedResponse) return cachedResponse;
				return Response.error();
			}
		}

		event.respondWith(respond());
	});
}
