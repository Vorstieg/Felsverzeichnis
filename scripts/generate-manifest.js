import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ENTRIES_DIR = './src/entries';
const OUTPUT_FILE = './static/manifest.json';

/**
 * Generates a SHA-256 hash for a file to help with change detection
 */
function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Recursively finds all crag JSON files and their associated assets
 */
function crawlEntries(dir, baseDir = ENTRIES_DIR) {
    const results = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            results.push(...crawlEntries(fullPath, baseDir));
        } else if (file.endsWith('.json') && 
                   !file.includes('-transit') && 
                   !file.includes('-parking') && 
                   !file.includes('-topo')) {
            
            // This is a main crag file
            try {
                const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                const cragId = content.properties?.id;

                if (cragId) {
                    const cragDir = path.dirname(fullPath);
                    const relativeDir = path.relative(process.cwd(), cragDir).split(path.sep).join('/');
                    
                    // Calculate path from directory structure (removing 'src/entries/')
                    const calculatedPath = path.relative(ENTRIES_DIR, cragDir).split(path.sep).join('/');

                    const cragEntry = {
                        id: cragId,
                        name: content.properties.name,
                        type: content.properties.type,
                        path: content.properties.path || calculatedPath,
                        coordinates: content.geometry.coordinates,
                        lastUpdated: content.properties.updated || content.properties.date,
                        description_de: content.properties.description_de || '',
                        description_en: content.properties.description_en || '',
                        tags: content.properties.tags || [],
                        security: content.properties.security || null,
                        topoLink: content.properties.topo?.link || null,
                        images: [],
                        transit: null,
                        parking: null,
                        tracks: [],
                        files: []
                    };

                    // Find all files in the same directory (topos, models, etc.)
                    const assets = fs.readdirSync(cragDir);
                    for (const asset of assets) {
                        const assetPath = path.join(cragDir, asset);
                        if (fs.statSync(assetPath).isFile()) {
                            const relativeAssetPath = `${relativeDir}/${asset}`;
                            
                            // Track all files for syncing
                            cragEntry.files.push({
                                name: asset,
                                path: relativeAssetPath,
                                hash: getFileHash(assetPath),
                                size: fs.statSync(assetPath).size
                            });

                            if (asset.endsWith('-transit.json')) {
                                cragEntry.transit = JSON.parse(fs.readFileSync(assetPath, 'utf8')).geometry.coordinates;
                            } else if (asset.endsWith('-parking.json')) {
                                cragEntry.parking = JSON.parse(fs.readFileSync(assetPath, 'utf8')).geometry.coordinates;
                            } else if (asset.endsWith('-track.json') || asset.endsWith('.gpx')) {
                                // Add track files to tracks array (we'll support JSON tracks for now)
                                cragEntry.tracks.push(relativeAssetPath);
                            } else if (['.jpg', '.jpeg', '.png', '.gif'].some(ext => asset.toLowerCase().endsWith(ext))) {
                                cragEntry.images.push(relativeAssetPath);
                            }
                        }
                    }

                    results.push(cragEntry);
                }
            } catch (e) {
                console.error(`Error parsing ${fullPath}:`, e);
            }
        }
    }

    return results;
}

console.log('Generating mobile manifest...');
const crags = crawlEntries(ENTRIES_DIR);

const sharedIcons = [];
const iconDir = './static/icons';
if (fs.existsSync(iconDir)) {
    const iconFiles = fs.readdirSync(iconDir);
    for (const file of iconFiles) {
        const fullPath = path.join(iconDir, file);
        if (fs.statSync(fullPath).isFile()) {
            sharedIcons.push({
                name: file,
                path: `icons/${file}`,
                hash: getFileHash(fullPath),
                size: fs.statSync(fullPath).size
            });
        }
    }
}

const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    crags: crags,
    sharedIcons: sharedIcons
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
console.log(`Manifest generated with ${crags.length} crags at ${OUTPUT_FILE}`);
