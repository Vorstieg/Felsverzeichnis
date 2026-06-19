import { error } from '@sveltejs/kit';

export const load = async ({ params, url }) => {
	try {
		let transit, transitTrack, parking;
		let has3DTopo = false;

		const API_URL = 'http://felslager.vorstieg.eu/api/fs';
		const fetchJson = async (path) => {
			try {
				const res = await fetch(`${API_URL}/${path}`);
				if (res.ok) return await res.json();
				return null;
			} catch (e) {
				return null;
			}
		};

		const cragName = params.crag.split('/').at(-1);
		const crag = await fetchJson(`${params.crag}/${cragName}.json`);
		
		if (!crag) {
			throw new Error(`Crag data not found at ${params.crag}`);
		}

		// Fetch directory listing to find images
		let images = [];
		try {
			const dirRes = await fetch(`${API_URL}/${params.crag}`);
			if (dirRes.ok) {
				const files = await dirRes.json();
				const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
				images = files
					.filter(f => f.type === 'file' && imageExts.some(ext => f.name.toLowerCase().endsWith(ext)))
					.map(f => `${API_URL}/${params.crag}/${f.name}`);
			}
		} catch (e) {
			// Ignore
		}

		transit = await fetchJson(`${params.crag}/${cragName}-transit.json`);
		transitTrack = await fetchJson(`${params.crag}/${cragName}-transit-track.json`);
		parking = await fetchJson(`${params.crag}/${cragName}-parking.json`);
		
		let topoJson = await fetchJson(`${params.crag}/${cragName}-topo.json`);
		if (topoJson) {
			has3DTopo = true;
		}

		return {
			path: params.crag,
			zoom: 16,
			locations: [crag, transit, parking].filter(Boolean),
			transit: transit?.geometry?.coordinates,
			parking: parking?.geometry?.coordinates,
			tracks: [transitTrack].filter(Boolean),
			center: crag.geometry.coordinates,
			name: crag.properties.name,
			topo: crag.properties.topo,
			topoJson,
			images,
			description_de: crag.properties.description_de,
			description_en: crag.properties.description_en,
			type: crag.properties.type,
			detailsShown: true,
			zoomToLocations: true,
			has3DTopo,
			meta: {
				lang: 'de',
				title: crag.properties.name + ' - Felsverzeichnis',
				description: crag.properties.description_de || '',
				type: 'article',
				author: 'Vorstieg Software FlexCo',
				url: url.href
			}
		};
	} catch (err) {
		error(404, err);
	}
};
