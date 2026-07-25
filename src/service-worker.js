import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;

const ASSETS = [
    ...build, // the SvelteKit app shell (compiled JS/CSS)
    ...files  // everything in the static directory
];

self.addEventListener('install', (event) => {
    async function addFilesToCache() {
        const cache = await caches.open(CACHE);
        // Gracefully add assets instead of using cache.addAll which crashes on a single 404
        for (const asset of ASSETS) {
            try {
                await cache.add(asset);
            } catch (e) {
                console.warn('[SW] Failed to cache asset on install:', asset);
            }
        }
    }
    event.waitUntil(addFilesToCache());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    async function deleteOldCaches() {
        for (const key of await caches.keys()) {
            if (key !== CACHE && key !== 'felslager-crags') {
                await caches.delete(key);
            }
        }
    }
    event.waitUntil(deleteOldCaches());
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    // 1. Intercept Felslager API requests (handled completely by our background cacher!)
    // We strictly serve these from cache if they exist, or network if they don't.
    if (event.request.url.includes('/api/fs/')) {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true, ignoreVary: true }).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request);
            })
        );
        return;
    }

    // 2. App shell routing (HTML, CSS, JS, internal API)
    async function respond() {
        const url = new URL(event.request.url);
        const cache = await caches.open(CACHE);

        // serve build files from cache
        if (ASSETS.includes(url.pathname)) {
            const cachedResponse = await cache.match(url.pathname);
            if (cachedResponse) return cachedResponse;
        }

        // for everything else, try the network first, then fall back to cache
        try {
            const response = await fetch(event.request);
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
