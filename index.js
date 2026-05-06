const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const chalk = require('chalk');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SESSION_PATH = path.join(__dirname, '.session');

let config, browser, page, isJoining = false, monitorInterval;

if (!fs.existsSync(CONFIG_PATH)) {
    console.log(chalk.red('no config found. run node setup.js first'));
    process.exit(1);
}

config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

async function launch() {
    browser = await puppeteer.launch({
        headless: false,
        executablePath: config.browserPath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--window-size=412,915'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null
    });
    
    page = await browser.newPage();
}

async function auth() {
    const roblosecurity = fs.readFileSync(SESSION_PATH, 'utf8').trim();
    
    await page.goto('https://www.roblox.com', { waitUntil: 'networkidle2', timeout: 60000 });
    
    await page.evaluate((cookie) => {
        document.cookie = `.ROBLOSECURITY=${cookie}; domain=.roblox.com; path=/; secure`;
        document.cookie = `.ROBLOSECURITY=${cookie}; domain=.www.roblox.com; path=/; secure`;
    }, roblosecurity);
    
    await page.reload({ waitUntil: 'networkidle2' });
    
    const check = await page.evaluate(() => {
        return document.cookie.includes('.ROBLOSECURITY');
    });
    
    if (!check) {
        console.log(chalk.red('auth failed'));
        process.exit(1);
    }
    
    console.log(chalk.green('auth ok'));
}

async function join() {
    if (isJoining) return;
    isJoining = true;
    
    try {
        const url = config.serverType === 'private' && config.privateServerLink 
            ? config.privateServerLink 
            : `https://www.roblox.com/games/${config.gameId}/`;
        
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
        console.log(chalk.green(`joined ${config.gameId} - ${new Date().toLocaleTimeString()}`));
        
    } catch (err) {
        console.log(chalk.red(`join error: ${err.message}`));
    }
    
    isJoining = false;
}

async function healthCheck() {
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
            console.log(chalk.yellow('not active, rejoining...'));
            await join();
        }
    } catch (err) {
        console.log(chalk.red(`health check failed: ${err.message}, restarting...`));
        await restart();
    }
}

async function restart() {
    try { if (browser) await browser.close(); } catch (e) {}
    browser = null;
    page = null;
    await launch();
    await auth();
    await join();
}

function startWatcher() {
    monitorInterval = setInterval(healthCheck, config.checkInterval);
    
    cron.schedule('*/5 * * * *', async () => {
        try {
            await page.evaluate(() => true);
        } catch {
            console.log(chalk.yellow('cron: dead, reviving...'));
            await restart();
        }
    });
}

async function main() {
    console.log(chalk.magenta('auto joiner online\n'));
    console.log(chalk.dim(`target: ${config.gameId}`));
    console.log(chalk.dim(`type: ${config.serverType}`));
    console.log(chalk.dim(`interval: ${config.checkInterval}ms\n`));
    
    await launch();
    await auth();
    await join();
    startWatcher();
    
    process.on('SIGINT', async () => {
        clearInterval(monitorInterval);
        if (browser) await browser.close();
        process.exit(0);
    });
    
    process.on('uncaughtException', async (err) => {
        console.log(chalk.red(`crash: ${err.message}`));
        await restart();
    });
}

main();
