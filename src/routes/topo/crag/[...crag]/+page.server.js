import { error } from '@sveltejs/kit';
import fetchCrags from '$lib/assets/js/fetchCrags';

export const load = async ({ params, url }) => {
	try {
		const crags = await fetchCrags({ limit: -1 });

		let topo;
		let route;
		let path;

		const API_URL = 'http://127.0.0.1:3001/api/fs';
		const fetchJson = async (p) => {
			try {
				const res = await fetch(`${API_URL}/${p}`);
				if (res.ok) return await res.json();
				return null;
			} catch (e) {
				return null;
			}
		};

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

		const pojo = (obj) => (obj ? JSON.parse(JSON.stringify(obj)) : obj);

		if (!topo) {
			error(404, `Crag or route not found: ${params.crag}`);
		}

		// Check if a .glb model exists
		let has3D = false;
		let modelUrl = null;
		try {
			const dirRes = await fetch(`${API_URL}/${path}`);
			if (dirRes.ok) {
				const files = await dirRes.json();
				const glbFileName = `${path.split('/').at(-1)}.glb`;
				if (files.some(f => f.name === glbFileName)) {
					has3D = true;
					modelUrl = `${API_URL}/${path}/${glbFileName}`;
				}
			}
		} catch (e) {
			// Ignore
		}

		return {
			path,
			topo: pojo(topo),
			route: pojo(route),
			has3D,
			modelUrl,
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
		error(404, err);
	}
};
