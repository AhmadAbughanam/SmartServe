# Deployment Guide

This guide describes the production-like deployment of the Smart Restaurant OS using Docker Compose.

## Production Architecture

- **Nginx:** The single public entry point on ports 80/443. It handles SSL termination and acts as a reverse proxy.
- **Web (Next.js):** The frontend application.
- **API (NestJS):** The backend application. It connects to the database and other services.
- **Postgres, Redis, MinIO:** Data services that are only reachable within the Docker network.
- **AI (FastAPI):** An optional service for AI features.

## Production Rollout

Follow these steps for both staging and production deployments.

### 1. Configure Environment

Copy `.env.production.example` to `.env.production` and edit it to replace placeholder secrets and set your domain for `FRONTEND_ORIGIN` and `CORS_ORIGINS`.

Set these required rollout values as well:

- `DEPLOY_DOMAIN=your-domain.com`
- `LETSENCRYPT_EMAIL=ops@your-domain.com`

### 2. Preflight Checks

Run the release gate and the production env/config validation before touching the VPS:

```bash
npm ci
npm run prisma:validate
npm run typecheck
npm run test:critical
npm run audit:security
npm run build
npm run validate:prod-env
docker compose -f docker-compose.prod.yml --env-file .env.production config
```

Initial preflight no longer requires TLS files. TLS file checks run automatically once you pass a live `https://...` URL to the rehearsal command or explicitly set `REQUIRE_TLS_FILES=1`.

For a staging/demo rehearsal that intentionally keeps `PAYMENT_PROVIDER=mock`, use:

```bash
npm run validate:prod-env -- --allow-mock
```

### 3. Back Up Stateful Data

Take backups before each deployment rehearsal and before every migration-bearing rollout:

```bash
npm run db:backup
npm run minio:backup
```

### 4. Start Core Data Services

Bring up the stateful dependencies first:

```bash
npm run docker:prod:core-up
```

### 5. Run Database Migrations

Run migrations before the API is rolled out:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api npx prisma migrate deploy --schema=prisma/schema.prisma
```

### 6. Bootstrap TLS

For a first deployment, use the HTTP-only bootstrap path so Nginx can answer ACME challenges before any TLS files exist:

```bash
./scripts/bootstrap-production.sh your-domain.com ops@your-domain.com
```

That script:

- starts Postgres, Redis, and MinIO
- runs `prisma migrate deploy`
- starts Nginx with `nginx/nginx.http.conf`
- issues the Let's Encrypt certificate
- starts the final HTTPS app stack

If you already have `nginx/ssl/cert.pem` and `nginx/ssl/key.pem`, you can skip the bootstrap script and start the full stack directly:

```bash
npm run docker:prod:up
```

### 7. Run Production Rehearsal

Run the release gates again, this time against the public URL:

```bash
npm run rehearsal:production -- https://your-domain.com
npm run smoke:production -- https://your-domain.com
```

### 8. Seed Data (Optional)

For staging or demo environments, you can seed the database with demo data. **Do not run this in a real production environment.**

```bash
docker compose -f docker-compose.prod.yml exec api npx tsx prisma/seed.ts
```

### 9. Enable Monitoring

Start the monitoring stack:

```bash
npm run monitoring:up
```

Prometheus and Grafana bind to `127.0.0.1` by default. Keep monitoring private and access it through:

- SSH tunnel
- VPN
- or an authenticated reverse proxy

Do not expose monitoring ports publicly on the VPS.

## Rehearsal Smoke Checklist

Verify all of the following:

- HTTPS app load
- API health
- Nginx health
- staff login
- customer OTP login
- httpOnly auth cookies
- menu image upload
- active session conflict rejection
- Stripe low-value payment
- Stripe webhook paid state
- Stripe refund
- logs contain no secrets
- monitoring is not public
- DB backup exists
- MinIO backup exists

## Rollback

Before deployment:

1. Record the current `API_IMAGE`, `WEB_IMAGE`, and `AI_IMAGE` tags or digests.
2. Take a PostgreSQL backup.
3. Take a MinIO backup.

Rollback order:

1. Set `API_IMAGE`, `WEB_IMAGE`, and `AI_IMAGE` back to the previous known-good release.
2. Run `npm run docker:prod:up`.
3. Prefer forward-fix migrations if the schema has already moved.
4. Restore PostgreSQL only when data integrity requires it.
5. Restore MinIO only when object-storage integrity requires it.
