import { cragsPerPage } from '$lib/config';
import { browser } from '$app/environment';

const fetchCrags = async ({ offset = 0, limit = cragsPerPage, search = '' } = {}) => {
	const API_URL = browser ? 'https://felslager.vorstieg.eu/api/fs' : 'http://127.0.0.1:3001/api/fs';
	
	if (!browser) {
		console.log('[fetchCrags] BYPASSING FETCH ON SERVER FOR DEBUGGING');
		return [];
	}

	console.log(`[fetchCrags] SSR: ${!browser}, fetching index from ${API_URL}/?recursive=true`);
	const indexRes = await fetch(`${API_URL}/?recursive=true`);
	console.log(`[fetchCrags] Index fetched, status: ${indexRes.status}`);
	if (!indexRes.ok) throw new Error('Failed to fetch crag index from API');
	const allFiles = await indexRes.json();
	console.log(`[fetchCrags] Index parsed, ${allFiles.length} files found`);

	const targetFiles = allFiles.filter(f => {
		if (f.type !== 'file') return false;
		if (!f.path.endsWith('.json')) return false;
		if (f.path.includes('-transit')) return false;
		if (f.path.includes('-parking')) return false;
		if (f.path.includes('-topo')) return false;
		return true;
	});

	const crags = [];
	const BATCH_SIZE = 10;
	for (let i = 0; i < targetFiles.length; i += BATCH_SIZE) {
		const batch = targetFiles.slice(i, i + BATCH_SIZE);
		console.log(`[fetchCrags] Processing batch ${i/BATCH_SIZE + 1}, sizes: ${batch.length}`);
		const batchResults = await Promise.all(
			batch.map(async (file) => {
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
		crags.push(...batchResults);
	}

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
