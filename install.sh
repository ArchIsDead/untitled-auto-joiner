#!/bin/bash
pkg update -y && pkg upgrade -y
pkg install nodejs chromium git termux-api termux-services -y
npm install -g pm2
cd ~/auto-joiner
npm install
echo "done. run 'node setup.js'"
