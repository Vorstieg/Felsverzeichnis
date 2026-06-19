import { cragsPerPage } from '$lib/config';

const fetchCrags = async ({ offset = 0, limit = cragsPerPage, search = '' } = {}) => {
	const API_URL = 'http://felslager.vorstieg.eu/api/fs';
	
	const indexRes = await fetch(`${API_URL}/?recursive=true`);
	if (!indexRes.ok) throw new Error('Failed to fetch crag index from API');
	const allFiles = await indexRes.json();

	const targetFiles = allFiles.filter(f => {
		if (f.type !== 'file') return false;
		if (!f.path.endsWith('.json')) return false;
		if (f.path.includes('-transit')) return false;
		if (f.path.includes('-parking')) return false;
		if (f.path.includes('-topo')) return false;
		return true;
	});

	const crags = await Promise.all(
		targetFiles.map(async (file) => {
			const res = await fetch(`${API_URL}/${file.path}`);
			const data = await res.json();
			
			const cragPath = file.path.split('/').slice(0, -1).join('/');
			data.properties.path = cragPath;
			
			const imageExts = ['.jpg', '.jpeg', '.png', '.gif'];
			const previewFile = allFiles.find(f => 
				f.type === 'file' && 
				f.path.startsWith(cragPath + '/') && 
				imageExts.some(ext => f.name.toLowerCase().endsWith(ext))
			);
			
			if (previewFile) {
				data.properties.previewImage = `${API_URL}/${previewFile.path}`;
			}
			
			return data;
		})
	);

	let sortedCrags = crags.sort((a, b) => new Date(b.properties.date) - new Date(a.properties.date));

	if (search) {
		sortedCrags = sortedCrags.filter(
			(crag) =>
				crag.properties.name.toLowerCase().includes(search.toLowerCase()) ||
				crag.properties.type.includes(search) ||
				crag.properties.path.toLowerCase().includes(search.toLowerCase())
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
