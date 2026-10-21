import { error } from '@sveltejs/kit';
import { fsApiUrl } from '$lib/config';
import { browser } from '$app/environment';
import { findRouteOrChild, getGeometryCenter, getParentRoute } from '$lib/assets/js/topo-loader-utils.js';
import { getPreferredClimbingType } from '$lib/assets/js/climbing-map-utils.js';
import { getGeometryBounds } from '$lib/assets/js/map-camera.js';
import { createEntryLoader } from '$lib/assets/js/entry-loader';
import fetchCrags from '$lib/assets/js/fetchCrags';

/** @satisfies {import('./$types').PageLoad} */
export const load = async ({ params, url, parent, fetch }) => {
	try {
		const parentData = await parent();
		let allLocations = parentData.allLocations || parentData.locations || [];

		const loader = createEntryLoader({ apiUrl: fsApiUrl, fetch, useCache: browser });
		let context = await loader.resolve(params.crag, allLocations, true);
		if (!context && allLocations.length === 0) {
			try {
				allLocations = await fetchCrags({ limit: -1, fetch });
				context = await loader.resolve(params.crag, allLocations, true);
			} catch {
				// An unavailable index must still produce the entry-not-found response.
			}
		}
		if (!context) error(404, 'Entry not found');

		const currentData = context.location.entry;
		const currentLocation = context.paths;
		const cragData = currentData;
		const sectors = context.children;
		const loaded = await loader.core(context);
		const { access: accessData, topo: topoDocument } = loaded;

		const routeId = context.routeId;
		let activeTopoDocument = topoDocument;
		let routeSector = null;
		let detailsData = null;

		let route =
			routeId === null
				? null
				: topoDocument?.routes
					? findRouteOrChild(topoDocument.routes, routeId)
					: null;

		if (routeId !== null && !route) {
			detailsData = await loader.details(context, loaded);
			for (const sector of detailsData.sectorTopos) {
				if (sector.topo?.routes) {
					const found = findRouteOrChild(sector.topo.routes, routeId);
					if (found) {
						route = found;
						activeTopoDocument = sector.topo;
						routeSector = sector;
						break;
					}
				}
			}
		}

		if (routeId !== null && !route) {
			error(404, `Route not found: ${routeId}`);
		}

		if (route && route.parentId && activeTopoDocument?.routes) {
			const currentRoute = route;
			const parentRoute = activeTopoDocument.routes.find((r) => r.id === currentRoute.parentId);
			if (parentRoute && parentRoute.orientation3D && !currentRoute.orientation3D) {
				route = { ...currentRoute, orientation3D: parentRoute.orientation3D };
			}
		}

		const sectorLocation = routeSector
			? sectors.find((s) => s.entry.properties.id === routeSector.sectorId)
			: null;
		const routeCragPath = sectorLocation ? sectorLocation.path : context.location.path;
		const activeLocationEntry = sectorLocation?.entry ?? currentData;

		const enrichTopoPaths = (
			/** @type {import('@vorstieg/fels-types/types').FelsTopoDocument | null | undefined} */ doc,
			sectorPath = ''
		) => {
			const pathRoles = new Map();
			for (const route of doc?.routes || []) {
				for (const reference of route.pathRefs || []) {
					if (!pathRoles.has(reference.pathId) || reference.role === 'main') {
						pathRoles.set(reference.pathId, {
							...reference,
							routeId: route.id,
							routeType: getPreferredClimbingType(route.type),
							targetPath: sectorPath || routeCragPath
						});
					}
				}
			}
			return (doc?.paths?.features || []).map((feature) => {
				const reference = feature.id === undefined ? undefined : pathRoles.get(feature.id);
				const matchingRoute =
					!reference && feature.id !== undefined
						? (doc?.routes || []).find((r) => r.id === feature.id)
						: undefined;
				return {
					...feature,
					properties: {
						...(feature.properties || {}),
						role: reference?.role || feature.properties?.role || 'main',
						routeType:
							reference?.routeType ||
							(matchingRoute ? getPreferredClimbingType(matchingRoute.type) : '') ||
							feature.properties?.routeType ||
							'',
						label:
							reference?.label ||
							feature.properties?.label ||
							feature.properties?.name ||
							matchingRoute?.name ||
							'',
						routeId: reference?.routeId || matchingRoute?.id || feature.properties?.routeId || '',
						targetPath:
							reference?.targetPath ||
							sectorPath ||
							feature.properties?.targetPath ||
							routeCragPath
					}
				};
			});
		};

		const filterPathsForView = (
			/** @type {import('@vorstieg/fels-types/types').PathFeature[]} */ paths,
			/** @type {import('@vorstieg/fels-types/types').Route | null | undefined} */ targetRoute,
			/** @type {import('@vorstieg/fels-types/types').FelsTopoDocument | null | undefined} */ doc
		) => {
			if (!targetRoute) {
				// Only see the main gpx track when in the overlaying crag
				return paths.filter((feature) => feature.properties?.role === 'main');
			}
			// In detail view: show approach, variant, descent, main etc. for this route
			const effectiveRoute = getParentRoute(doc?.routes, targetRoute.id) || targetRoute;
			if (effectiveRoute) {
				const refPathIds = new Set((effectiveRoute.pathRefs || []).map((ref) => ref.pathId));
				const routePaths = paths.filter(
					(feature) =>
						(feature.id !== undefined && refPathIds.has(feature.id)) ||
						feature.properties?.routeId === effectiveRoute.id ||
						feature.id === effectiveRoute.id
				);
				if (routePaths.length) return routePaths;
			}
			return paths;
		};

		const allTopoPaths = enrichTopoPaths(activeTopoDocument || topoDocument, routeCragPath);
		const topoPaths = filterPathsForView(allTopoPaths, route, activeTopoDocument || topoDocument);

		const streamDetails = async () => {
			const details = detailsData ?? (await loader.details(context, loaded));
			if (browser) void loader.cacheFolder(context.location.path);
			const transit = details.access?.features.find(
				(feature) => feature.properties.kind === 'transit'
			);
			const parking = details.access?.features.find(
				(feature) => feature.properties.kind === 'parking'
			);
			const activeDoc = activeTopoDocument ?? details.topoJson;
			const sectorTopoPaths = details.sectorTopos.flatMap((sector) => {
				const sLocation = sectors.find((s) => s.entry.properties.id === sector.sectorId);
				const sPath = sLocation ? sLocation.path : context.location.path;
				return enrichTopoPaths(sector.topo, sPath);
			});
			const combinedPaths = [...allTopoPaths];
			const seenIds = new Set(allTopoPaths.map((p) => p.id).filter((id) => id !== undefined));
			for (const p of sectorTopoPaths) {
				if (p.id === undefined || !seenIds.has(p.id)) {
					combinedPaths.push(p);
					if (p.id !== undefined) seenIds.add(p.id);
				}
			}
			const filteredStreamPaths = filterPathsForView(combinedPaths, route, activeDoc);
			return {
				...details,
				topoJson: activeDoc,
				has3DTopo: routeSector ? routeSector.has3DTopo : details.has3DTopo,
				has2DTopo: routeSector ? routeSector.has2DTopo : details.has2DTopo,
				topoPaths: filteredStreamPaths,
				transit: transit?.geometry.type === 'Point' ? transit.geometry.coordinates : undefined,
				parking: parking?.geometry.type === 'Point' ? parking.geometry.coordinates : undefined
			};
		};

		const rockType =
			activeLocationEntry.properties?.rock_type ||
			currentData.properties?.rock_type ||
			context.ancestors.find((a) => a.entry.properties?.rock_type)?.entry.properties?.rock_type;

		return {
			currentLocation: currentLocation,
			currentData: currentData,
			parentEntry: context.ancestors[0] ?? null,
			cragData: cragData,
			sectors,
			cragPathUrl: routeCragPath,
			locations: allLocations,
			access: accessData,
			topoPaths,
			topo: activeTopoDocument,
			route,
			routeId,
			routeSector,
			rockType,
			cameraTarget: (() => {
				if (currentData.properties?.kind === 'area' && currentData.geometry?.type !== 'Point') {
					const bounds = getGeometryBounds(currentData.geometry);
					if (bounds)
						return { type: /** @type {const} */ ('bounds'), bounds, padding: 80, maxZoom: 14 };
				}
				const center =
					getGeometryCenter(activeLocationEntry.geometry) || getGeometryCenter(currentData.geometry);
				return center ? { type: /** @type {const} */ ('center'), center, zoom: 16 } : null;
			})(),
			name: activeLocationEntry.properties?.name || currentData.properties?.name,
			description_de: currentData.properties?.description_de,
			description_en: currentData.properties?.description_en,
			meta: {
				lang: 'de',
				title: route
					? `${route.name || route.id} - ${activeLocationEntry.properties?.name || currentData.properties?.name}`
					: currentData.properties?.name,
				description: route?.description || currentData.properties?.description_de,
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
