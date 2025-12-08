import { error } from '@sveltejs/kit';

export const entries = async () => {
	const jsonFiles = import.meta.glob('/src/entries/**/*.json');
	const entriesList = [];

	for (const path in jsonFiles) {
		if (path.endsWith('-topo.json')) {
			// Extract the crag path relative to /src/entries/ and remove filename
			// e.g., /src/entries/europe/austria/wachau/nasenwand/nasenwand-topo.json -> europe/austria/wachau/nasenwand
			const parts = path.split('/');
			const dirPath = parts.slice(3, -1).join('/'); // slice(3) skips empty, src, entries
			
			// Add the main topo page
			entriesList.push({ crag: dirPath });

			try {
				const module = await jsonFiles[path]();
				const topo = module.default;
				
				// Add pages for individual routes if they exist
				if (topo && topo.routes) {
					for (const route of topo.routes) {
						entriesList.push({ crag: `${dirPath}/${route.id}` });
					}
				}
			} catch (e) {
				console.error(`Error loading topo for entries generation: ${path}`, e);
			}
		}
	}

	return entriesList;
};

export const load = async ({ params, url }) => {
	try {
		let topo
		let route
		let path

		const jsonFiles = import.meta.glob('/src/entries/**/*.json');

		if (jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-topo.json`]) {
			topo = (await jsonFiles[`/src/entries/${params.crag}/${params.crag.split('/').at(-1)}-topo.json`]()).default;
			path = params.crag;
		}
		else if (jsonFiles[`/src/entries/${params.crag.split('/').slice(0, -1).join("/")}/${params.crag.split('/').at(-2)}-topo.json`]){
			 topo = (await jsonFiles[`/src/entries/${params.crag.split('/').slice(0, -1).join("/")}/${params.crag.split('/').at(-2)}-topo.json`]()).default;
			 route = topo.routes.find((it) => it.id ===  params.crag.split('/').at(-1));
			 path = params.crag.split('/').slice(0, -1).join("/");
		}
		return {
			path,
			topo,
			route,
			meta: {
				lang: 'de',
				title: topo.name + ' - Felsverzeichnis',
				description: topo.description,
				type: 'article',
				author: topo.author,
				url: url.href
			}
		};
	} catch (err) {
		error(404, err);
	}
};
