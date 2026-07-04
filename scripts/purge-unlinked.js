import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function run() {
	console.log('🧹 Scanning for untracked crags without topo links...');

	try {
		// Run git status with -u to find all untracked files recursively
		const gitOutput = execSync('git status --porcelain -u', { encoding: 'utf8' });
		const lines = gitOutput.split('\n');

		const untrackedJsonFiles = [];

		for (const line of lines) {
			// Untracked files start with '?? '
			if (line.startsWith('?? ')) {
				const filePath = line.substring(3).trim();
				// We only care about main crag JSON files under src/entries
				if (
					filePath.startsWith('src/entries/') &&
					filePath.endsWith('.json') &&
					!filePath.includes('-transit') &&
					!filePath.includes('-parking') &&
					!filePath.includes('-topo')
				) {
					untrackedJsonFiles.push(path.normalize(filePath));
				}
			}
		}

		console.log(`🔎 Found ${untrackedJsonFiles.length} untracked crag files.`);

		let deletedCount = 0;

		for (const filePath of untrackedJsonFiles) {
			if (!fs.existsSync(filePath)) continue;

			const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			const topoLink = content.properties?.topo?.link;

			// If the topo link is empty or missing, delete it!
			if (!topoLink) {
				console.log(`🗑️  Deleting unlinked crag: ${content.properties.name} (${filePath})`);

				const dir = path.dirname(filePath);

				// 1. Delete all files in that directory (e.g. transit/parking/images if they exist)
				if (fs.existsSync(dir)) {
					const files = fs.readdirSync(dir);
					for (const file of files) {
						fs.unlinkSync(path.join(dir, file));
					}
					// 2. Delete the directory itself
					fs.rmdirSync(dir);

					// 3. Try to recursively clean up empty parent directories
					let parent = path.dirname(dir);
					while (parent && parent.includes('src/entries')) {
						if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
							fs.rmdirSync(parent);
							parent = path.dirname(parent);
						} else {
							break;
						}
					}
				}

				deletedCount++;
			}
		}

		console.log(`\n🎉 Cleanup completed!`);
		console.log(`🗑️  Successfully deleted ${deletedCount} unlinked newly added crags.`);
	} catch (e) {
		console.error('❌ Error during purge process:', e);
	}
}

run();
