import { error } from '@sveltejs/kit';
import { fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';

export const load = async ({ params, url, fetch }) => {
	try {
		let topo;
		let route;
		let path;
		let sectorData = null;
		let baseCragPath = params.crag;
		let sectorPath = null;
		let sectorId = null;
		let isSectorPath = false;

		const API_URL = fsApiUrl;
		const fetchJson = async (p) => {
			const url = `${API_URL}/${p}`;
			try {
				const res = await fetch(url);
				if (res.ok) return await res.json();
			} catch (e) {
				// Offline, fall back below
			}
			try {
				if (browser) {
					const cache = await caches.open('felslager-crags');
					const cached = await cache.match(url, { ignoreVary: true, ignoreSearch: true });
					if (cached) return await cached.json();
				}
			} catch(e) {}
			return null;
		};

		const cacheCragFolder = async (cragPath) => {
			try {
				const hashRes = await fetch(`${API_URL}/${cragPath}/hash.txt`);
				if (!hashRes.ok) return;
				const currentHash = (await hashRes.text()).trim();
				
				const cache = await caches.open('felslager-crags');
				const cachedHashRes = await cache.match(`${API_URL}/${cragPath}/hash.txt`);
				const cachedHash = cachedHashRes ? (await cachedHashRes.text()).trim() : null;
				
				// Verify if the directory was cached previously
				const baseDirCached = await cache.match(`${API_URL}/${cragPath}`);
				
				if (currentHash !== cachedHash || !baseDirCached) {
					const indexRes = await fetch(`${API_URL}/${cragPath}/?recursive=true`);
					const files = await indexRes.json();
					
					const jsonFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.json'));
					const otherFiles = files.filter(f => f.type === 'file' && !f.name.endsWith('.json'));
					
					await Promise.all(jsonFiles.map(async (file) => {
						const fileUrl = `${API_URL}/${cragPath}/${file.path}`;
						const fileRes = await fetch(fileUrl);
						if (fileRes.ok) await cache.put(fileUrl, fileRes);
					}));
					
					const dirsToCache = [cragPath, ...files.filter(f => f.type === 'dir').map(d => `${cragPath}/${d.path}`)];
					await Promise.all(dirsToCache.map(async (dir) => {
						const dRes = await fetch(`${API_URL}/${dir}`);
						if (dRes.ok) await cache.put(`${API_URL}/${dir}`, dRes);
					}));
					
					// Cache the new hash as soon as the critical JSON is safe
					await cache.put(`${API_URL}/${cragPath}/hash.txt`, new Response(currentHash));
					
					// Cache heavy images and 3D models in the background (fire and forget)
					Promise.all(otherFiles.map(async (file) => {
						const fileUrl = `${API_URL}/${cragPath}/${file.path}`;
						const fileRes = await fetch(fileUrl);
						if (fileRes.ok) await cache.put(fileUrl, fileRes);
					})).catch(() => {});
				}
			} catch (e) {}
		};
		const findRouteOrChild = (routes, id) => {
			for (const parent of routes || []) {
				if (parent.id === id) return parent;
				for (const child of [...(parent.pitches || []), ...(parent.variants || [])]) {
					if (child.id === id) return { ...child, parentId: parent.id };
				}
			}
			return null;
		};

		const normalizeSectorData = (sector) =>
			sector
				? {
						...sector,
						...(sector.properties || {}),
						geometry: sector.geometry || sector.properties?.geometry
					}
				: null;

		const pathParts = params.crag.split('/');
		const lastPart = pathParts.at(-1);

		// Try as Crag
		topo = await fetchJson(`${params.crag}/${lastPart}-topo.json`);

		if (topo) {
			path = params.crag;
		} else if (pathParts.length > 1) {
			// Try as Sector
			const parentPath = pathParts.slice(0, -1).join('/');
			topo = await fetchJson(`${parentPath}/${lastPart}/${lastPart}-topo.json`);
			if (topo) {
				isSectorPath = true;
				baseCragPath = parentPath;
				sectorId = lastPart;
				sectorPath = `${parentPath}/${lastPart}`;
				path = sectorPath;
				sectorData = normalizeSectorData(await fetchJson(`${sectorPath}/${sectorId}.json`));
			} else {
				// Try as Crag + Route
				const parentCragName = pathParts.at(-2);
				topo = await fetchJson(`${parentPath}/${parentCragName}-topo.json`);
				if (topo) {
					baseCragPath = parentPath;
					path = parentPath;
					route = findRouteOrChild(topo.routes, lastPart);
				} else if (pathParts.length > 2) {
					// Try as Sector + Route
					const grandParentPath = pathParts.slice(0, -2).join('/');
					const sectorName = pathParts.at(-2);
					topo = await fetchJson(`${grandParentPath}/${sectorName}/${sectorName}-topo.json`);
					if (topo) {
						isSectorPath = true;
						baseCragPath = grandParentPath;
						sectorId = sectorName;
						sectorPath = `${grandParentPath}/${sectorName}`;
						path = sectorPath;
						route = findRouteOrChild(topo.routes, lastPart);
						sectorData = normalizeSectorData(await fetchJson(`${sectorPath}/${sectorId}.json`));
					}
				}
			}
		}

		if (!topo) {
			error(404, { message: `Crag or route not found: ${params.crag}` });
		}

		const pojo = (obj) => (obj ? JSON.parse(JSON.stringify(obj)) : obj);

		// Fetch crag metadata to aggregate routes if it's a crag
		let indexedCrag = null;
		let gradeRoutes = topo?.routes || [];
		if (!isSectorPath) {
			const cragName = baseCragPath.split('/').at(-1);
			indexedCrag = await fetchJson(`${baseCragPath}/${cragName}.json`);
			const sectors = indexedCrag?.properties?.sectors || [];
			if (sectors.length > 0) {
				const sectorRoutes = [];
				const sectorPromises = sectors.map(async (sector) => {
					if (!sector?.id) return [];
					const sectorTopo = await fetchJson(`${baseCragPath}/${sector.id}/${sector.id}-topo.json`);
					if (Array.isArray(sectorTopo?.routes)) {
						return sectorTopo.routes.map((route) => ({
							...route,
							sectorId: sector.id,
							sectorName: sector.name,
							sectorWallAzimuth: sectorTopo.wallAzimuth,
							sectorTags: sectorTopo.tags
						}));
					}
					return [];
				});

				const results = await Promise.all(sectorPromises);
				for (const result of results) {
					sectorRoutes.push(...result);
				}

				if (sectorRoutes.length > 0) {
					gradeRoutes = sectorRoutes;
				}
			}
		} else if (!sectorData && sectorId) {
			const cragName = baseCragPath.split('/').at(-1);
			indexedCrag = await fetchJson(`${baseCragPath}/${cragName}.json`);
			sectorData = normalizeSectorData(
				indexedCrag?.properties?.sectors?.find((sector) => sector.id === sectorId)
			);
		}

		// Check if a .glb model exists
		let has3D = false;
		let modelUrl = null;
		let lowResModelUrl = null;

		const modelCandidates = isSectorPath
			? [{ path: sectorPath, fileName: `${sectorId}.glb` }]
			: [{ path, fileName: `${path.split('/').at(-1)}.glb` }];

		try {
			for (const candidate of modelCandidates) {
				const dirRes = await fetch(`${API_URL}/${candidate.path}`);
				if (dirRes.ok) {
					const files = await dirRes.json();
					const glbFile = files.find((f) => f.name === candidate.fileName);
					if (glbFile) {
						has3D = true;
						modelUrl = `${API_URL}/${candidate.path}/${candidate.fileName}`;
						
						const lowResName = candidate.fileName.replace('.glb', '-low.glb');
						if (files.some((f) => f.name === lowResName)) {
							lowResModelUrl = `${API_URL}/${candidate.path}/${lowResName}`;
						}
						break;
					}
				}
			}
		} catch (e) {
			// Ignore
		}

		if (browser) {
			cacheCragFolder(baseCragPath);
		}

		return {
			path,
			baseCragPath,
			sectorPath,
			sectorId,
			sector: pojo(sectorData),
			sectors: pojo(indexedCrag?.properties?.sectors || []),
			isSectorPath,
			topo: pojo(topo),
			gradeRoutes: pojo(gradeRoutes),
			route: pojo(route) || null,
			has3D,
			modelUrl,
			lowResModelUrl,
			cragName: indexedCrag?.properties?.name,
			cragType: indexedCrag?.properties?.type,
			name: topo?.name,
			description_de: topo?.description_de || indexedCrag?.properties?.description_de,
			description_en: topo?.description_en || indexedCrag?.properties?.description_en,
			meta: {
				lang: 'de',
				title: (topo?.name || 'Topo') + ' - Felsverzeichnis',
				description: topo?.description_de || '',
				type: 'article',
				author: topo?.author,
				url: url.href
			}
		};
	} catch (err) {
		error(404, { message: err.message || 'Not found' });
	}
};
