import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ENTRIES_DIR = './src/entries';

// Helper to clean and normalize region names
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
	console.log('🚀 Reorganizing Austrian crags by their climbing region (Gebirge)...');

	try {
		// Find all untracked JSON files
		const gitOutput = execSync('git status --porcelain -u', { encoding: 'utf8' });
		const lines = gitOutput.split('\n');

		const untrackedJsonFiles = [];

		for (const line of lines) {
			if (line.startsWith('?? ')) {
				const filePath = line.substring(3).trim();
				if (
					filePath.startsWith('src/entries/europe/austria/') &&
					filePath.endsWith('.json') &&
					!filePath.includes('-transit') &&
					!filePath.includes('-parking') &&
					!filePath.includes('-topo')
				) {
					untrackedJsonFiles.push(path.normalize(filePath));
				}
			}
		}

		console.log(`🔎 Found ${untrackedJsonFiles.length} untracked Austrian crags to analyze.`);

		let moveCount = 0;

		for (const filePath of untrackedJsonFiles) {
			if (!fs.existsSync(filePath)) continue;

			const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			const cragId = content.properties.id || path.basename(filePath, '.json');
			const topoLink = content.properties?.topo?.link;

			if (!topoLink || !topoLink.includes('bergsteigen.com')) {
				continue; // Skip if it doesn't have a verified bergsteigen.com link
			}

			console.log(`\n🔎 Fetching Gebirge for: "${content.properties.name}"...`);

			try {
				const res = await fetch(topoLink, {
					method: 'GET',
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
					}
				});

				if (res.ok) {
					const html = await res.text();

					// Match Gebirge followed by link name
					const gebirgeMatch = html.match(/Gebirge:[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
					const gebirge = gebirgeMatch ? gebirgeMatch[1].trim() : '';

					if (gebirge) {
						const currentDir = path.dirname(filePath);

						// Parse current path components: src/entries/europe/austria/lower-austria/<subregion>/<cragId>
						const relativePathParts = path.relative(ENTRIES_DIR, currentDir).split(path.sep);
						const country = relativePathParts[1]; // e.g. "austria"
						const state = relativePathParts[2]; // e.g. "lower-austria"
						const currentSubregion = relativePathParts[3]; // e.g. "hirschwang-an-der-rax"

						const targetSubregion = mapGebirgeToRegion(gebirge, currentSubregion);
						console.log(`   🏔️  Gebirge: "${gebirge}" -> Mapped Region: "${targetSubregion}"`);

						if (currentSubregion !== targetSubregion) {
							const newDir = path.join(
								ENTRIES_DIR,
								'europe',
								country,
								state,
								targetSubregion,
								cragId
							);
							const newFilePath = path.join(newDir, `${cragId}.json`);

							console.log(`   📦 Moving: [${currentSubregion}] -> [${targetSubregion}]`);

							if (!fs.existsSync(newDir)) {
								fs.mkdirSync(newDir, { recursive: true });
							}

							// 1. Move all files in the directory
							const files = fs.readdirSync(currentDir);
							for (const file of files) {
								const oldFile = path.join(currentDir, file);
								const newFile = path.join(newDir, file);
								fs.renameSync(oldFile, newFile);
							}

							// 2. Remove old directory
							fs.rmdirSync(currentDir);

							// 3. Update paths in the JSON file
							const updatedContent = JSON.parse(fs.readFileSync(newFilePath, 'utf8'));
							updatedContent.properties.path = `europe/${country}/${state}/${targetSubregion}/${cragId}`;
							updatedContent.properties.updated = new Date().toISOString().split('T')[0];

							fs.writeFileSync(newFilePath, JSON.stringify(updatedContent, null, 2), 'utf8');
							console.log(`💾 Saved updated path config to ${newFilePath}`);

							moveCount++;
						} else {
							console.log(`   ✓ Already in correct region folder`);
						}
					} else {
						console.log(`   ⚠️  No Gebirge field found on page.`);
					}
				}
			} catch (err) {
				console.error(`❌ Network error processing ${content.properties.name}:`, err);
			}

			await sleep(400);
		}

		// Clean up empty directories recursively
		console.log('\n🧹 Cleaning empty directories...');
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
				console.log(`🗑️  Removed empty folder: ${dir}`);
			}
		}
		cleanEmpty(path.join(ENTRIES_DIR, 'europe', 'austria'));

		console.log(`\n🎉 Reorganization completed!`);
		console.log(`🚚 Successfully moved and re-grouped ${moveCount} crags.`);
	} catch (e) {
		console.error('❌ Error during reorganization:', e);
	}
}

run();
