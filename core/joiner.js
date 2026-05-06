const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

let browser, page;

async function init(browserPath) {
    browser = await puppeteer.launch({
        headless: false,
        executablePath: browserPath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null
    });
    
    page = await browser.newPage();
    return { browser, page };
}

async function authenticate(page, cookiePath) {
    const roblosecurity = fs.readFileSync(cookiePath, 'utf8').trim();
    
    await page.goto('https://www.roblox.com', { waitUntil: 'networkidle2', timeout: 60000 });
    
    await page.evaluate((cookie) => {
        document.cookie = `.ROBLOSECURITY=${cookie}; domain=.roblox.com; path=/; secure`;
    }, roblosecurity);
    
    await page.reload({ waitUntil: 'networkidle2' });
}

async function joinGame(page, config) {
    const url = config.serverType === 'private' && config.privateServerLink 
        ? config.privateServerLink 
        : `https://www.roblox.com/games/${config.gameId}/`;
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, a, span, div'));
        for (const el of elements) {
            const text = el.textContent.toLowerCase();
            if (text.includes('play') || text.includes('join')) {
                el.click();
                return;
            }
        }
    });
    
    await new Promise(r => setTimeout(r, 5000));
}

async function cleanup() {
    if (browser) await browser.close();
}

module.exports = { init, authenticate, joinGame, cleanup };
