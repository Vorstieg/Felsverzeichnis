import fetchCrags from '$lib/assets/js/fetchCrags.js';
import { createLocationsCameraTarget } from '$lib/assets/js/map-camera.js';

import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const load = async ({ params }) => {
	let search = params.search;
	const options = { search, limit: -1 };
	const locations = await fetchCrags(options);

	if (locations.length === 1) {
		throw redirect(302, `${base}/map/crag/${locations[0].properties.path}`);
	}

	return {
		locations,
		search,
		cameraTarget: createLocationsCameraTarget(locations, `search:${search}`),
	};
};
