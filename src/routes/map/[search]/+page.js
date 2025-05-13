import fetchCrags from '$lib/assets/js/fetchCrags.js';

export const load = async ({ params }) => {
	let search = params.search;
	const options = { search, limit: -1 };
	const locations = await fetchCrags(options);

	return { locations, search, zoomToLocations: true };
};
