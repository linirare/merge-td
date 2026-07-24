#!/bin/bash
# GitHub auto-deploy script for merge-td-gpt
cd /root/merge-td-gpt || exit 1
git pull origin main 2>&1
npm install 2>&1
pm2 restart merge-td 2>&1
echo "DEPLOY_DONE"
