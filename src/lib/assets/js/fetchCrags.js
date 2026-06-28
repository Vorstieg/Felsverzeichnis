import { cragsPerPage, fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';

let cachedCrags = null;
let fetchPromise = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const fetchCrags = async ({ offset = 0, limit = cragsPerPage, search = '' } = {}) => {
	const API_URL = fsApiUrl;

	const normalizeSectorData = (sector = {}) => ({
		...sector,
		...(sector.properties || {}),
		geometry: sector.geometry || sector.properties?.geometry
	});

	let crags;

	if (cachedCrags && Date.now() - cacheTime < CACHE_DURATION) {
		crags = cachedCrags;
	} else {
		if (!fetchPromise) {
			fetchPromise = (async () => {
				try {
					console.log(
						`[fetchCrags] SSR: ${!browser}, fetching index from ${API_URL}/?recursive=true`
					);
					const indexRes = await fetch(`${API_URL}/?recursive=true`);
					console.log(`[fetchCrags] Index fetched, status: ${indexRes.status}`);
					if (!indexRes.ok) throw new Error('Failed to fetch crag index from API');
					const allFiles = await indexRes.json();
					console.log(`[fetchCrags] Index parsed, ${allFiles.length} files found`);

					const targetFiles = allFiles.filter((f) => {
						if (f.type !== 'file') return false;
						if (!f.path.endsWith('.json')) return false;
						if (f.path.includes('-transit')) return false;
						if (f.path.includes('-parking')) return false;
						if (f.path.includes('-topo')) return false;
						const pathParts = f.path.split('/');
						const fileSlug = f.name.replace(/\.json$/, '');
						const dirSlug = pathParts.at(-2);
						if (fileSlug !== dirSlug) return false;
						if (pathParts.length > 2) {
							const parentPath = pathParts.slice(0, -2).join('/');
							const parentSlug = pathParts.at(-3);
							if (
								allFiles.some(
									(parent) =>
										parent.type === 'file' && parent.path === `${parentPath}/${parentSlug}.json`
								)
							) {
								return false;
							}
						}
						return true;
					});

					const fetchedCrags = [];
					const BATCH_SIZE = 10;
					for (let i = 0; i < targetFiles.length; i += BATCH_SIZE) {
						const batch = targetFiles.slice(i, i + BATCH_SIZE);
						console.log(
							`[fetchCrags] Processing batch ${i / BATCH_SIZE + 1}, sizes: ${batch.length}`
						);
						const batchResults = await Promise.all(
							batch.map(async (file) => {
								const res = await fetch(`${API_URL}/${file.path}`);
								const data = await res.json();

								const cragPath = file.path.split('/').slice(0, -1).join('/');
								data.properties.path = cragPath;

								// Check for sectors declared in metadata or backed by direct files in the crag directory
								const sectorIds = new Set(
									data.properties.sectors?.map((sector) => sector.id).filter(Boolean) || []
								);
								const cragSlug = cragPath.split('/').at(-1);
								allFiles.forEach((f) => {
									if (!f.path.startsWith(`${cragPath}/`)) return;
									const relativePath = f.path.slice(`${cragPath}/`.length);
									const parts = relativePath.split('/');
									const [id, fileName] = parts;
									if (!id || parts.length > 2) return;
									if (
										id === cragSlug ||
										id.endsWith('-transit') ||
										id.endsWith('-transit-track') ||
										id.endsWith('-parking')
									)
										return;
									if (
										(f.type === 'directory' && parts.length === 1) ||
										fileName === `${id}.json` ||
										fileName === `${id}-topo.json` ||
										fileName === `${id}.glb`
									) {
										sectorIds.add(id);
									}
								});

								if (sectorIds.size > 0) {
									// Fetch sector metadata
									const sectors = [];
									for (const sectorId of sectorIds) {
										try {
											const existingSector =
												data.properties.sectors?.find((sector) => sector.id === sectorId) || {};

											// Look for sector metadata file
											const sectorMetaFile = allFiles.find(
												(f) =>
													f.type === 'file' && f.path === `${cragPath}/${sectorId}/${sectorId}.json`
											);
											const topoFiles = allFiles
												.filter(
													(f) =>
														f.type === 'file' &&
														f.path === `${cragPath}/${sectorId}/${sectorId}-topo.json`
												)
												.map((f) => f.name);
											const modelFiles = allFiles
												.filter(
													(f) =>
														f.type === 'file' &&
														f.path === `${cragPath}/${sectorId}/${sectorId}.glb`
												)
												.map((f) => f.name);

											let sectorData = existingSector;

											if (sectorMetaFile) {
												const sectorRes = await fetch(`${API_URL}/${sectorMetaFile.path}`);
												const loadedSector = normalizeSectorData(await sectorRes.json());
												sectorData = {
													...existingSector,
													...loadedSector,
													geometry: loadedSector.geometry || existingSector.geometry
												};
											}

											if (Object.keys(sectorData).length || topoFiles.length || modelFiles.length) {
												sectors.push({
													id: sectorId,
													name: sectorData.name || `Sector ${sectorId}`,
													...sectorData,
													assets: {
														...(sectorData.assets || {}),
														topos: sectorData.assets?.topos || topoFiles,
														models: sectorData.assets?.models || modelFiles
													},
													hasTopo: Boolean(
														topoFiles.length ||
															sectorData.assets?.topos?.length ||
															sectorData.topos?.length ||
															sectorData.topo?.link
													)
												});
											}
										} catch (e) {
											console.warn(`Failed to load sector ${sectorId}:`, e);
										}
									}

									if (sectors.length > 0) {
										data.properties.sectors = sectors;
									}
								}

								const imageExts = ['.jpg', '.jpeg', '.png', '.gif'];
								const previewFile = allFiles.find(
									(f) =>
										f.type === 'file' &&
										f.path.startsWith(cragPath + '/') &&
										!f.path.slice(cragPath.length + 1).includes('/') &&
										imageExts.some((ext) => f.name.toLowerCase().endsWith(ext))
								);

								if (previewFile) {
									data.properties.previewImage = `${API_URL}/${previewFile.path}`;
								}

								return data;
							})
						);
						fetchedCrags.push(...batchResults);
					}
					return fetchedCrags;
				} finally {
					fetchPromise = null;
				}
			})();
		}
		crags = await fetchPromise;
		cachedCrags = crags;
		cacheTime = Date.now();
	}

	let sortedCrags = [...crags].sort(
		(a, b) => new Date(b.properties.date) - new Date(a.properties.date)
	);

	if (search) {
		sortedCrags = sortedCrags.filter(
			(crag) =>
				crag.properties.name.toLowerCase().includes(search.toLowerCase()) ||
				crag.properties.type.includes(search) ||
				crag.properties.path.toLowerCase().includes(search.toLowerCase()) ||
				(crag.properties.sectors &&
					crag.properties.sectors.some((s) => s.name.toLowerCase().includes(search.toLowerCase())))
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
