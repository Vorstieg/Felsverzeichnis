import fetchCrags from '$lib/assets/js/fetchCrags';

/** @satisfies {import('./$types').LayoutLoad} */
export const load = async ({ fetch }) => {
	const locations = await fetchCrags({ limit: -1, fetch });
	return { locations, allLocations: locations };
};
