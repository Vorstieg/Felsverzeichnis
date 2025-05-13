import fetchCrags from '$lib/assets/js/fetchCrags.js';

export const load = async () => {
	// TODO: reimplement pagination if performance issues arise
	const crags = await fetchCrags();
	return { crags };
};
