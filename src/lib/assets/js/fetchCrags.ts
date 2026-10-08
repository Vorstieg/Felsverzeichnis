import { cragsPerPage, fsApiUrl } from '$lib/config';

let cachedCrags: import('$lib/types/files').FelsLocation[] | null = null;
let fetchPromise: Promise<import('$lib/types/files').FelsLocation[]> | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const fetchCrags = async ({
	offset = 0,
	limit = cragsPerPage,
	search = '',
	fetch: fetcher = globalThis.fetch
}: { offset?: number; limit?: number; search?: string; fetch?: typeof globalThis.fetch } = {}) => {
	const API_URL = fsApiUrl;

	let crags;

	if (cachedCrags && Date.now() - cacheTime < CACHE_DURATION) {
		crags = cachedCrags;
	} else {
		if (!fetchPromise) {
			fetchPromise = (async () => {
				try {
					const res = await fetcher(`${API_URL}/?recursive=true`);
					if (!res.ok) throw new Error('Failed to fetch entry directory');
					const files = (await res.json()) as import('$lib/types/files').DirectoryEntry[];
					const entryFiles = files.filter((file) => {
						const folder = file.path.split('/').at(-2);
						return file.type === 'file' && file.name === `${folder}.json`;
					});
					const entries: import('$lib/types/files').FelsLocation[] = [];
					for (let offset = 0; offset < entryFiles.length; offset += 8) {
						const batch = await Promise.all(
							entryFiles.slice(offset, offset + 8).map(async (file) => {
								const response = await fetcher(`${API_URL}/${file.path}`);
								if (!response.ok) throw new Error(`Failed to fetch entry: ${file.path}`);
								const entry =
									(await response.json()) as import('@vorstieg/fels-types/types').FelsEntry;
								return { entry, path: file.path.slice(0, -(file.name.length + 1)) };
							})
						);
						entries.push(...batch);
					}
					return entries;
				} finally {
					fetchPromise = null;
				}
			})();
		}
		crags = await fetchPromise;
		cachedCrags = crags;
		cacheTime = Date.now();
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
