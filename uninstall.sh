#!/bin/bash
pm2 stop auto-joiner 2>/dev/null
pm2 delete auto-joiner 2>/dev/null
rm -rf ~/auto-joiner
echo "gone"
