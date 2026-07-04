import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ENTRIES_DIR = './src/entries';
const CATEGORIES = ['klettergarten', 'klettern', 'eisklettern', 'klettersteig'];

// Helper for Haversine distance
function getDistance(lat1, lon1, lat2, lon2) {
	const R = 6371;
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
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9\u00C0-\u017F\-]/g, '')
		.replace(/\-\-+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
}

// Crawl the repository to find all globally existing crag IDs
function getGloballyExistingCragIds() {
	const existingIds = new Set();
	function crawl(dir) {
		try {
			if (!fs.existsSync(dir)) return;
			if (path.basename(dir) === 'temp_pipeline') return;

			const files = fs.readdirSync(dir);
			for (const file of files) {
				const fullPath = path.join(dir, file);
				try {
					if (!fs.existsSync(fullPath)) continue;
					const stat = fs.statSync(fullPath);
					if (stat.isDirectory()) {
						crawl(fullPath);
					} else if (
						file.endsWith('.json') &&
						!file.includes('-transit') &&
						!file.includes('-parking') &&
						!file.includes('-topo')
					) {
						const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
						const id = content.properties?.id;
						if (id) {
							existingIds.add(id.toLowerCase().trim());
						}
					}
				} catch (e) {
					// Ignore concurrent file access or deletion errors
				}
			}
		} catch (err) {
			// Ignore concurrent directory access errors
		}
	}
	crawl(ENTRIES_DIR);
	return existingIds;
}

// Maps the Bergsteigen.com Gebirge field to Felsverzeichnis climbing regions
function mapGebirgeToRegion(gebirge, currentSubregion) {
	if (!gebirge) return currentSubregion;

	const g = gebirge.toLowerCase().trim();

	if (
		g.includes('rax') ||
		g.includes('schneeberg') ||
		g.includes('gutensteiner alpen') ||
		g.includes('gutenstein')
	) {
		return 'rax-schneeberg';
	}
	if (g.includes('hohe wand') || g.includes('hohewand')) {
		return 'hohe-wand';
	}
	if (g.includes('wachau') || g.includes('dunkelsteiner')) {
		return 'wachau';
	}

	return slugify(gebirge);
}

// Generate candidate slugs by stripping common German climbing-related prefixes/suffixes
function getCandidateSlugs(cragId) {
	const candidates = [cragId];

	// Prefix stripping (e.g. klettergarten-kanzianiberg -> kanzianiberg)
	const prefixRegex = /^(klettergarten|klettergebiet|kletterpark)-(.+)$/;
	const prefixMatch = cragId.match(prefixRegex);
	if (prefixMatch) {
		candidates.push(prefixMatch[2]);
	}

	// Suffix stripping (e.g. peter-santner-klettergarten -> peter-santner)
	const suffixRegex = /^(.+)-(klettergarten|klettergebiet|kletterpark)$/;
	const suffixMatch = cragId.match(suffixRegex);
	if (suffixMatch) {
		candidates.push(suffixMatch[1]);
	}

	return Array.from(new Set(candidates));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
	const args = process.argv.slice(2);
	let country = 'austria';
	let state = 'lower-austria';
	let areaName = 'Niederösterreich';
	let bbox = null;

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
		}
	}

	console.log(`\n======================================================`);
	console.log(`🚀 RUNNING END-TO-END IMPORT PIPELINE FOR ${country}/${state}`);
	console.log(`======================================================\n`);

	// 1. Scraping OSM
	console.log(`Step 1: Scraping OSM climbing spots (BBox: ${bbox || 'None'})...`);
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

	const OVERPASS_SERVERS = [
		'https://overpass-api.de/api/interpreter',
		'https://overpass.kumi.systems/api/interpreter',
		'https://api.openstreetmap.fr/oapi/interpreter'
	];
	let elements = [];
	let success = false;

	for (const serverUrl of OVERPASS_SERVERS) {
		console.log(`   📡 Fetching from Overpass server: ${serverUrl}...`);
		try {
			const url = `${serverUrl}?data=${encodeURIComponent(query)}`;
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

			const res = await fetch(url, {
				headers: {
					'User-Agent': 'FelsverzeichnisCragPipeline/1.0 (Contact: robin.steiner@vorstieg.eu)'
				},
				signal: controller.signal
			});
			clearTimeout(timeoutId);

			if (res.ok) {
				const data = await res.json();
				elements = data.elements || [];
				success = true;
				break;
			} else {
				console.warn(`   ⚠️ Server ${serverUrl} returned status ${res.status}`);
			}
		} catch (e) {
			console.warn(`   ⚠️ Failed to fetch from ${serverUrl}: ${e.message}`);
		}
	}

	if (!success) {
		console.error('❌ All Overpass API servers failed.');
		process.exit(1);
	}

	const climbingSpots = [];
	const towns = [];

	for (const el of elements) {
		const isClimbing = el.tags && (el.tags.sport === 'climbing' || el.tags.climbing);
		const lat = el.lat || (el.center && el.center.lat);
		const lon = el.lon || (el.center && el.center.lon);

		if (!lat || !lon) continue;

		if (isClimbing) {
			climbingSpots.push({ id: el.id, tags: el.tags, lat, lon });
		} else if (el.tags && el.tags.place) {
			towns.push({ name: el.tags.name, lat, lon });
		}
	}

	console.log(
		`   ✓ Found ${climbingSpots.length} climbing spots and ${towns.length} towns/cities.`
	);

	const existingCragIds = getGloballyExistingCragIds();
	console.log(
		`   ✓ Loaded ${existingCragIds.size} existing crag IDs from codebase to prevent duplicate imports.`
	);

	const tempFolder = path.join(ENTRIES_DIR, 'europe', country, state, 'temp_pipeline');
	if (!fs.existsSync(tempFolder)) {
		fs.mkdirSync(tempFolder, { recursive: true });
	}

	const scrapedFiles = [];

	for (const spot of climbingSpots) {
		const name = spot.tags.name;
		if (!name) continue;

		const cragId = slugify(name);
		if (!cragId || existingCragIds.has(cragId)) continue;

		// Group into temp folder first
		const targetDir = path.join(tempFolder, cragId);
		const targetFile = path.join(targetDir, `${cragId}.json`);

		const feature = {
			type: 'Feature',
			properties: {
				id: cragId,
				date: new Date().toISOString().split('T')[0],
				updated: new Date().toISOString().split('T')[0],
				path: `europe/${country}/${state}/temp_pipeline/${cragId}`,
				name: name,
				type: ['sports-climbing'],
				description_de: spot.tags.description || spot.tags['description:de'] || '',
				description_en: spot.tags['description:en'] || '',
				topo: { site: '', link: '' }
			},
			geometry: {
				type: 'Point',
				coordinates: [spot.lon, spot.lat]
			}
		};

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		fs.writeFileSync(targetFile, JSON.stringify(feature, null, 2), 'utf8');
		scrapedFiles.push(targetFile);
	}

	console.log(
		`   ✓ Saved ${scrapedFiles.length} potential new crags to temp folder for validation.\n`
	);

	// 2. Validation & Enrichment
	console.log(`Step 2: Validating and enriching crags against Bergsteigen.com...`);

	let savedCount = 0;
	let purgedCount = 0;

	for (const filePath of scrapedFiles) {
		if (!fs.existsSync(filePath)) continue;

		const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		const cragId = content.properties.id;
		const name = content.properties.name;

		console.log(`   🔎 Checking: "${name}" (id: ${cragId})...`);

		let validTours = [];
		const slugCandidates = getCandidateSlugs(cragId);
		let bestMatchedSlug = cragId;
		for (const slugCandidate of slugCandidates) {
			let foundMatchForCandidate = false;

			// Probe ALL category URLs in parallel to extract the true tour type
			const promises = CATEGORIES.map(async (category) => {
				const candidateUrl = `https://www.bergsteigen.com/touren/${category}/${slugCandidate}/`;
				try {
					const res = await fetch(candidateUrl, {
						method: 'GET',
						headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
					});

					if (res.ok) {
						const tempHtml = await res.text();

						// Extract breadcrumbs to validate
						const bc = [];
						const bcRx = /<span\s+itemprop="name">([^<]*)<\/span>/gi;
						let bm;
						while ((bm = bcRx.exec(tempHtml)) !== null) {
							bc.push(bm[1].trim());
						}

						const hasRealBreadcrumbs = bc.length >= 4 && bc[1] === 'Touren';
						const hasRouteMetadata =
							tempHtml.includes('Schwierigkeit') ||
							tempHtml.includes('Absicherung') ||
							tempHtml.includes('Seillängen');

						if (hasRealBreadcrumbs && hasRouteMetadata) {
							const tourIdMatch = tempHtml.match(/<input\s+id="tourId"\s+type="hidden"\s+name="tourId"\s+value="([^"]*)"/i);
							const tourId = tourIdMatch ? tourIdMatch[1].trim() : candidateUrl;

							const itemInfoMatch = tempHtml.match(/<div\s+class="itemInfo\s+[^"]*">([^<]*)<\/div>/i);
							const trueCategoryText = itemInfoMatch ? itemInfoMatch[1].trim() : (bc[2] || '');

							let derivedCategory = 'klettergarten';
							if (trueCategoryText === 'Klettern') {
								derivedCategory = 'klettern';
							} else if (trueCategoryText === 'Klettergarten' || trueCategoryText === 'Klettergärten') {
								derivedCategory = 'klettergarten';
							} else if (trueCategoryText === 'Klettersteig' || trueCategoryText === 'Klettersteige') {
								derivedCategory = 'klettersteig';
							} else if (trueCategoryText === 'Eisklettern') {
								derivedCategory = 'eisklettern';
							} else {
								derivedCategory = category;
							}

							if (derivedCategory === 'klettern' || derivedCategory === 'klettergarten') {
								const gebirgeMatch = tempHtml.match(/Gebirge:[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
								const gebirge = gebirgeMatch ? gebirgeMatch[1].trim() : '';

								return {
									tourId,
									category: derivedCategory,
									url: `https://www.bergsteigen.com/touren/${derivedCategory}/${slugCandidate}/`,
									gebirge,
									matchedSlug: slugCandidate
								};
							}
						}
					}
				} catch (err) {
					// Ignore network errors
				}
				return null;
			});

			const results = await Promise.all(promises);
			const validResults = results.filter(Boolean);
			if (validResults.length > 0) {
				validTours.push(...validResults);
				foundMatchForCandidate = true;
			}

			// If we found a valid tour for this candidate slug, stop probing other candidates
			if (foundMatchForCandidate) {
				break;
			}

			// Small sleep between slug candidates if the first candidate failed
			await sleep(100);
		}

		// De-duplicate matches by tourId to avoid double-processing the same tour page loaded under different URLs
		const uniqueToursMap = new Map();
		for (const tour of validTours) {
			if (!uniqueToursMap.has(tour.tourId)) {
				uniqueToursMap.set(tour.tourId, tour);
			}
		}
		const uniqueTours = Array.from(uniqueToursMap.values());

		if (uniqueTours.length > 0) {
			const finalTypes = [];
			let bestUrl = '';
			let bestGebirge = '';
			let bestMatchedSlug = cragId;

			for (const tour of uniqueTours) {
				if (tour.category === 'klettern') {
					if (!finalTypes.includes('multi-pitch')) finalTypes.push('multi-pitch');
				} else if (tour.category === 'klettergarten') {
					if (!finalTypes.includes('sports-climbing')) finalTypes.push('sports-climbing');
				}

				// Choose bestUrl: prefer klettern, otherwise first matching category
				if (!bestUrl || tour.category === 'klettern') {
					bestUrl = tour.url;
					bestMatchedSlug = tour.matchedSlug;
				}
				if (!bestGebirge || tour.gebirge) {
					bestGebirge = tour.gebirge;
				}
			}

			if (finalTypes.length === 0) {
				console.log(`      ❌ No valid climbing category. Purging crag.`);
				purgeCrag(filePath);
				purgedCount++;
				await sleep(400);
				continue;
			}

			content.properties.id = bestMatchedSlug;
			content.properties.type = finalTypes;
			content.properties.topo = {
				site: 'bergsteigen.com',
				link: bestUrl
			};

			// Re-group based on Gebirge
			const targetSubregion = mapGebirgeToRegion(bestGebirge, 'other');
			const finalDir = path.join(ENTRIES_DIR, 'europe', country, state, targetSubregion, bestMatchedSlug);
			const finalFilePath = path.join(finalDir, `${bestMatchedSlug}.json`);

			console.log(
				`      ✅ VALID TOPO FOUND! Region: "${targetSubregion}", Types: [${finalTypes.join(', ')}], URL: "${bestUrl}"`
			);

			if (!fs.existsSync(finalDir)) {
				fs.mkdirSync(finalDir, { recursive: true });
			}

			// Move from temp to final region directory
			const currentDir = path.dirname(filePath);
			const files = fs.readdirSync(currentDir);
			for (const file of files) {
				let destName = file;
				if (file === `${cragId}.json`) {
					destName = `${bestMatchedSlug}.json`;
				} else if (file.startsWith(`${cragId}-`)) {
					destName = file.replace(`${cragId}-`, `${bestMatchedSlug}-`);
				}
				fs.renameSync(path.join(currentDir, file), path.join(finalDir, destName));
			}
			fs.rmdirSync(currentDir);

			// Update JSON path
			content.properties.path = `europe/${country}/${state}/${targetSubregion}/${bestMatchedSlug}`;
			fs.writeFileSync(finalFilePath, JSON.stringify(content, null, 2), 'utf8');

			savedCount++;
		} else {
			console.log(`      🔎 Bergsteigen did not match. Trying 27crags.com fallback...`);
			let matched27crags = null;

			for (const slugCandidate of slugCandidates) {
				const checkUrl = `https://27crags.com/crags/${slugCandidate}`;
				try {
					const res = await fetch(checkUrl, {
						method: 'GET',
						headers: {
							'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
						}
					});
					if (res.ok) {
						const html = await res.text();

						// Isolate the crag-summary container to avoid global navigation and filter sidebar leakage!
						const summaryIndex = html.indexOf('class="crag-summary');
						const summaryHtml = summaryIndex !== -1 ? html.slice(summaryIndex, summaryIndex + 1500) : '';

						const types = [];
						let hasBoulder = false;
						let hasSport = false;

						if (summaryHtml) {
							hasBoulder = summaryHtml.includes('icon-boulder') || summaryHtml.includes('Boulder');
							hasSport = summaryHtml.includes('icon-sport') || summaryHtml.includes('Sport');
						} else {
							// Safe fallback if container class is not found
							hasBoulder = html.includes('icon-boulder') || html.includes('class="name">Boulder</span>');
							hasSport = html.includes('icon-sport') || html.includes('class="name">Sport</span>');
						}

						if (hasBoulder) types.push('bouldering');
						if (hasSport) types.push('sports-climbing');

						if (types.length === 0) {
							types.push('bouldering');
						}

						matched27crags = {
							site: '27crags.com',
							link: checkUrl,
							types,
							matchedSlug: slugCandidate
						};
						break;
					}
				} catch (err) {
					// Ignore network errors
				}
				await sleep(100);
			}

			if (matched27crags) {
				let subregion = 'other';
				if (towns.length > 0) {
					const spot_lon = content.geometry.coordinates[0];
					const spot_lat = content.geometry.coordinates[1];
					let minDistance = Infinity;
					let closestTown = null;
					for (const town of towns) {
						const dist = getDistance(spot_lat, spot_lon, town.lat, town.lon);
						if (dist < minDistance) {
							minDistance = dist;
							closestTown = town;
						}
					}
					if (closestTown && minDistance < 15) {
						subregion = slugify(closestTown.name);
					}
				}

				content.properties.id = matched27crags.matchedSlug;
				content.properties.type = matched27crags.types;
				content.properties.topo = {
					site: matched27crags.site,
					link: matched27crags.link
				};

				const finalDir = path.join(ENTRIES_DIR, 'europe', country, state, subregion, matched27crags.matchedSlug);
				const finalFilePath = path.join(finalDir, `${matched27crags.matchedSlug}.json`);

				console.log(
					`      ✅ VALID TOPO FOUND (27crags fallback)! Region: "${subregion}", Types: [${matched27crags.types.join(', ')}], URL: "${matched27crags.link}"`
				);

				if (!fs.existsSync(finalDir)) {
					fs.mkdirSync(finalDir, { recursive: true });
				}

				const currentDir = path.dirname(filePath);
				const files = fs.readdirSync(currentDir);
				for (const file of files) {
					let destName = file;
					if (file === `${cragId}.json`) {
						destName = `${matched27crags.matchedSlug}.json`;
					} else if (file.startsWith(`${cragId}-`)) {
						destName = file.replace(`${cragId}-`, `${matched27crags.matchedSlug}-`);
					}
					fs.renameSync(path.join(currentDir, file), path.join(finalDir, destName));
				}
				fs.rmdirSync(currentDir);

				content.properties.path = `europe/${country}/${state}/${subregion}/${matched27crags.matchedSlug}`;
				fs.writeFileSync(finalFilePath, JSON.stringify(content, null, 2), 'utf8');

				savedCount++;
			} else {
				console.log(`      ❌ No valid climbing topo page found on Bergsteigen or 27crags. Purging crag.`);
				purgeCrag(filePath);
				purgedCount++;
			}
		}

		await sleep(400);
	}

	// Clean up temp folder
	if (fs.existsSync(tempFolder)) {
		cleanEmpty(tempFolder);
	}

	// Clean up empty directories recursively
	console.log('\nStep 3: Cleaning up empty directory nodes...');
	cleanEmpty(path.join(ENTRIES_DIR, 'europe', 'austria'));

	console.log(`\n======================================================`);
	console.log(`🎉 Pipeline execution finished successfully!`);
	console.log(`💾 Saved & verified: ${savedCount} crags.`);
	console.log(`🗑️  Purged (unlinked/soft-404): ${purgedCount} crags.`);
	console.log(`======================================================\n`);

	// 3. Build manifest
	console.log('Step 4: Rebuilding Svelte mobile manifest...');
	try {
		execSync('node scripts/generate-manifest.js', { stdio: 'inherit' });
	} catch (e) {
		console.error('❌ Failed to run generate-manifest.js:', e);
	}
}

function purgeCrag(filePath) {
	const dir = path.dirname(filePath);
	if (fs.existsSync(dir)) {
		const files = fs.readdirSync(dir);
		for (const file of files) {
			fs.unlinkSync(path.join(dir, file));
		}
		fs.rmdirSync(dir);
	}
}

function cleanEmpty(dir) {
	if (!fs.existsSync(dir)) return;
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const fullPath = path.join(dir, file);
		if (fs.statSync(fullPath).isDirectory()) {
			cleanEmpty(fullPath);
		}
	}
	if (fs.readdirSync(dir).length === 0) {
		fs.rmdirSync(dir);
		console.log(`   🗑️  Removed empty folder: ${dir}`);
	}
}

run();
