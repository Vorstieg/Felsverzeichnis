import fetchCrags from '$lib/assets/js/fetchCrags.js';

import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const load = async ({ params }) => {
	const search = params.search;
	const options = { search, limit: -1 };
	const crags = await fetchCrags(options);

	if (crags.length === 1) {
		throw redirect(302, `${base}/map/crag/${crags[0].properties.path}`);
	}

	return { crags, search };
};
