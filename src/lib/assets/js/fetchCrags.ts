import { browser } from '$app/environment';
import { cragsPerPage, fsApiUrl } from '$lib/config';
import { storage } from '$lib/assets/js/storage-utils.js';

type EntryKind = import('@vorstieg/fels-types/types').EntryKind;
type FelsEntry = import('@vorstieg/fels-types/types').FelsEntry;
type FelsLocation = import('$lib/types/files').FelsLocation;
type PersistedCragsCache = { timestamp: number; crags: FelsLocation[] };

const STORAGE_KEY = 'felsverzeichnis:crags-cache-v1';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let cachedCrags: FelsLocation[] | null = null;
let fetchPromise: Promise<FelsLocation[]> | null = null;
let cacheTime = 0;

function refreshCrags(fetcher: typeof globalThis.fetch): Promise<FelsLocation[]> {
	if (!fetchPromise) {
		fetchPromise = (async () => {
			try {
				const res = await fetcher(`${fsApiUrl}/fels-layer.json`);
				if (!res.ok) throw new Error('Failed to fetch map GeoJSON from API');
				type LayerFeature = FelsEntry & {
					properties?: {
						path?: string;
						id?: string;
						kind?: EntryKind;
						[key: string]: unknown;
					};
				};
				const featureCollection = (await res.json()) as {
					type?: string;
					features?: LayerFeature[];
				};
				const features = featureCollection.features || [];
				const entries: FelsLocation[] = features.map((feature) => {
					const properties = feature.properties || {};
					const path = String(properties.path);
					return {
						entry: feature as FelsEntry,
						path
					};
				});
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
