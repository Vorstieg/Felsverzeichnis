import { error } from '@sveltejs/kit';

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
