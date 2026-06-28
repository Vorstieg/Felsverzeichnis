import { error } from '@sveltejs/kit';
import fetchCrags from '$lib/assets/js/fetchCrags';
import { fsApiUrl } from '$lib/config';

export const load = async ({ params, url }) => {
	try {
		const crags = await fetchCrags({ limit: -1 });

		let topo;
		let route;
		let path;

		const API_URL = fsApiUrl;
		const fetchJson = async (p) => {
			try {
				const res = await fetch(`${API_URL}/${p}`);
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
						sectorName: sector.name
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
		let sectorData = null;
		let baseCragPath = isSectorPath ? matchingCrag.properties.path : null;
		let sectorPath = null;
		let sectorId = isSectorPath ? relativeParts[0] : null;
		if (isSectorPath) {
			const routeId = relativeParts[1];
			sectorPath = `${baseCragPath}/${sectorId}`;

			topo = await fetchJson(`${sectorPath}/${sectorId}-topo.json`);
			if (!topo) {
				const baseCragName = baseCragPath.split('/').at(-1);
				topo = await fetchJson(`${baseCragPath}/${baseCragName}-topo.json`);
			}

			sectorData = normalizeSectorData(await fetchJson(`${sectorPath}/${sectorId}.json`));

			if (topo && routeId) {
				route = topo.routes?.find((it) => it.id === routeId);
			}

			if (topo) {
				path = sectorPath;
			}
		} else {
			const cragName1 = params.crag.split('/').at(-1);
			topo = await fetchJson(`${params.crag}/${cragName1}-topo.json`);

			if (topo) {
				path = params.crag;
			} else {
				const parentPath = params.crag.split('/').slice(0, -1).join('/');
				if (parentPath) {
					const cragName2 = params.crag.split('/').at(-2);
					topo = await fetchJson(`${parentPath}/${cragName2}-topo.json`);
					if (topo) {
						route = topo.routes?.find((it) => it.id === cragName1);
						path = parentPath;
					}
				}
			}
		}

		const pojo = (obj) => (obj ? JSON.parse(JSON.stringify(obj)) : obj);

		if (!topo) {
			error(404, { message: `Crag or route not found: ${params.crag}` });
		}

		const indexedCrag = crags.find((it) => it.properties?.path === (baseCragPath || path));
		if (!sectorData && sectorId) {
			sectorData = normalizeSectorData(
				indexedCrag?.properties?.sectors?.find((sector) => sector.id === sectorId)
			);
		}
		let gradeRoutes = topo?.routes || [];
		if (!isSectorPath) {
			const sectorRoutes = await aggregateSectorRoutes(
				path,
				indexedCrag?.properties?.sectors || []
			);
			if (sectorRoutes.length > 0) {
				gradeRoutes = sectorRoutes;
			}
		}

		// Check if a .glb model exists
		let has3D = false;
		let modelUrl = null;

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
						break;
					}
				}
			}
		} catch (e) {
			// Ignore
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
			route: pojo(route),
			has3D,
			modelUrl,
			cragName: indexedCrag?.properties?.name,
			name: topo?.name,
			description_de: topo?.description_de,
			description_en: topo?.description_en,
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
