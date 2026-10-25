import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import fetchCrags from '$lib/assets/js/fetchCrags';
import {
	createLocationsCameraTarget,
	getBoundsCenter,
	getGeometryBounds
} from '$lib/assets/js/map-camera.js';
import {
	searchCatalog,
	interpretSearchTerm,
	filtersFromParams,
	countActiveFilters,
	entryHitToLocation
} from '$lib/search/catalog-search';

/** @satisfies {import('./$types').PageLoad} */
export const load = async ({ params, url, fetch, parent }) => {
	const rawSearch = decodeURIComponent(params.search || '');
	const { allLocations = [] } = (typeof parent === 'function' ? await parent() : null) ?? {};
	const locationsPool =
		allLocations.length > 0 ? allLocations : await fetchCrags({ limit: -1, fetch });

	// Exact path match redirects directly to the crag
	const exactEntry = locationsPool.find((location) => location.path === rawSearch);
	if (exactEntry) {
		throw redirect(302, `${base}/map/crag/${exactEntry.path}`);
	}

	const searchParams = url?.searchParams ?? new URLSearchParams();
	const urlFilters = filtersFromParams(searchParams);
	const { q, filters } = interpretSearchTerm(rawSearch, urlFilters);

	const searchResult = await searchCatalog({
		q,
		filters,
		entryLimit: 100,
		routeLimit: 100,
		fetch,
		timeoutMs: 3000
	});

	const matchingLocations = searchResult.entries.map((entry) =>
		entryHitToLocation(entry, locationsPool)
	);

	// If exactly one crag matches and no routes or query refinement filters are active, jump directly to that crag
	if (
		matchingLocations.length === 1 &&
		searchResult.routes.length === 0 &&
		countActiveFilters(urlFilters) === 0
	) {
		const isAreaOrRegion = ['area', 'region', 'country'].includes(
			matchingLocations[0].entry.properties?.kind ?? ''
		);
		const center = getBoundsCenter(getGeometryBounds(matchingLocations[0].entry.geometry));
		const hash = center && !isAreaOrRegion ? `#16/${center[1]}/${center[0]}` : '';
		throw redirect(302, `${base}/map/crag/${matchingLocations[0].path}${hash}`);
	}

	const cameraLocations =
		matchingLocations.length > 0
			? matchingLocations
			: searchResult.routes.flatMap((route) => {
					const loc = locationsPool.find((l) => l.path === route.path);
					return loc ? [loc] : [];
				});

	return {
		locations: matchingLocations,
		search: rawSearch,
		cameraTarget: createLocationsCameraTarget(cameraLocations),
		routes: searchResult.routes,
		filters,
		urlFilters,
		query: q,
		entryTotal: searchResult.entryTotal,
		routeTotal: searchResult.routeTotal
	};
};
