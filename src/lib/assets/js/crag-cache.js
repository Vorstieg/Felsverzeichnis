/**
 * Shared network/cache helpers for crag and topo loaders.
 */
export function createCragCache({
	apiUrl,
	fetch,
	useCache = false,
	cacheStorage = globalThis.caches
}) {
	const normalizePath = (path) => String(path).replace(/\/+$/, '');

	const fetchJson = async (path) => {
		const url = `${apiUrl}/${path}`;
		try {
			const response = await fetch(url);
			if (response.ok) return await response.json();
		} catch {
			// Offline, fall back to the cache below.
		}

		try {
			if (useCache && cacheStorage) {
				const cache = await cacheStorage.open('felslager-crags');
				const cached = await cache.match(url, { ignoreVary: true, ignoreSearch: true });
				if (cached) return await cached.json();
			}
		} catch {
			// Cache failures should not prevent a page from loading.
		}

		return null;
	};

	const cacheCragFolder = async (path) => {
		const cragPath = normalizePath(path);
		try {
			const hashRes = await fetch(`${apiUrl}/${cragPath}/hash.txt`);
			if (!hashRes.ok) return;
			const currentHash = (await hashRes.text()).trim();

			const cache = await cacheStorage.open('felslager-crags');
			const cachedHashRes = await cache.match(`${apiUrl}/${cragPath}/hash.txt`);
			const cachedHash = cachedHashRes ? (await cachedHashRes.text()).trim() : null;
			const baseDirCached = await cache.match(`${apiUrl}/${cragPath}`);

			if (currentHash !== cachedHash || !baseDirCached) {
				const indexRes = await fetch(`${apiUrl}/${cragPath}/?recursive=true`);
				const files = await indexRes.json();
				const jsonFiles = files.filter(
					(file) => file.type === 'file' && file.name.endsWith('.json')
				);
				const otherFiles = files.filter(
					(file) => file.type === 'file' && !file.name.endsWith('.json')
				);

				await Promise.all(
					jsonFiles.map(async (file) => {
						const fileUrl = `${apiUrl}/${cragPath}/${file.path}`;
						const fileRes = await fetch(fileUrl);
						if (fileRes.ok) await cache.put(fileUrl, fileRes);
					})
				);

				const dirsToCache = [
					cragPath,
					...files.filter((file) => file.type === 'dir').map((dir) => `${cragPath}/${dir.path}`)
				];
				await Promise.all(
					dirsToCache.map(async (dir) => {
						const dirUrl = `${apiUrl}/${dir}`;
						const dirRes = await fetch(dirUrl);
						if (dirRes.ok) await cache.put(dirUrl, dirRes);
					})
				);

				await cache.put(`${apiUrl}/${cragPath}/hash.txt`, new Response(currentHash));

				Promise.all(
					otherFiles.map(async (file) => {
						const fileUrl = `${apiUrl}/${cragPath}/${file.path}`;
						const fileRes = await fetch(fileUrl);
						if (fileRes.ok) await cache.put(fileUrl, fileRes);
					})
				).catch(() => {});
			}
		} catch {
			// Prefetching is best effort and must not block navigation.
		}
	};

	return { fetchJson, cacheCragFolder, normalizePath };
}
