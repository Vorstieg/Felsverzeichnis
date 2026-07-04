import paramiko

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

index_content = """const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const authMiddleware = basicAuth({
    users: { [process.env.API_USER || 'admin']: process.env.API_PASSWORD || 'password' },
    challenge: true,
    unauthorizedResponse: 'Unauthorized'
});

app.use('/api/fs', express.raw({ type: '*/*', limit: '500mb' }), async (req, res) => {
    const relativePath = req.path ? decodeURIComponent(req.path) : '/';
    // Remove leading slash to ensure path.join works predictably
    const cleanPath = relativePath.replace(/^\\/+/, '');
    const safeRelativePath = path.normalize(cleanPath).replace(/^(\\.\\.(\\/|\\\\|$))+/, '');
    const targetPath = path.join(DATA_DIR, safeRelativePath);

    console.log("DEBUG TARGET:", targetPath);

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
                        const relativeEntryPath = path.join(baseRoute, entry.name).replace(/\\\\/g, '/');
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
                console.log("DEBUG FILES FOUND:", result.length);
                return res.json(result);
            } else {
                return res.sendFile(targetPath);
            }
        } catch (e) {
            console.error(e);
            return res.status(404).send('Not Found');
        }
    }
});

app.listen(PORT, () => {
    console.log(`Felslager API running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
"""

ssh.exec_command('cat << "EOF" > /home/vorstieg/felslager/index.js\n' + index_content + '\nEOF')
ssh.exec_command("killall node")
import time
time.sleep(1)
ssh.exec_command("cd /home/vorstieg/felslager && nohup /usr/bin/node index.js > /home/vorstieg/felslager/app.log 2>&1 &")
ssh.close()
