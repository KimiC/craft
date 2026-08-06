#!/bin/bash
# Deploy craft.rafter.com.cn from git (run on the ECS server)
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/craft}"
WEB_ROOT="${WEB_ROOT:-/var/www/craft.rafter.com.cn}"
BRANCH="${BRANCH:-main}"

echo "==> Pull latest from git"
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Install dependencies"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "==> Build"
npm run build

echo "==> Publish to $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -av --delete dist/ "$WEB_ROOT/"
sudo chown -R nginx:nginx "$WEB_ROOT"
sudo chmod -R 755 "$WEB_ROOT"

echo "==> Done: http://craft.rafter.com.cn/"
