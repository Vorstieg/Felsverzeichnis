const fs = require('fs');
const path = require('path');

const chunksDir = path.join(__dirname, 'build', 'server', 'chunks');
if (!fs.existsSync(chunksDir)) {
    console.log('No chunks directory found, skipping fix.');
    process.exit(0);
}

let fixed = false;
for (const file of fs.readdirSync(chunksDir)) {
    if (file.endsWith('.js')) {
        const filePath = path.join(chunksDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        const targetStr1 = 'const dir = path.dirname(fileURLToPath(import.meta.url));';
        const targetStr2 = 'const dir = path.dirname(fileURLToPath(import.meta.url));\n';
        
        if (content.includes(targetStr1)) {
            content = content.replace(targetStr1, "const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');");
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Fixed static asset path in ${file}`);
            fixed = true;
        }
    }
}

if (!fixed) {
    console.log('Could not find the target string in any chunk.');
}
