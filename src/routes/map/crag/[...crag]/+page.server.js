import { error } from '@sveltejs/kit';

export const load = async ({ params, url }) => {
	try {
		let transit, transitTrack, parking;
		let has3DTopo = false;

		const jsonFiles = import.meta.glob('/src/entries/**/*.json');
		const crag = (await jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}.json`]()).default;

		if (jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-transit.json`])
			 transit = (await jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-transit.json`]()).default;
		if (jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-transit-track.json`])
			 transitTrack = (await jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-transit-track.json`]()).default;
		if (jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-parking.json`])
			 parking = (await jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-parking.json`]()).default;
		
		let topoJson;
		if (jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-topo.json`]) {
			has3DTopo = true;
			topoJson = (await jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-topo.json`]()).default;
		}

		return {
			path: params.crag,
			zoom: 16,
			locations: [crag, transit, parking].filter( Boolean ),
			transit: transit?.geometry?.coordinates,
			parking: parking?.geometry?.coordinates,
			tracks: [transitTrack].filter( Boolean ),
			center: crag.geometry.coordinates,
			name: crag.properties.name,
			topo: crag.properties.topo,
			topoJson,
			description: crag.properties.description,
			type: crag.properties.type,
			detailsShown: true,
			zoomToLocations: true,
			has3DTopo,
			meta: {
				lang: 'de',
				title: crag.properties.name + ' - Felsverzeichnis',
				description: crag.properties.description,
				type: 'article',
				author: 'Vorstieg Software FlexCo',
				url: url.href
			}
		};
	} catch (err) {
		error(404, err);
	}
};
