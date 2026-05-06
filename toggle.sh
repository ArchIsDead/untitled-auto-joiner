#!/bin/bash
STATE_FILE=~/.state

if [ ! -f "$STATE_FILE" ] || [ "$(cat $STATE_FILE)" = "off" ]; then
    echo "on" > "$STATE_FILE"
    termux-notification --id autojoiner --title "status: running" --content "target active" --ongoing --priority max
    pm2 restart auto-joiner
else
    echo "off" > "$STATE_FILE"
    termux-notification --id autojoiner --title "status: paused" --content "tap to resume" --ongoing --priority max
    pm2 stop auto-joiner
fi
