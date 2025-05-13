import fetchCrags from '$lib/assets/js/fetchCrags.js';

export const load = async ({ params }) => {
	const search = params.search;
	const options = { search, limit: -1 };
	const crags = await fetchCrags(options);

	return { crags, search };
};
