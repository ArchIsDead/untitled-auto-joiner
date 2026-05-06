async function watchHealth(browser, config, rejoinCallback) {
    try {
        const pages = await browser.pages();
        let active = false;
        
        for (const p of pages) {
            const url = p.url();
            if (url.includes('roblox.com/games') || url.includes('roblox.com/experiences')) {
                const visible = await p.evaluate(() => !document.hidden).catch(() => false);
                if (visible) active = true;
            }
        }
        
        if (!active) {
            await rejoinCallback();
        }
        
        return active;
    } catch {
        return false;
    }
}

async function periodicCheck(browser, config, rejoinCallback, restartCallback) {
    const active = await watchHealth(browser, config, rejoinCallback);
    
    if (!active) {
        await restartCallback();
    }
}

module.exports = { watchHealth, periodicCheck };
