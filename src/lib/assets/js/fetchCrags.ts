import { browser } from '$app/environment';
import { cragsPerPage, fsApiUrl } from '$lib/config';
import { storage } from '$lib/assets/js/storage-utils.js';

type FelsLocation = import('$lib/types/files').FelsLocation;
type PersistedCragsCache = { timestamp: number; crags: FelsLocation[] };

const STORAGE_KEY = 'felsverzeichnis:crags-cache-v1';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 64;

let cachedCrags: FelsLocation[] | null = null;
let fetchPromise: Promise<FelsLocation[]> | null = null;
let cacheTime = 0;

function refreshCrags(fetcher: typeof globalThis.fetch): Promise<FelsLocation[]> {
	if (!fetchPromise) {
		fetchPromise = (async () => {
			try {
				const res = await fetcher(`${fsApiUrl}/?recursive=true`);
				if (!res.ok) throw new Error('Failed to fetch entry directory');
				const files = (await res.json()) as import('$lib/types/files').DirectoryEntry[];
				const entryFiles = files.filter((file) => {
					const folder = file.path.split('/').at(-2);
					return file.type === 'file' && file.name === `${folder}.json`;
				});
				const entries: FelsLocation[] = [];
				for (let offset = 0; offset < entryFiles.length; offset += BATCH_SIZE) {
					const batch = await Promise.all(
						entryFiles.slice(offset, offset + BATCH_SIZE).map(async (file) => {
							const response = await fetcher(`${fsApiUrl}/${file.path}`);
							if (!response.ok) throw new Error(`Failed to fetch entry: ${file.path}`);
							const entry =
								(await response.json()) as import('@vorstieg/fels-types/types').FelsEntry;
							return { entry, path: file.path.slice(0, -(file.name.length + 1)) };
						})
					);
					entries.push(...batch);
				}
				cachedCrags = entries;
				cacheTime = Date.now();
				if (browser) {
					storage.set(STORAGE_KEY, { timestamp: cacheTime, crags: entries });
				}
				return entries;
			} finally {
				fetchPromise = null;
			}
		})();
	}
	return fetchPromise;
}

const fetchCrags = async ({
	offset = 0,
	limit = cragsPerPage,
	search = '',
	fetch: fetcher = globalThis.fetch
}: { offset?: number; limit?: number; search?: string; fetch?: typeof globalThis.fetch } = {}) => {
	if (!cachedCrags && browser) {
		const persisted = storage.get(STORAGE_KEY, null) as PersistedCragsCache | null;
		if (persisted && Array.isArray(persisted.crags) && persisted.crags.length > 0) {
			cachedCrags = persisted.crags;
			cacheTime = persisted.timestamp || 0;
		}
	}

	let crags: FelsLocation[];

	if (cachedCrags && Date.now() - cacheTime < CACHE_DURATION) {
		crags = cachedCrags;
	} else if (cachedCrags) {
		crags = cachedCrags;
		void refreshCrags(fetcher).catch(() => {});
	} else {
		crags = await refreshCrags(fetcher);
	}

	let sortedCrags = [...crags].sort((a, b) => {
		return a.entry.properties.name.localeCompare(b.entry.properties.name);
	});

	if (search) {
		sortedCrags = sortedCrags.filter(
			(crag) =>
				crag.entry.properties.name.toLowerCase().includes(search.toLowerCase()) ||
				(crag.entry.properties.type && crag.entry.properties.type.includes(search)) ||
				crag.path.toLowerCase().includes(search.toLowerCase())
		);
	}

	if (offset) {
		sortedCrags = sortedCrags.slice(offset);
	}

	if (limit && limit < sortedCrags.length && limit !== -1) {
		sortedCrags = sortedCrags.slice(0, limit);
	}

	return sortedCrags;
};

export default fetchCrags;
