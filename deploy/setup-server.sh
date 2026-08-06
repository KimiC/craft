#!/bin/bash
# One-time server setup for git-based deploy (run on ECS as admin)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Raft-chen/craft.git}"
REPO_DIR="${REPO_DIR:-$HOME/craft}"
WEB_ROOT="${WEB_ROOT:-/var/www/craft.rafter.com.cn}"

echo "==> Install git"
if command -v yum >/dev/null 2>&1; then
  sudo yum install -y git
elif command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update && sudo apt-get install -y git
fi

echo "==> Check Node.js (need v18+)"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install with:"
  echo "  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -"
  echo "  sudo yum install -y nodejs"
  exit 1
fi
node -v
npm -v

echo "==> Clone repo"
if [ -d "$REPO_DIR/.git" ]; then
  echo "Repo already exists at $REPO_DIR"
else
  git clone "$REPO_URL" "$REPO_DIR"
fi

echo "==> nginx web root"
sudo mkdir -p "$WEB_ROOT"

echo "==> First deploy"
chmod +x "$REPO_DIR/deploy/deploy.sh"
REPO_DIR="$REPO_DIR" WEB_ROOT="$WEB_ROOT" bash "$REPO_DIR/deploy/deploy.sh"

echo "==> Setup complete"
