import { cragsPerPage, fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';

let cachedCrags = null;
let fetchPromise = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const fetchCrags = async ({ offset = 0, limit = cragsPerPage, search = '' } = {}) => {
	const API_URL = fsApiUrl;

	let crags;

	if (cachedCrags && Date.now() - cacheTime < CACHE_DURATION) {
		crags = cachedCrags;
	} else {
		if (!fetchPromise) {
			fetchPromise = (async () => {
				try {
					const res = await fetch(`${API_URL}/fels-layer.json`);
					if (!res.ok) throw new Error('Failed to fetch map GeoJSON from API');
					const featureCollection = await res.json();

					return featureCollection.features;
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
        return a.properties.name.localeCompare(b.properties.name);
    });

	if (search) {
		sortedCrags = sortedCrags.filter(
			(crag) =>
				crag.properties.name.toLowerCase().includes(search.toLowerCase()) ||
				(crag.properties.type && crag.properties.type.includes(search)) ||
				crag.properties.path.toLowerCase().includes(search.toLowerCase())
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
