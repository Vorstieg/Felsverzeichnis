const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(cors());

// Middleware to parse JSON bodies if needed, but we mostly handle raw streams
app.use(express.json({ limit: '50mb' }));

// Basic Auth setup for write operations
const authMiddleware = basicAuth({
    users: { [process.env.API_USER || 'admin']: process.env.API_PASSWORD || 'password' },
    challenge: true,
    unauthorizedResponse: 'Unauthorized'
});

app.use('/api/fs', express.raw({ type: '*/*', limit: '500mb' }), async (req, res) => {
    // req.path contains the path relative to /api/fs
    const relativePath = req.path ? decodeURIComponent(req.path) : '/';
    // Normalize and prevent directory traversal
    const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const targetPath = path.join(DATA_DIR, safeRelativePath);

    // Ensure they don't break out of the DATA_DIR directory
    if (!targetPath.startsWith(DATA_DIR)) {
        return res.status(403).send('Forbidden');
    }

    if (req.method === 'GET') {
        try {
            const stats = await fs.promises.stat(targetPath);
            if (stats.isDirectory()) {
                const getFiles = async (dir, baseRoute = '') => {
                    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                    let results = [];
                    for (let entry of entries) {
                        const relativeEntryPath = path.join(baseRoute, entry.name).replace(/\\/g, '/');
                        if (entry.isDirectory()) {
                            results.push({ name: entry.name, path: relativeEntryPath, type: 'dir' });
                            if (req.query.recursive === 'true') {
                                results.push(...await getFiles(path.join(dir, entry.name), relativeEntryPath));
                            }
                        } else {
                            results.push({ name: entry.name, path: relativeEntryPath, type: 'file' });
                        }
                    }
                    return results;
                };
                const result = await getFiles(targetPath);
                return res.json(result);
            } else {
                // Serve the file
                if (targetPath.toLowerCase().endsWith('.glb')) {
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                }
                return res.sendFile(targetPath);
            }
        } catch (e) {
            return res.status(404).send('Not Found');
        }
    } else if (req.method === 'PUT') {
        // Authenticate manually within this middleware flow
        authMiddleware(req, res, async () => {
            try {
                await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
                
                if (Buffer.isBuffer(req.body)) {
                    await fs.promises.writeFile(targetPath, req.body);
                } else if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
                    await fs.promises.writeFile(targetPath, JSON.stringify(req.body, null, 2));
                } else {
                    return res.status(400).send('No content provided');
                }
                
                // Perform automated 3D model compression if a .glb file was uploaded
                if (targetPath.toLowerCase().endsWith('.glb') && !targetPath.toLowerCase().endsWith('-low.glb')) {
                    console.log(`[Felslager] Generating low-res 3D model for: ${targetPath}`);
                    const { exec } = require('child_process');
                    const util = require('util');
                    const execPromise = util.promisify(exec);
                    
                    try {
                        // We DO NOT optimize the main model because the user wants original 4K textures and geometry.
                        // We ONLY generate a low-res variant for slow networks (-low.glb)
                        const ext = path.extname(targetPath);
                        const base = path.basename(targetPath, ext);
                        const dir = path.dirname(targetPath);
                        const lowResPath = path.join(dir, `${base}-low${ext}`);
                        
                        // Use resize command to shrink textures to max 512x512 for the low-res model, then optimize it
                        await execPromise(`npx -y @gltf-transform/cli resize "${targetPath}" "${lowResPath}" --width 512 --height 512`);
                        await execPromise(`npx -y @gltf-transform/cli optimize "${lowResPath}" "${lowResPath}" --texture-compress webp`);
                        console.log(`[Felslager] Successfully generated low-res model: ${lowResPath}`);
                    } catch (optError) {
                        console.error('[Felslager] Failed to optimize GLB model:', optError);
                        // We continue so we don't fail the whole upload if compression fails
                    }
                }
                
                return res.status(200).send('File saved successfully');
            } catch (e) {
                return res.status(500).send(e.toString());
            }
        });
    } else if (req.method === 'DELETE') {
        authMiddleware(req, res, async () => {
            try {
                const stats = await fs.promises.stat(targetPath);
                if (stats.isDirectory()) {
                    await fs.promises.rm(targetPath, { recursive: true, force: true });
                } else {
                    await fs.promises.unlink(targetPath);
                }
                return res.status(200).send('Deleted successfully');
            } catch (e) {
                return res.status(500).send(e.toString());
            }
        });
    } else {
        return res.status(405).send('Method Not Allowed');
    }
});

app.listen(PORT, () => {
    console.log(`Felslager API running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
