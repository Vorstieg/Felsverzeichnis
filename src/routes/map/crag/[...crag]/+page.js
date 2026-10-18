import { error } from '@sveltejs/kit';
import { fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';
import { getGeometryCenter } from '$lib/assets/js/topo-loader-utils.js';
import { createEntryLoader } from '$lib/assets/js/entry-loader';

/** @satisfies {import('./$types').PageLoad} */
export const load = async ({ params, url, parent, fetch }) => {
	try {
		const parentData = await parent();

		const loader = createEntryLoader({ apiUrl: fsApiUrl, fetch, useCache: browser });
		const context = await loader.resolve(params.crag, parentData.allLocations);
		if (!context) error(404, 'Entry not found');
		const currentData = context.location.entry;
		const currentLocation = context.paths;
		const cragData = currentData;
		const sectors = context.children;
		const loaded = await loader.core(context);
		const { access: accessData, topo: topoDocument } = loaded;
		const enrichTopoPaths = (
			/** @type {import('@vorstieg/fels-types/types').FelsTopoDocument | null | undefined} */ doc
		) => {
			const pathRoles = new Map(
				(doc?.routes || []).flatMap((route) =>
					(route.pathRefs || []).map((reference) => [
						reference.pathId,
						{
							...reference,
							routeType: route.type
						}
					])
				)
			);
			return (doc?.paths?.features || []).map((feature) => {
				const reference = feature.id === undefined ? undefined : pathRoles.get(feature.id);
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
		};

		const topoPaths = enrichTopoPaths(topoDocument);

		const streamDetails = async () => {
			const details = await loader.details(context, loaded);
			if (browser) void loader.cacheFolder(context.location.path);
			const transit = details.access?.features.find(
				(feature) => feature.properties.kind === 'transit'
			);
			const parking = details.access?.features.find(
				(feature) => feature.properties.kind === 'parking'
			);
			const sectorTopoPaths = details.sectorTopos.flatMap((sector) => enrichTopoPaths(sector.topo));
			return {
				...details,
				topoPaths: topoPaths.length ? topoPaths : sectorTopoPaths,
				transit: transit?.geometry.type === 'Point' ? transit.geometry.coordinates : undefined,
				parking: parking?.geometry.type === 'Point' ? parking.geometry.coordinates : undefined
			};
		};

		return {
			currentLocation: currentLocation,
			currentData: currentData,
			parentEntry: context.ancestors[0] ?? null,
			cragData: cragData,
			sectors,
			cragPathUrl: context.location.path,
			locations: parentData.allLocations,
			access: accessData,
			topoPaths,
			cameraTarget: (() => {
				const center = getGeometryCenter(currentData.geometry);
				return center ? { type: /** @type {const} */ ('center'), center, zoom: 16 } : null;
			})(),
			name: currentData.properties.name,
			description_de: currentData.properties.description_de,
			description_en: currentData.properties.description_en,
			meta: {
				lang: 'de',
				title: currentData.properties.name,
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
		error(404, { message: err instanceof Error ? err.message : 'Not found' });
	}
};
