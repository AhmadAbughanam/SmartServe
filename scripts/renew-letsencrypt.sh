#!/usr/bin/env sh
set -eu

DOMAIN="${1:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: scripts/renew-letsencrypt.sh <domain>" >&2
  exit 1
fi

if [ ! -d "certbot/conf/live/$DOMAIN" ]; then
  echo "No certificate state found for $DOMAIN. Run scripts/issue-letsencrypt.sh first." >&2
  exit 1
fi

docker run --rm \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  certbot/certbot renew \
  --webroot \
  --webroot-path /var/www/certbot

cp "certbot/conf/live/$DOMAIN/fullchain.pem" nginx/ssl/cert.pem
cp "certbot/conf/live/$DOMAIN/privkey.pem" nginx/ssl/key.pem

docker compose -f docker-compose.prod.yml --env-file .env.production exec nginx nginx -s reload

echo "Renewal check complete for $DOMAIN and Nginx reloaded."
