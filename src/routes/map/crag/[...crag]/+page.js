import { error } from '@sveltejs/kit';
import { fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';
import { Topo } from '$lib/assets/js/topo-paths.js';
import { getGeometryCenter } from '$lib/assets/js/topo-loader-utils.js';
import { createCragCache } from '$lib/assets/js/crag-cache.js';

/** @typedef {import('@vorstieg/fels-data/types').CragFeature} CragFeature */
/** @typedef {import('@vorstieg/fels-data/types').SectorFeature} SectorFeature */
/** @typedef {import('@vorstieg/fels-data/types').TopoDocument} TopoDocument */

export async function load({ params, url, parent, fetch }) {
	try {
		const parentData = await parent();

		const API_URL = fsApiUrl;
		const {
			fetchJson: _fetchJson,
			cacheCragFolder,
			normalizePath
		} = createCragCache({
			apiUrl: API_URL,
			fetch,
			useCache: browser
		});
		const openCrag = parentData.locations
			?.filter((it) => params.crag.startsWith(`${it.properties?.path}`))
			?.sort((a, b) => b.properties.path.length - a.properties.path.length)
			?.find((it) => {
				return it.properties?.minzoom < 16;
			});

		const sectorIds = params.crag
			.slice(openCrag.properties.path.length + 1)
			.split('/')
			.filter(Boolean);
		const sectorId = sectorIds.at(-1) || null;

		const cragPath = openCrag.properties.path.slice(0, -(openCrag.properties.id.length + 1));

		const currentLocation =
			openCrag.properties.path === params.crag
				? new Topo(cragPath, openCrag.properties.id)
				: new Topo(cragPath, openCrag.properties.id, sectorId);

		/** @type {CragFeature | null} */
		const cragData = await _fetchJson(currentLocation.getCragPath());

		/** @type {SectorFeature | null} */
		const sectorData = currentLocation.sectorId
			? await _fetchJson(currentLocation.getCurrentPath())
			: null;

		const currentData = sectorData ? sectorData : cragData;

		if (browser) {
			cacheCragFolder(currentLocation.getFolder());
		}

		const currentFolder = normalizePath(currentLocation.getFolder());
		let allFilesPromise = _fetchJson(`${currentFolder}/?recursive=true`);
		const fetchJson = async (p) => {
			const allFiles = await allFilesPromise;
			if (allFiles && p.startsWith(`${currentFolder}/`)) {
				const relPath = p.slice(currentFolder.length + 1);
				if (!allFiles.some((f) => f.type === 'file' && f.path === relPath)) {
					return null;
				}
			}
			return await _fetchJson(p);
		};

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
							(f) =>
								f.type === 'file' && imageExts.some((ext) => f.name.toLowerCase().endsWith(ext))
						)
						.map((f) => `${API_URL}/${imageScanPath}/${f.name}`);
				}
			} catch (e) {
				// Ignore
			}

			const accessFeatures = accessData?.features || [];
			const transitFeature = accessFeatures.find(
				(feature) => feature.properties?.kind === 'transit'
			);
			const parkingFeature = accessFeatures.find(
				(feature) => feature.properties?.kind === 'parking'
			);

			/** @type {TopoDocument | null} */
			let topoJson = await fetchJson(currentLocation.getTopoPath());
			let gradeRoutes = topoJson?.routes || [];
			let sectorTopos = [];

			if (currentLocation.sectorId && topoJson) {
				const sector = cragData?.properties?.sectors?.find(
					(candidate) => candidate?.id === currentLocation.sectorId
				);
				const sectorName = sector?.name || currentData?.properties?.name;

				sectorTopos = [
					{
						sectorId: currentLocation.sectorId,
						sectorName,
						topo: topoJson
					}
				];
				gradeRoutes = gradeRoutes.map((route) => ({
					...route,
					sectorId: currentLocation.sectorId,
					sectorName,
					sectorWallAzimuth: topoJson.wallAzimuth,
					sectorTags: topoJson.tags
				}));
			}

			if (!currentLocation.sectorId) {
				const sectors = cragData?.properties?.sectors || [];

				const sectorResults = await Promise.all(
					sectors.map(async (sector) => {
						if (!sector?.id) return null;

						const sectorTopo = await fetchJson(
							new Topo(cragPath, openCrag.properties.id, sector.id).getTopoPath()
						);

						if (!sectorTopo) return null;

						return {
							sectorId: sector.id,
							sectorName: sector.name,
							topo: sectorTopo
						};
					})
				);

				sectorTopos = sectorResults.filter(Boolean);

				if (sectorTopos.length > 0) {
					gradeRoutes = sectorTopos.flatMap(({ sectorId, sectorName, topo }) =>
						(topo.routes || []).map((route) => ({
							...route,
							sectorId,
							sectorName,
							sectorWallAzimuth: topo.wallAzimuth,
							sectorTags: topo.tags
						}))
					);
				}
			}
			let has3DTopo = false;

			if (topoJson) {
				try {
					const dirRes = await fetch(`${API_URL}/${currentLocation.getFolder()}`);
					const files = await dirRes.json();
					if (
						files.some((file) => file.type === 'file' && file.name === currentLocation.getGlbName())
					) {
						has3DTopo = true;
					}
				} catch (e) {
					// Ignore
				}
			}
			let has2DTopo = topoJson?.routes?.some((r) => r.points2D?.length > 0);
			return {
				images,
				access: accessData,
				transit: transitFeature?.geometry?.coordinates,
				parking: parkingFeature?.geometry?.coordinates,
				topoJson,
				sectorTopos,
				gradeRoutes,
				has3DTopo,
				has2DTopo
			};
		};

		const accessData = await fetchJson(currentLocation.getAccessPath());
		const topoDocument = await fetchJson(currentLocation.getTopoPath());
		const pathRoles = new Map(
			(topoDocument?.routes || []).flatMap((route) =>
				(route.pathRefs || []).map((reference) => [
					String(reference.pathId),
					{
						...reference,
						routeType: Array.isArray(route.type) ? route.type[0] : route.type
					}
				])
			)
		);
		const topoPaths = (topoDocument?.paths?.features || []).map((feature) => {
			const reference = pathRoles.get(String(feature.id));
			return {
				...feature,
				properties: {
					...(feature.properties || {}),
					role: reference?.role || feature.properties?.role || 'main',
					routeType: reference?.routeType || feature.properties?.routeType || '',
					label: reference?.label || feature.properties?.label || feature.properties?.name || ''
				}
			};
		});

		return {
			currentLocation: currentLocation,
			currentData: currentData,
			cragData: cragData,
			cragPathUrl: openCrag.properties.path,
			locations: parentData.allLocations,
			access: accessData,
			topoPaths,
			cameraTarget: (() => {
				const center = getGeometryCenter(currentData.geometry || openCrag.geometry);
				return center ? { type: 'center', center, zoom: 16 } : null;
			})(),
			name: currentData.properties.name,
			description_de: currentData.properties.description_de,
			description_en: currentData.properties.description_en,
			meta: {
				lang: 'de',
				title: currentData.properties.name,
				description_de: currentData.properties.description_de,
				description: currentData.properties.description_de,
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
