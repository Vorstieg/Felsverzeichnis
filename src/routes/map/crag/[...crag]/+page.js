import { error } from '@sveltejs/kit';
import { fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';

export async function load({ params, url, parent, fetch }) {
	try {
		const parentData = await parent();
		const crags = parentData.locations || [];

		const API_URL = fsApiUrl;
		
		const _fetchJson = async (p) => {
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
					
					await cache.put(`${API_URL}/${cragPath}/hash.txt`, new Response(currentHash));
					
					Promise.all(otherFiles.map(async (file) => {
						const fileUrl = `${API_URL}/${cragPath}/${file.path}`;
						const fileRes = await fetch(fileUrl);
						if (fileRes.ok) await cache.put(fileUrl, fileRes);
					})).catch(() => {});
				}
			} catch (e) {}
		};
		const normalizeSectorData = (sector) =>
			sector
				? {
						...sector,
						...(sector.properties || {}),
						geometry: sector.geometry || sector.properties?.geometry
					}
				: null;
		const getGeometryCenter = (geometry) => {
			if (!geometry?.coordinates) return null;
			if (geometry.type === 'Point') return geometry.coordinates;

			const coordinates =
				geometry.type === 'Polygon'
					? geometry.coordinates?.[0]
					: geometry.type === 'MultiPolygon'
						? geometry.coordinates?.flatMap((polygon) => polygon[0])
						: geometry.coordinates;

			if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

			const usableCoordinates =
				coordinates.length > 1 &&
				coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
				coordinates[0][1] === coordinates[coordinates.length - 1][1]
					? coordinates.slice(0, -1)
					: coordinates;

			const sums = usableCoordinates.reduce(
				(acc, coordinate) => [acc[0] + coordinate[0], acc[1] + coordinate[1]],
				[0, 0]
			);

			return [sums[0] / usableCoordinates.length, sums[1] / usableCoordinates.length];
		};
		const isLineGeometry = (geometry) =>
			geometry?.type === 'LineString' || geometry?.type === 'MultiLineString';
		const normalizeLineGeometry = (candidate) => {
			if (isLineGeometry(candidate)) return candidate;
			if (candidate?.type === 'Feature' && isLineGeometry(candidate.geometry)) {
				return candidate.geometry;
			}
			return null;
		};
		const extractRouteTrackFeatures = (routes = [], context = {}) =>
			routes.flatMap((route) => {
				const pathAssets = Array.isArray(route?.assets?.paths) ? route.assets.paths : [];
				if (pathAssets.length === 0) return [];

				return pathAssets
					.map((pathAsset, index) => {
						const geometry = normalizeLineGeometry(pathAsset?.path || pathAsset);
						if (!geometry) return null;

						return {
							type: 'Feature',
							geometry,
							properties: {
								name: pathAsset.label || route.name || route.id || 'Route',
								routeId: route.id || null,
								routeName: route.name || null,
								routeType: route.type || null,
								geometryMode: route.geometryMode || null,
								pathRole: pathAsset.role || null,
								pathIndex: index,
								sectorId: context.sectorId || null,
								sectorName: context.sectorName || null,
								cragPath: context.cragPath || null
							}
						};
					})
					.filter(Boolean);
			});
		const aggregateSectorRoutes = async (cragPath, sectors = []) => {
			const routes = [];
			for (const sector of sectors) {
				if (!sector?.id) continue;
				const sectorTopo = await fetchJson(`${cragPath}/${sector.id}/${sector.id}-topo.json`);
				if (!Array.isArray(sectorTopo?.routes)) continue;
				routes.push(
					...sectorTopo.routes.map((route) => ({
						...route,
						sectorId: sector.id,
						sectorName: sector.name,
						sectorWallAzimuth: sectorTopo.wallAzimuth,
						sectorTags: sectorTopo.tags
					}))
				);
			}
			return routes;
		};
		const aggregateSectorTrackFeatures = async (cragPath, sectors = []) => {
			const tracks = [];
			for (const sector of sectors) {
				if (!sector?.id) continue;
				const sectorTopo = await fetchJson(`${cragPath}/${sector.id}/${sector.id}-topo.json`);
				if (!Array.isArray(sectorTopo?.routes)) continue;
				tracks.push(
					...extractRouteTrackFeatures(sectorTopo.routes, {
						cragPath,
						sectorId: sector.id,
						sectorName: sector.name
					})
				);
			}
			return tracks;
		};

		const matchingCrag = crags
			.filter(
				(it) =>
					params.crag === it.properties?.path || params.crag.startsWith(`${it.properties?.path}/`)
			)
			.sort((a, b) => b.properties.path.length - a.properties.path.length)
			.find((it) => {
				const rest =
					params.crag === it.properties.path
						? []
						: params.crag
								.slice(it.properties.path.length + 1)
								.split('/')
								.filter(Boolean);
				return rest.length === 0 || it.properties?.sectors?.some((sector) => sector.id === rest[0]);
			});

		const relativeParts =
			matchingCrag && params.crag !== matchingCrag.properties.path
				? params.crag
						.slice(matchingCrag.properties.path.length + 1)
						.split('/')
						.filter(Boolean)
				: [];
		let isSectorPath = Boolean(
			relativeParts[0] &&
				matchingCrag?.properties?.sectors?.some((sector) => sector.id === relativeParts[0])
		);
		let basePath = matchingCrag?.properties?.path || params.crag;
		let sectorId = isSectorPath ? relativeParts[0] : null;
		const cragName = basePath.split('/').at(-1);

		let crag = matchingCrag;
		let sectorData = null;

		if (crag) {
			const fullCrag = await _fetchJson(`${basePath}/${cragName}.json`);
			if (fullCrag) {
				crag = fullCrag;
				if (!crag.properties) crag.properties = {};
				crag.properties.path = basePath;
			}
		}

		if (!crag) {
			const parts = params.crag.split('/');
			if (parts.length > 1) {
				sectorId = parts.pop();
				basePath = parts.join('/');
				const baseName = basePath.split('/').at(-1);
				const baseCrag = await _fetchJson(`${basePath}/${baseName}.json`);
				if (baseCrag) {
					crag = baseCrag;
					isSectorPath = true;
					sectorData = normalizeSectorData(await _fetchJson(`${basePath}/${sectorId}/${sectorId}.json`));
				}
			}
		} else {
			if (isSectorPath) {
				sectorData = crag.properties?.sectors?.find((s) => s.id === sectorId);
				if (!sectorData) {
					sectorData = normalizeSectorData(
						await _fetchJson(`${basePath}/${sectorId}/${sectorId}.json`)
					);
				}
			}
		}

		if (!crag) {
			throw new Error(`Crag data not found at ${params.crag}`);
		}

		if (browser) {
			cacheCragFolder(basePath);
		}

		let allFiles = await _fetchJson(`${basePath}/?recursive=true`);
		const fetchJson = async (p) => {
			if (allFiles && p.startsWith(`${basePath}/`)) {
				const relPath = p.slice(basePath.length + 1);
				if (!allFiles.some(f => f.type === 'file' && f.path === relPath)) {
					return null;
				}
			}
			return await _fetchJson(p);
		};

		const cragForUi = crag;
		let tracks = [];
		if (isSectorPath) {
			const sectorTopo = await fetchJson(`${basePath}/${sectorId}/${sectorId}-topo.json`);
			tracks = extractRouteTrackFeatures(sectorTopo?.routes || [], {
				cragPath: basePath,
				sectorId,
				sectorName: sectorData?.name
			});
		} else {
			const cragTopo = await fetchJson(`${params.crag}/${cragName}-topo.json`);
			tracks = [
				...extractRouteTrackFeatures(cragTopo?.routes || [], {
					cragPath: params.crag
				}),
				...(await aggregateSectorTrackFeatures(basePath, cragForUi.properties?.sectors || []))
			];
		}

		const streamDetails = async () => {
			let images = [];
			try {
				const imageScanPath = params.crag;
				const dirRes = await fetch(`${API_URL}/${imageScanPath}`);
				if (dirRes.ok) {
					const files = await dirRes.json();
					const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
					images = files
						.filter(
							(f) => f.type === 'file' && imageExts.some((ext) => f.name.toLowerCase().endsWith(ext))
						)
						.map((f) => `${API_URL}/${imageScanPath}/${f.name}`);
				}
			} catch (e) {
				// Ignore
			}

			const assetPath = isSectorPath ? basePath : params.crag;
			const assetName = assetPath.split('/').at(-1);
			const transit = await fetchJson(`${assetPath}/${assetName}-transit.json`);
			const transitTrack = await fetchJson(`${assetPath}/${assetName}-transit-track.json`);
			const parking = await fetchJson(`${assetPath}/${assetName}-parking.json`);

			let topoJson = null;
			let gradeRoutes = [];
			const modelCandidates = [];
			let has3DTopo = false;

			if (isSectorPath) {
				topoJson = await fetchJson(`${basePath}/${sectorId}/${sectorId}-topo.json`);
				gradeRoutes = topoJson?.routes || [];
				modelCandidates.push({ path: `${basePath}/${sectorId}`, fileName: `${sectorId}.glb` });
			} else {
				topoJson = await fetchJson(`${params.crag}/${cragName}-topo.json`);
				const sectorRoutes = await aggregateSectorRoutes(
					basePath,
					cragForUi.properties?.sectors || []
				);
				gradeRoutes = sectorRoutes.length > 0 ? sectorRoutes : topoJson?.routes || [];
				modelCandidates.push({ path: params.crag, fileName: `${cragName}.glb` });
			}
			
			if (topoJson) {
				try {
					for (const candidate of modelCandidates) {
						const dirRes = await fetch(`${API_URL}/${candidate.path}`);
						if (!dirRes.ok) continue;
						const files = await dirRes.json();
						if (files.some((file) => file.type === 'file' && file.name === candidate.fileName)) {
							has3DTopo = true;
							break;
						}
					}
				} catch (e) {
					// Ignore
				}
			}

			return {
				images,
				transit: transit?.geometry?.coordinates,
				parking: parking?.geometry?.coordinates,
				transitTrack,
				topoJson,
				gradeRoutes,
				has3DTopo
			};
		};

		return {
			path: params.crag,
			topoPath: params.crag,
			basePath,
			sectorId,
			isSectorPath,
			crag: cragForUi,
			zoom: 16,
			locations: [cragForUi],
			tracks,
			center:
				getGeometryCenter(isSectorPath ? sectorData?.geometry : cragForUi.geometry) ||
				cragForUi.geometry.coordinates,
			cameraTarget:
				isSectorPath && getGeometryCenter(sectorData?.geometry)
					? { center: getGeometryCenter(sectorData.geometry), zoom: 18 }
					: null,
			name:
				isSectorPath && sectorData?.name
					? `${cragForUi.properties.name} - ${sectorData.name}`
					: cragForUi.properties.name,
			topo: isSectorPath && sectorData?.topo ? sectorData.topo : cragForUi.properties.topo,
			description_de:
				isSectorPath && sectorData?.description_de
					? sectorData.description_de
					: cragForUi.properties.description_de,
			description_en:
				isSectorPath && sectorData?.description_en
					? sectorData.description_en
					: cragForUi.properties.description_en,
			type: isSectorPath && sectorData?.type ? sectorData.type : cragForUi.properties.type,
			sector: normalizeSectorData(sectorData),
			detailsShown: true,
			zoomToLocations: true,
			meta: {
				lang: 'de',
				title:
					(isSectorPath && sectorData?.name
						? `${cragForUi.properties.name} - ${sectorData.name}`
						: cragForUi.properties.name) + ' - Felsverzeichnis',
				description:
					(isSectorPath && sectorData?.description_de
						? sectorData.description_de
						: cragForUi.properties.description_de) || '',
				type: 'article',
				author: 'Vorstieg Software FlexCo',
				url: url.href
			},
			streamed: {
				details: streamDetails()
			}
		};
	} catch (err) {
		error(404, { message: err.message || 'Not found' });
	}
}
