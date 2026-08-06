#!/bin/bash
# Enable HTTPS for craft.rafter.com.cn
# Works on Aliyun Linux when yum certbot is unavailable (uses pip or acme.sh)
set -euo pipefail

DOMAIN="${DOMAIN:-craft.rafter.com.cn}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
WEB_ROOT="${WEB_ROOT:-/var/www/craft.rafter.com.cn}"
NGINX_CONF="/etc/nginx/conf.d/craft.rafter.com.cn.conf"

echo "==> Domain: $DOMAIN"

install_certbot_pip() {
  echo "==> Install certbot via pip"
  sudo yum install -y python3 python3-pip 2>/dev/null || sudo yum install -y python3-pip
  sudo python3 -m pip install --upgrade pip
  sudo python3 -m pip install certbot certbot-nginx
  sudo ln -sf "$(sudo python3 -m pip show certbot | awk '/Location/ {print $2}')/certbot" /usr/local/bin/certbot 2>/dev/null || true
  export PATH="/usr/local/bin:$PATH"
  certbot --version
}

install_acme_sh() {
  echo "==> Install acme.sh (fallback for Aliyun Linux)"
  curl -fsSL https://get.acme.sh | sh -s "email=$EMAIL"
  export PATH="$HOME/.acme.sh:$PATH"
  source ~/.bashrc 2>/dev/null || true

  echo "==> Issue certificate via webroot"
  "$HOME/.acme.sh/acme.sh" --issue -d "$DOMAIN" -w "$WEB_ROOT"

  echo "==> Install certificate"
  sudo mkdir -p /etc/nginx/ssl
  "$HOME/.acme.sh/acme.sh" --install-cert -d "$DOMAIN" \
    --key-file /etc/nginx/ssl/"$DOMAIN".key \
    --fullchain-file /etc/nginx/ssl/"$DOMAIN".crt \
    --reloadcmd "sudo systemctl reload nginx"

  echo "==> Write nginx SSL config"
  sudo tee "$NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     /etc/nginx/ssl/$DOMAIN.crt;
    ssl_certificate_key /etc/nginx/ssl/$DOMAIN.key;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;

    root $WEB_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
    gzip_min_length 256;
}
EOF
  sudo nginx -t
  sudo systemctl reload nginx
  echo "==> HTTPS ready via acme.sh: https://$DOMAIN/"
  exit 0
}

echo "==> Pre-check nginx"
sudo systemctl is-active nginx >/dev/null
curl -sf -o /dev/null -H "Host: $DOMAIN" "http://127.0.0.1/" || {
  echo "ERROR: nginx not serving $DOMAIN on port 80"
  exit 1
}

if command -v certbot >/dev/null 2>&1; then
  echo "certbot already installed"
elif sudo yum install -y epel-release 2>/dev/null && sudo yum install -y certbot python3-certbot-nginx 2>/dev/null; then
  echo "certbot installed from yum"
else
  echo "yum certbot not available, trying pip..."
  if ! install_certbot_pip 2>/dev/null; then
    echo "pip certbot failed, using acme.sh..."
    install_acme_sh
  fi
fi

if [ ! -f "$NGINX_CONF" ]; then
  REPO="${REPO:-$HOME/craft}"
  sudo cp "$REPO/deploy/nginx.craft.conf.example" "$NGINX_CONF"
  sudo nginx -t && sudo systemctl reload nginx
fi

echo "==> Request certificate with certbot"
sudo certbot --nginx -d "$DOMAIN" --agree-tos --no-eff-email \
  --email "$EMAIL" --non-interactive || \
sudo certbot --nginx -d "$DOMAIN"

sudo certbot renew --dry-run 2>/dev/null || true
echo "==> HTTPS ready: https://$DOMAIN/"
