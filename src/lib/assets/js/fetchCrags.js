import { cragsPerPage, fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';

let cachedCrags = null;
let fetchPromise = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function normalizeEntryPath(path = '') {
	return path.replace(/^entries\//, '');
}

export class crag {
	constructor(name, path) {
		this.name = name;
		this.path = path;
	}

	getMainPath(){
		return `${this.name} ${this.path}`;
	}

	getTransitPath() {
		return `${this.getMainPath()}-transit.json`
	}

	getParkingPath(){
		return `${this.getMainPath()}-parking.json`
	}

	getTopoPath(){
		return `${this.getMainPath()}-topo.json`
	}
}

const fetchCrags = async ({ offset = 0, limit = cragsPerPage, search = '' } = {}) => {
	const API_URL = fsApiUrl;

	let crags;

	if (cachedCrags && Date.now() - cacheTime < CACHE_DURATION) {
		crags = cachedCrags;
	} else {
		if (!fetchPromise) {
			fetchPromise = (async () => {
				try {
					console.log(`[fetchCrags] Fetching manifest from ${API_URL}/manifest.json`);
					const res = await fetch(`${API_URL}/manifest.json`);
					if (!res.ok) throw new Error('Failed to fetch crag manifest from API');
					const manifest = await res.json();
					console.log(`[fetchCrags] Manifest loaded, ${manifest.length} crags found`);

					return manifest.map(entry => ({
						type: "Feature",
						geometry: entry.geometry,
						properties: {
							id: entry.id,
							name: entry.name,
							path: entry.path,
							type: entry.type || [],
							hash: entry.hash
						}
					}));
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
