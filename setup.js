const readlineSync = require('readline-sync');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SESSION_PATH = path.join(__dirname, '.session');

console.log(chalk.magenta('setup\n'));

const cookie = readlineSync.question('roblosecurity cookie: ', {
    hideEchoBack: true
});

if (!cookie || cookie.length < 40) {
    console.log(chalk.red('cookie looks wrong'));
    process.exit(1);
}

fs.writeFileSync(SESSION_PATH, cookie.trim());
console.log(chalk.green('cookie saved'));

const serverType = readlineSync.question('\nprivate server? [y/n]: ').toLowerCase();
let gameId, privateLink = null;

if (serverType === 'y') {
    const psLink = readlineSync.question('paste private server link: ');
    const match = psLink.match(/roblox\.com\/games\/(\d+)\/.*\?.*privateServerLinkCode=([a-zA-Z0-9]+)/);
    
    if (!match) {
        console.log(chalk.red('link format looks off'));
        process.exit(1);
    }
    
    gameId = match[1];
    privateLink = match[0];
} else {
    gameId = readlineSync.question('place id: ');
    if (!/^\d+$/.test(gameId)) {
        console.log(chalk.red('numbers only'));
        process.exit(1);
    }
}

const interval = readlineSync.questionInt('check interval ms [default 10000]: ', {
    defaultInput: '10000'
});

const persist = readlineSync.keyInYN('persist across reboots?');

const config = {
    gameId,
    serverType: serverType === 'y' ? 'private' : 'public',
    privateServerLink: privateLink,
    checkInterval: interval,
    persistSession: persist,
    autoReconnect: true,
    maxRetries: -1,
    browserPath: '/data/data/com.termux/files/usr/bin/chromium-browser'
};

fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
console.log(chalk.green('\nsetup done. node index.js to start'));
