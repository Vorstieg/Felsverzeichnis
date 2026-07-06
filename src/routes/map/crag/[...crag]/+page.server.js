import { error } from '@sveltejs/kit';
import fetchCrags from '$lib/assets/js/fetchCrags';
import { fsApiUrl } from '$lib/config';

export async function load({ params, url }) {
	try {
		const crags = await fetchCrags({ limit: -1 });

		let transit, transitTrack, parking;
		let has3DTopo = false;

		const API_URL = fsApiUrl;
		const fetchJson = async (path) => {
			try {
				const res = await fetch(`${API_URL}/${path}`);
				if (res.ok) return await res.json();
				return null;
			} catch (e) {
				return null;
			}
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
		const isSectorPath = Boolean(
			relativeParts[0] &&
				matchingCrag?.properties?.sectors?.some((sector) => sector.id === relativeParts[0])
		);
		let crag,
			sectorData = null;
		let basePath = matchingCrag?.properties?.path || params.crag;
		let sectorId = isSectorPath ? relativeParts[0] : null;
		const cragName = basePath.split('/').at(-1);

		if (isSectorPath) {
			crag = await fetchJson(`${basePath}/${cragName}.json`);

			if (crag) {
				sectorData = normalizeSectorData(
					await fetchJson(`${basePath}/${sectorId}/${sectorId}.json`)
				);
			}
		} else {
			crag = await fetchJson(`${params.crag}/${cragName}.json`);
		}

		if (!crag) {
			throw new Error(`Crag data not found at ${params.crag}`);
		}

		const indexedCrag = crags.find((it) => it.properties?.path === basePath);
		const cragForUi = indexedCrag || crag;

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
			tracks: [],
			center:
				getGeometryCenter(isSectorPath ? sectorData?.geometry : crag.geometry) ||
				crag.geometry.coordinates,
			cameraTarget:
				isSectorPath && getGeometryCenter(sectorData?.geometry)
					? { center: getGeometryCenter(sectorData.geometry), zoom: 18 }
					: null,
			name:
				isSectorPath && sectorData?.name
					? `${crag.properties.name} - ${sectorData.name}`
					: crag.properties.name,
			topo: isSectorPath && sectorData?.topo ? sectorData.topo : crag.properties.topo,
			description_de:
				isSectorPath && sectorData?.description_de
					? sectorData.description_de
					: crag.properties.description_de,
			description_en:
				isSectorPath && sectorData?.description_en
					? sectorData.description_en
					: crag.properties.description_en,
			type: isSectorPath && sectorData?.type ? sectorData.type : crag.properties.type,
			sector: normalizeSectorData(sectorData),
			detailsShown: true,
			zoomToLocations: true,
			meta: {
				lang: 'de',
				title:
					(isSectorPath && sectorData?.name
						? `${crag.properties.name} - ${sectorData.name}`
						: crag.properties.name) + ' - Felsverzeichnis',
				description:
					(isSectorPath && sectorData?.description_de
						? sectorData.description_de
						: crag.properties.description_de) || '',
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
