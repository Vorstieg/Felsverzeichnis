import fs from 'fs';
import path from 'path';

const AUSTRIA_DIR = './src/entries/europe/austria';
const CATEGORIES = ['klettergarten', 'klettern', 'eisklettern', 'klettersteig'];

function crawlEntries(dir, results = []) {
	if (!fs.existsSync(dir)) return results;
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const fullPath = path.join(dir, file);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			crawlEntries(fullPath, results);
		} else if (
			file.endsWith('.json') &&
			!file.includes('-transit') &&
			!file.includes('-parking') &&
			!file.includes('-topo')
		) {
			results.push(fullPath);
		}
	}
	return results;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
	console.log('🔍 Locating Austrian climbing spots...');
	const files = crawlEntries(AUSTRIA_DIR);
	console.log(`📍 Found ${files.length} crag JSON files to analyze.`);

	let enrichedCount = 0;
	let correctedCount = 0;
	let skippedCount = 0;

	for (const filePath of files) {
		try {
			const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			const cragId = content.properties.id || path.basename(filePath, '.json');

			let existingLink = content.properties?.topo?.link || '';
			let needsProbe = !existingLink;
			let targetUrl = existingLink;

			if (existingLink && content.properties?.topo?.site !== 'bergsteigen.com') {
				skippedCount++;
				continue;
			}

			console.log(`\n🔎 Processing: "${content.properties.name}" (id: ${cragId})...`);

			let html = '';

			if (needsProbe) {
				// Probe candidate URLs
				for (const category of CATEGORIES) {
					const candidateUrl = `https://www.bergsteigen.com/touren/${category}/${cragId}/`;

					try {
						const res = await fetch(candidateUrl, {
							method: 'GET',
							headers: {
								'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
							}
						});

						if (res.ok) {
							const tempHtml = await res.text();

							// Verify it's a real page and not a soft-404 search list
							const isRealPage =
								tempHtml.includes('Schwierigkeit') ||
								tempHtml.includes('Absicherung') ||
								tempHtml.includes('Seillängen');

							if (isRealPage) {
								html = tempHtml;
								targetUrl = candidateUrl;
								break;
							}
						}
					} catch (err) {
						// Handle network error
					}

					await sleep(200);
				}
			} else {
				// Fetch existing page to confirm/correct category
				try {
					const res = await fetch(existingLink, {
						method: 'GET',
						headers: {
							'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
						}
					});
					if (res.ok) {
						html = await res.text();
					}
				} catch (e) {
					// Ignore and keep what we have
				}
			}

			if (html) {
				// Extract breadcrumbs cleanly using itemprop="name"
				const breadcrumbs = [];
				const bcRegex = /<span\s+itemprop="name">([^<]*)<\/span>/gi;
				let m;
				while ((m = bcRegex.exec(html)) !== null) {
					breadcrumbs.push(m[1].trim());
				}

				// Verify it's a real page and not a soft-404
				const isRealPage =
					html.includes('Schwierigkeit') ||
					html.includes('Absicherung') ||
					html.includes('Seillängen');

				const hasRealBreadcrumbs = breadcrumbs.length >= 3 && breadcrumbs[1] === 'Touren';

				if (isRealPage && hasRealBreadcrumbs) {
					// Determine category from breadcrumbs
					let trueCategory = 'klettergarten'; // default fallback
					if (breadcrumbs.includes('Klettern')) {
						trueCategory = 'klettern';
					} else if (breadcrumbs.includes('Klettergarten')) {
						trueCategory = 'klettergarten';
					} else if (
						breadcrumbs.includes('Klettersteig') ||
						breadcrumbs.includes('Klettersteige')
					) {
						trueCategory = 'klettersteig';
					} else if (breadcrumbs.includes('Eisklettern')) {
						trueCategory = 'eisklettern';
					}

					console.log(`   📊 Breadcrumbs: [${breadcrumbs.join(' -> ')}]`);
					console.log(`   🏷️  True Category: "${trueCategory}"`);

					const correctUrl = `https://www.bergsteigen.com/touren/${trueCategory}/${cragId}/`;

					// Map category to climbing type
					const finalTypes = [];
					if (content.properties.type && content.properties.type.includes('bouldering')) {
						finalTypes.push('bouldering');
					}

					if (trueCategory === 'klettern') {
						finalTypes.push('multi-pitch');
					} else {
						finalTypes.push('sports-climbing');
					}

					let modified = false;

					// Update type array
					if (JSON.stringify(content.properties.type) !== JSON.stringify(finalTypes)) {
						content.properties.type = finalTypes;
						modified = true;
					}

					// Update link URL
					if (content.properties.topo?.link !== correctUrl) {
						content.properties.topo = {
							site: 'bergsteigen.com',
							link: correctUrl
						};
						modified = true;
					}

					if (modified) {
						content.properties.updated = new Date().toISOString().split('T')[0];
						fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
						console.log(`💾 Saved updates (type/URL corrected) to ${filePath}`);
						correctedCount++;
					} else {
						console.log(`   ✓ Already correct and up-to-date`);
						skippedCount++;
					}

					if (needsProbe) enrichedCount++;
				} else {
					// It was a soft-404 false positive! Clean it up!
					console.log(`   ⚠️  Soft-404 detected! Purging false-positive link.`);
					let modified = false;

					if (content.properties.topo?.link) {
						content.properties.topo = {
							site: '',
							link: ''
						};
						modified = true;
					}

					const resetTypes = [];
					if (content.properties.type && content.properties.type.includes('bouldering')) {
						resetTypes.push('bouldering');
					}
					resetTypes.push('sports-climbing');

					if (JSON.stringify(content.properties.type) !== JSON.stringify(resetTypes)) {
						content.properties.type = resetTypes;
						modified = true;
					}

					if (modified) {
						content.properties.updated = new Date().toISOString().split('T')[0];
						fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
						console.log(`🧹 Cleaned false-positive: ${filePath}`);
						correctedCount++;
					} else {
						skippedCount++;
					}
				}
			} else {
				console.log(`   ❌ No valid page found on bergsteigen.com`);

				// Revert to default if it had an invalid link
				if (content.properties.topo?.link) {
					content.properties.topo = { site: '', link: '' };
					content.properties.type = ['sports-climbing'];
					content.properties.updated = new Date().toISOString().split('T')[0];
					fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
					console.log(`🧹 Reverted invalid file: ${filePath}`);
					correctedCount++;
				} else {
					skippedCount++;
				}
			}

			await sleep(350);
		} catch (e) {
			console.error(`❌ Error processing ${filePath}:`, e);
		}
	}

	console.log(`\n🎉 Enrichment & Categorization completed!`);
	console.log(`✨ Newly enriched with links: ${enrichedCount} crags.`);
	console.log(`🔧 Corrected/updated/cleaned: ${correctedCount} crags.`);
	console.log(`⏭️ Skipped (already correct or skipped): ${skippedCount} crags.`);
}

run();
