import fetchCrags from '$lib/assets/js/fetchCrags.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async () => {
	const locations = await fetchCrags();
	return { locations };
};
