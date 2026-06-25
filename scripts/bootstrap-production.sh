#!/usr/bin/env sh
set -eu

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: scripts/bootstrap-production.sh <domain> <email>" >&2
  exit 1
fi

docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres redis minio

docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
  npx prisma migrate deploy --schema=prisma/schema.prisma

NGINX_CONFIG_PATH=./nginx/nginx.http.conf \
docker compose -f docker-compose.prod.yml --env-file .env.production up -d nginx

./scripts/issue-letsencrypt.sh "$DOMAIN" "$EMAIL"

docker compose -f docker-compose.prod.yml --env-file .env.production up -d ai api web nginx
