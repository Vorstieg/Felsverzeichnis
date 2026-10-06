import fetchCrags from '$lib/assets/js/fetchCrags';
import {
	createLocationsCameraTarget,
	getBoundsCenter,
	getGeometryBounds
} from '$lib/assets/js/map-camera.js';

import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

/** @satisfies {import('./$types').PageLoad} */
export const load = async ({ params, fetch }) => {
	let search = params.search;
	const options = { search, limit: -1, fetch };
	const locations = await fetchCrags(options);
	const entry = locations.find((location) => location.path === search);
	if (entry) {
		throw redirect(302, `${base}/map/crag/${entry.path}`);
	}

	if (locations.length === 1) {
		const center = getBoundsCenter(getGeometryBounds(locations[0].entry.geometry));
		const hash = center ? `#16/${center[1]}/${center[0]}` : '';
		throw redirect(302, `${base}/map/crag/${locations[0].path}${hash}`);
	}

	return {
		locations,
		search,
		cameraTarget: createLocationsCameraTarget(locations)
	};
};
