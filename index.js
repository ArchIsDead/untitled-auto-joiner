const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { execSync, spawn } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SESSION_PATH = path.join(__dirname, '.session');
const STATE_PATH = path.join(__dirname, '.state');

let config, browser, page, isJoining = false, monitorInterval;
let toggleActive = true;

if (!fs.existsSync(CONFIG_PATH)) {
    console.log('no config found. run node setup.js first');
    process.exit(1);
}

config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

function loadToggle() {
    if (fs.existsSync(STATE_PATH)) {
        toggleActive = fs.readFileSync(STATE_PATH, 'utf8').trim() === 'on';
    }
}

function saveToggle() {
    fs.writeFileSync(STATE_PATH, toggleActive ? 'on' : 'off');
}

function sendNotify(title, content, action) {
    try {
        const cmd = `termux-notification --title "${title}" --content "${content}" --action "${action}"`;
        execSync(cmd);
    } catch {}
}

function toggleMenu() {
    const actions = [
        'start;termux-notification-remove autojoiner && echo on > ~/auto-joiner/.state && pm2 restart auto-joiner',
        'stop;termux-notification-remove autojoiner && echo off > ~/auto-joiner/.state && pm2 stop auto-joiner'
    ];
    
    execSync(`termux-dialog radio -t "auto joiner" -v "${actions.join(',')}"`);
}

async function launch() {
    browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--single-process',
            '--no-zygote'
        ]
    });
    
    page = await browser.newPage();
}

async function auth() {
    const roblosecurity = fs.readFileSync(SESSION_PATH, 'utf8').trim();
    
    await page.goto('https://www.roblox.com', { waitUntil: 'networkidle2', timeout: 60000 });
    
    await page.evaluate((cookie) => {
        document.cookie = '.ROBLOSECURITY=' + cookie + '; domain=.roblox.com; path=/; secure';
        document.cookie = '.ROBLOSECURITY=' + cookie + '; domain=.www.roblox.com; path=/; secure';
    }, roblosecurity);
    
    await page.reload({ waitUntil: 'networkidle2' });
}

async function join() {
    if (!toggleActive || isJoining) return;
    isJoining = true;
    
    try {
        const url = config.serverType === 'private' && config.privateServerLink 
            ? config.privateServerLink 
            : 'https://www.roblox.com/games/' + config.gameId + '/';
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));
        
        await page.evaluate(() => {
            const elements = document.querySelectorAll('button, a, span, div');
            for (const el of elements) {
                const text = el.textContent.toLowerCase();
                if (text.includes('play') || text.includes('join') || 
                    el.getAttribute('data-testid') === 'play-button') {
                    el.click();
                    return;
                }
            }
        });
        
        await new Promise(r => setTimeout(r, 5000));
        sendNotify('joined', 'game: ' + config.gameId, 'autojoiner');
        
    } catch (err) {}
    
    isJoining = false;
}

async function healthCheck() {
    loadToggle();
    
    if (!toggleActive) {
        sendNotify('paused', 'tap to resume', 'autojoiner');
        return;
    }
    
    try {
        const pages = await browser.pages();
        let active = false;
        
        for (const p of pages) {
            const url = p.url();
            if (url.includes('roblox.com')) {
                const visible = await p.evaluate(() => !document.hidden).catch(() => false);
                if (visible) active = true;
            }
        }
        
        if (!active) {
            sendNotify('reconnecting', 'joining game...', 'autojoiner');
            await join();
        }
    } catch (err) {
        await restart();
    }
}

async function restart() {
    try { if (browser) await browser.close(); } catch (e) {}
    browser = null;
    page = null;
    await launch();
    await auth();
    if (toggleActive) await join();
}

function showPersistentNotify() {
    const status = toggleActive ? 'running' : 'paused';
    sendNotify('status: ' + status, 'tap notification to toggle', 'autojoiner');
}

function startWatcher() {
    monitorInterval = setInterval(async () => {
        await healthCheck();
        showPersistentNotify();
    }, config.checkInterval);
}

async function main() {
    loadToggle();
    
    await launch();
    await auth();
    if (toggleActive) await join();
    
    showPersistentNotify();
    startWatcher();
    
    process.on('SIGINT', async () => {
        clearInterval(monitorInterval);
        if (browser) await browser.close();
        execSync('termux-notification-remove autojoiner');
        process.exit(0);
    });
}

main();
