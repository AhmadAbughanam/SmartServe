#!/usr/bin/env sh
set -eu

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: scripts/issue-letsencrypt.sh <domain> <email>" >&2
  exit 1
fi

mkdir -p certbot/www certbot/conf nginx/ssl

docker run --rm \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

cp "certbot/conf/live/$DOMAIN/fullchain.pem" nginx/ssl/cert.pem
cp "certbot/conf/live/$DOMAIN/privkey.pem" nginx/ssl/key.pem

docker compose -f docker-compose.prod.yml --env-file .env.production up -d nginx

echo "Issued certificate for $DOMAIN and reloaded the production Nginx container."
