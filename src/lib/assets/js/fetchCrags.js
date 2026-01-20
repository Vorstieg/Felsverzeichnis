import { cragsPerPage } from '$lib/config';

const fetchCrags = async ({ offset = 0, limit = cragsPerPage, search = '' } = {}) => {
	const topoFiles = import.meta.glob('/src/entries/**/*-topo.json', { query: '?url', import: 'default' });
	const glbFiles = import.meta.glob('/src/entries/**/*.glb', { query: '?url', import: 'default' });

	const crags = await Promise.all(
		Object.entries(
			import.meta.glob([
				'/src/entries/**/*.json',
				'!/src/entries/**/*-transit*.json',
				'!/src/entries/**/*-parking*.json',
				'!/src/entries/**/*-topo*.json'
			])
		).map(async ([path, resolver]) => {
			const data = (await resolver()).default;
			data.properties.path = path.split('/').slice(3, -1).join('/');

			const topoPath = path.replace('.json', '-topo.json');
			data.properties.hasTopo = !!topoFiles[topoPath];

			const glbPath = path.replace('.json', '.glb');
			data.properties.has3DTopo = !!glbFiles[glbPath];
			return data;
		})
	);

	let sortedCrags = crags.sort((a, b) => new Date(b.properties.date) - new Date(a.properties.date));

	if (search) {
		sortedCrags = sortedCrags.filter(
			(crag) =>
				crag.properties.name.toLowerCase().includes(search.toLowerCase()) || crag.properties.type.includes(search) || crag.properties.path.toLowerCase().includes(search.toLowerCase())
		);
	}

	if (offset) {
		sortedCrags = sortedCrags.slice(offset);
	}

	if (limit && limit < sortedCrags.length && limit !== -1) {
		sortedCrags = sortedCrags.slice(0, limit);
	}

	return sortedCrags;
};

export default fetchCrags;
