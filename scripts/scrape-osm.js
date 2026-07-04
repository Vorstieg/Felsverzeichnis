import fs from 'fs';
import path from 'path';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ENTRIES_DIR = './src/entries';

// Helper to calculate distance between two coordinates in km (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
	const R = 6371; // Earth radius in km
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

// Clean and normalize folder and file names
function slugify(text) {
	if (!text) return '';
	return text
		.toString()
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^a-z0-9\u00C0-\u017F\-]/g, '') // Keep alphanumeric, German/Latin accents, and hyphens
		.replace(/\-\-+/g, '-') // Replace multiple hyphens with single hyphen
		.replace(/^-+/, '') // Trim leading hyphen
		.replace(/-+$/, ''); // Trim trailing hyphen
}

// Crawl the repository to find all globally existing crag IDs
function getGloballyExistingCragIds() {
	const existingIds = new Set();
	function crawl(dir) {
		if (!fs.existsSync(dir)) return;
		const files = fs.readdirSync(dir);
		for (const file of files) {
			const fullPath = path.join(dir, file);
			if (fs.statSync(fullPath).isDirectory()) {
				crawl(fullPath);
			} else if (
				file.endsWith('.json') &&
				!file.includes('-transit') &&
				!file.includes('-parking') &&
				!file.includes('-topo')
			) {
				try {
					const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
					const id = content.properties?.id;
					if (id) {
						existingIds.add(id.toLowerCase().trim());
					}
				} catch (e) {
					// Ignore parsing errors
				}
			}
		}
	}
	crawl(ENTRIES_DIR);
	return existingIds;
}

async function run() {
	const args = process.argv.slice(2);
	let country = 'austria';
	let state = 'lower-austria';
	let areaName = 'Niederösterreich'; // Used for OSM Area query
	let bbox = null; // Can be specified as --bbox min_lat,min_lon,max_lat,max_lon

	// Parse command line arguments
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--country' && args[i + 1]) {
			country = slugify(args[i + 1]);
			i++;
		} else if (args[i] === '--state' && args[i + 1]) {
			state = slugify(args[i + 1]);
			i++;
		} else if (args[i] === '--area' && args[i + 1]) {
			areaName = args[i + 1];
			i++;
		} else if (args[i] === '--bbox' && args[i + 1]) {
			bbox = args[i + 1];
			i++;
		} else if (args[i] === '--help' || args[i] === '-h') {
			console.log(`
Felsverzeichnis OSM Scraper
===========================
Legally scrape climbing crags from OpenStreetMap and import them into Felsverzeichnis structure.

Usage:
  node scripts/scrape-osm.js [options]

Options:
  --country <name>   Target country folder name (default: "austria")
  --state <name>     Target state/region folder name (default: "lower-austria")
  --area <osm-name>  OSM Area Name for query (default: "Niederösterreich")
  --bbox <coords>    Bounding box filter (format: "min_lat,min_lon,max_lat,max_lon")
  --help, -h         Show this help screen

Examples:
  node scripts/scrape-osm.js --country germany --state bavaria --area "Bayern"
  node scripts/scrape-osm.js --country austria --state lower-austria --area "Niederösterreich"
            `);
			process.exit(0);
		}
	}

	console.log(
		`🚀 Starting scraper for ${country}/${state} (OSM Area: "${areaName}"${bbox ? `, BBox: ${bbox}` : ''})...`
	);

	// Build the Overpass QL query
	let query = '';
	if (bbox) {
		query = `[out:json][timeout:90];
(
  node["sport"="climbing"](${bbox});
  way["sport"="climbing"](${bbox});
  node[place=city](${bbox});
  node[place=town](${bbox});
  node[place=village](${bbox});
);
out center;`;
	} else {
		query = `[out:json][timeout:90];
area["name"="${areaName}"]->.searchArea;
(
  node["sport"="climbing"](area.searchArea);
  way["sport"="climbing"](area.searchArea);
  node[place=city](area.searchArea);
  node[place=town](area.searchArea);
  node[place=village](area.searchArea);
);
out center;`;
	}

	console.log('📡 Sending request to Overpass API (this may take a few seconds)...');
	try {
		const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'User-Agent': 'FelsverzeichnisCragImporter/1.0 (Contact: robin.steiner@vorstieg.eu)'
			}
		});

		if (!response.ok) {
			throw new Error(`Overpass API returned status code ${response.status}`);
		}

		const data = await response.json();
		const elements = data.elements || [];
		console.log(`✅ Received ${elements.length} elements from OpenStreetMap.`);

		// Separate climbing spots and places (towns/cities)
		const climbingSpots = [];
		const towns = [];

		for (const el of elements) {
			const isClimbing = el.tags && (el.tags.sport === 'climbing' || el.tags.climbing);
			const lat = el.lat || (el.center && el.center.lat);
			const lon = el.lon || (el.center && el.center.lon);

			if (!lat || !lon) continue;

			if (isClimbing) {
				climbingSpots.push({
					id: el.id,
					type: el.type,
					tags: el.tags,
					lat,
					lon
				});
			} else if (el.tags && el.tags.place) {
				towns.push({
					name: el.tags.name,
					place: el.tags.place,
					lat,
					lon
				});
			}
		}

		console.log(
			`📍 Found ${climbingSpots.length} climbing spots and ${towns.length} towns/cities.`
		);

		if (climbingSpots.length === 0) {
			console.log('⚠️ No climbing spots found matching the criteria.');
			return;
		}

		// Load globally existing crag IDs to prevent duplicates in other region folders
		const existingCragIds = getGloballyExistingCragIds();
		console.log(
			`📦 Loaded ${existingCragIds.size} existing crag IDs from codebase to prevent duplicate imports.`
		);

		// Process climbing spots and save to disk
		let countSaved = 0;
		let countSkipped = 0;
		const today = new Date().toISOString().split('T')[0];

		for (const spot of climbingSpots) {
			const name = spot.tags.name;
			if (!name) {
				countSkipped++;
				continue; // Skip unnamed crags
			}

			const cragId = slugify(name);
			if (!cragId) {
				countSkipped++;
				continue;
			}

			// Check if this crag already exists anywhere in the repository!
			if (existingCragIds.has(cragId)) {
				console.log(`ℹ️ Skipping duplicate global crag: "${name}" (id: ${cragId})`);
				countSkipped++;
				continue;
			}

			// Determine subregion
			let subregion = 'other';
			if (spot.tags['addr:city']) {
				subregion = slugify(spot.tags['addr:city']);
			} else if (towns.length > 0) {
				// Find closest town
				let minDistance = Infinity;
				let closestTown = null;
				for (const town of towns) {
					const dist = getDistance(spot.lat, spot.lon, town.lat, town.lon);
					if (dist < minDistance) {
						minDistance = dist;
						closestTown = town;
					}
				}
				if (closestTown && minDistance < 15) {
					// Only group if within 15km
					subregion = slugify(closestTown.name);
				}
			}

			// Determine climbing types
			const types = [];
			const climbingTag = spot.tags.climbing || '';
			const isBoulder = spot.tags['climbing:boulder'] === 'yes' || climbingTag.includes('boulder');
			const isSport =
				spot.tags['climbing:sport'] === 'yes' ||
				climbingTag.includes('crag') ||
				climbingTag.includes('sector');
			const isMultiPitch =
				spot.tags['climbing:multi_pitch'] === 'yes' || spot.tags['climbing:trad'] === 'yes';

			if (isBoulder) types.push('bouldering');
			if (isSport || types.length === 0) types.push('sports-climbing');
			if (isMultiPitch) types.push('multi-pitch');

			// Format website link
			let topoLink = '';
			let topoSite = '';
			const website = spot.tags.website || spot.tags.url || spot.tags['wikipedia'];
			if (website) {
				topoLink = website;
				try {
					const urlObj = new URL(website);
					topoSite = urlObj.hostname.replace('www.', '');
				} catch (e) {
					topoSite = 'website';
				}
			}

			// Construct GeoJSON Feature
			const feature = {
				type: 'Feature',
				properties: {
					id: cragId,
					date: today,
					updated: today,
					path: `europe/${country}/${state}/${subregion}/${cragId}`,
					name: name,
					type: types,
					description_de: spot.tags.description || spot.tags['description:de'] || '',
					description_en: spot.tags['description:en'] || '',
					topo: {
						site: topoSite,
						link: topoLink
					}
				},
				geometry: {
					type: 'Point',
					coordinates: [spot.lon, spot.lat]
				}
			};

			// Define folder and file paths
			const targetDir = path.join(ENTRIES_DIR, 'europe', country, state, subregion, cragId);
			const targetFile = path.join(targetDir, `${cragId}.json`);

			// Write file
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true });
			}

			// Check if file already exists at local path
			if (fs.existsSync(targetFile)) {
				console.log(`ℹ️ Skipping existing crag file: ${targetFile}`);
				countSkipped++;
			} else {
				fs.writeFileSync(targetFile, JSON.stringify(feature, null, 2), 'utf8');
				countSaved++;
				// Add to temporary set so we don't import duplicates within the same batch
				existingCragIds.add(cragId);
			}
		}

		console.log(`\n🎉 Import completed successfully!`);
		console.log(`💾 Saved ${countSaved} new crags.`);
		console.log(`⏭️ Skipped ${countSkipped} crags (unnamed, duplicate, or already existing).`);
	} catch (error) {
		console.error('❌ Error during scraping process:', error);
	}
}

run();
