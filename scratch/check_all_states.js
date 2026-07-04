import dns from 'dns';
import fs from 'fs';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');

const ENTRIES_DIR = './src/entries';

function getImportedCount(stateSlug) {
	const stateDir = path.join(ENTRIES_DIR, 'europe', 'austria', stateSlug);
	if (!fs.existsSync(stateDir)) return 0;
	
	let count = 0;
	function crawl(dir) {
		const files = fs.readdirSync(dir);
		for (const file of files) {
			const full = path.join(dir, file);
			if (fs.statSync(full).isDirectory()) {
				crawl(full);
			} else if (
				file.endsWith('.json') &&
				!file.includes('-transit') &&
				!file.includes('-parking') &&
				!file.includes('-topo')
			) {
				count++;
			}
		}
	}
	crawl(stateDir);
	return count;
}

const states = [
	{ name: 'Burgenland', area: 'Burgenland', slug: 'burgenland' },
	{ name: 'Carinthia', area: 'Kärnten', slug: 'carinthia' },
	{ name: 'Lower Austria', area: 'Niederösterreich', slug: 'lower-austria' },
	{ name: 'Upper Austria', area: 'Oberösterreich', slug: 'upper-austria' },
	{ name: 'Salzburg', area: 'Salzburg', slug: 'salzburg' },
	{ name: 'Styria', area: 'Steiermark', slug: 'styria' },
	{ name: 'Tyrol', area: 'Tirol', slug: 'tyrol' },
	{ name: 'Vorarlberg', area: 'Vorarlberg', slug: 'vorarlberg' },
	{ name: 'Vienna', area: 'Wien', slug: 'vienna' }
];

console.log('State | OSM Spots | Imported Spots');
console.log('---|---|---');

for (const { name, area, slug } of states) {
	const query = `[out:json][timeout:60];
area["name"="${area}"]->.searchArea;
(
  node["sport"="climbing"](area.searchArea);
  way["sport"="climbing"](area.searchArea);
);
out count;`;

	try {
		// Use overpass.kumi.systems as the primary working server
		const url = 'https://overpass.kumi.systems/api/interpreter?data=' + encodeURIComponent(query);
		const controller = new AbortController();
		const t = setTimeout(() => controller.abort(), 60000);
		const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'FelsverzeichnisCragPipeline/1.0 (Contact: robin.steiner@vorstieg.eu)' } });
		clearTimeout(t);
		if (!res.ok) throw new Error(`HTTP error ${res.status}`);
		const data = await res.json();
		const total = data.elements?.[0]?.tags?.total ?? data.elements?.length ?? '?';
		const imported = getImportedCount(slug);
		console.log(`**${name}** | ${total} | ${imported}`);
	} catch (e) {
		console.log(`**${name}** | ERROR - ${e.message} | ${getImportedCount(slug)}`);
	}
}
