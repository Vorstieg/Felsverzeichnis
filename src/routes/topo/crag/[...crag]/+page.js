import { error } from '@sveltejs/kit';
import { fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';
import { findRouteOrChild } from '$lib/assets/js/topo-loader-utils.js';
import { createEntryLoader } from '$lib/assets/js/entry-loader';
import fetchCrags from '$lib/assets/js/fetchCrags';

/** @satisfies {import('./$types').PageLoad} */
export const load = async ({ params, url, fetch }) => {
	const loader = createEntryLoader({ apiUrl: fsApiUrl, fetch, useCache: browser });
	let context = await loader.resolve(params.crag, [], true);
	if (!context) {
		try {
			const locations = await fetchCrags({ limit: -1, fetch });
			context = await loader.resolve(params.crag, locations, true);
		} catch {
			// An unavailable index must still produce the entry-not-found response.
		}
	}
	if (!context) error(404, 'Entry not found');
	const location = context.location;
	const path = location.path;
	const sectors = context.children;
	const details = await loader.details(context);
	const topo = details.topoJson;
	if (!topo) error(404, `Topo not found: ${path}`);
	const routeId = context.routeId;
	const route = routeId === null ? null : findRouteOrChild(topo.routes, routeId);
	if (routeId !== null && !route) error(404, `Route not found: ${routeId}`);
	const { sectorTopos, gradeRoutes, access } = details;
	const files = context.directory;
	const fileName = context.paths.getGlbName();
	const has3D = details.has3DTopo;
	const lowResName = fileName.replace('.glb', '-low.glb');
	if (browser) void loader.cacheContext(context);
	const properties = location.entry.properties;
	const climbingTypes =
		context.ancestors.find((ancestor) => ancestor.entry.properties.type?.length)?.entry.properties
			.type ??
		properties.type ??
		[];
	return {
		path,
		access,
		sectors,
		sectorTopos,
		topo,
		gradeRoutes,
		route,
		has3D,
		modelUrl: has3D ? `${fsApiUrl}/${path}/${fileName}` : null,
		lowResModelUrl:
			has3D && files.some((file) => file.name === lowResName)
				? `${fsApiUrl}/${path}/${lowResName}`
				: null,
		climbingTypes,
		rockType: location.entry.properties.rock_type,
		name: properties.name,
		description_de: properties.description_de,
		description_en: properties.description_en,
		meta: {
			lang: 'de',
			title: `${properties.name} - Felsverzeichnis`,
			description: topo.description ?? properties.description_de,
			type: 'article',
			author: topo.author,
			url: url.href
		}
	};
};
