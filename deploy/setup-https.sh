#!/bin/bash
# Enable HTTPS for craft.rafter.com.cn with Let's Encrypt (certbot)
# Run on ECS as admin: bash deploy/setup-https.sh
set -euo pipefail

DOMAIN="${DOMAIN:-craft.rafter.com.cn}"
EMAIL="${EMAIL:-}"   # optional: export EMAIL=you@example.com

echo "==> Domain: $DOMAIN"

echo "==> Pre-check: nginx running"
sudo systemctl is-active nginx >/dev/null

echo "==> Pre-check: HTTP site responds"
curl -sf -o /dev/null -H "Host: $DOMAIN" "http://127.0.0.1/" || {
  echo "ERROR: nginx is not serving $DOMAIN on port 80."
  echo "Fix nginx first: /etc/nginx/conf.d/craft.rafter.com.cn.conf"
  exit 1
}

echo "==> Install certbot (Aliyun Linux / CentOS)"
if ! command -v certbot >/dev/null 2>&1; then
  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y epel-release 2>/dev/null || true
    sudo yum install -y certbot python3-certbot-nginx 2>/dev/null || \
    sudo yum install -y certbot 2>/dev/null || {
      echo "Trying pip install..."
      sudo pip3 install certbot certbot-nginx
    }
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
  else
    echo "ERROR: unsupported OS. Install certbot manually."
    exit 1
  fi
fi

certbot --version

echo "==> Ensure nginx server block exists"
NGINX_CONF="/etc/nginx/conf.d/craft.rafter.com.cn.conf"
if [ ! -f "$NGINX_CONF" ]; then
  REPO="${REPO:-$HOME/craft}"
  sudo cp "$REPO/deploy/nginx.craft.conf.example" "$NGINX_CONF"
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "==> Request certificate"
CERTBOT_ARGS=(--nginx -d "$DOMAIN" --agree-tos --no-eff-email)
if [ -n "$EMAIL" ]; then
  CERTBOT_ARGS+=(--email "$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

sudo certbot "${CERTBOT_ARGS[@]}"

echo "==> Enable auto-renewal"
if systemctl list-unit-files | grep -q certbot-renew.timer; then
  sudo systemctl enable --now certbot-renew.timer
fi

echo "==> Test renewal (dry run)"
sudo certbot renew --dry-run

echo ""
echo "==> HTTPS ready: https://$DOMAIN/"
echo "If browser still shows HTTP, open https:// explicitly."
echo ""
echo "Aliyun reminder: security group must allow inbound TCP 443."
