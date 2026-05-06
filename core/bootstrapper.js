const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function setupPersistence() {
    const homeDir = process.env.HOME;
    const bashrcPath = path.join(homeDir, '.bashrc');
    const bootCommand = `\nif pgrep -f "node index.js" > /dev/null; then :; else cd ~/auto-joiner && pm2 start index.js --name auto-joiner; fi`;
    
    try {
        const existing = fs.readFileSync(bashrcPath, 'utf8');
        if (!existing.includes('auto-joiner')) {
            fs.appendFileSync(bashrcPath, bootCommand);
        }
    } catch {
        fs.writeFileSync(bashrcPath, bootCommand);
    }
    
    try {
        execSync('pm2 save', { stdio: 'ignore' });
        execSync('pm2 startup', { stdio: 'ignore' });
    } catch {}
}

function setupTermuxBoot() {
    const bootDir = path.join(process.env.HOME, '.termux/boot');
    
    if (!fs.existsSync(bootDir)) {
        fs.mkdirSync(bootDir, { recursive: true });
    }
    
    const bootScript = `#!/data/data/com.termux/files/usr/bin/bash
sleep 10
cd ~/auto-joiner
pm2 start index.js --name auto-joiner
`;
    
    fs.writeFileSync(path.join(bootDir, 'auto-joiner'), bootScript);
    fs.chmodSync(path.join(bootDir, 'auto-joiner'), '755');
}

module.exports = { setupPersistence, setupTermuxBoot };
