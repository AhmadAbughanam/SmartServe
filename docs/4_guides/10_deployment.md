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

### 2. Preflight Checks

Run the preflight checks to validate your environment and configuration:

```bash
npm run rehearsal:production
```

### 3. Start Services

Start all services using Docker Compose:

```bash
npm run docker:prod:up
```

### 4. Configure TLS

If you haven't already, place your `cert.pem` and `key.pem` files in the `nginx/ssl/` directory. Alternatively, you can use the included Let's Encrypt script to issue a certificate.

### 5. Run Release Gates

Run the release gates again, this time against the public URL:

```bash
npm run rehearsal:production -- https://your-domain.com
npm run smoke:production -- https://your-domain.com
```

### 6. Database Migrations

Run database migrations:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api npx prisma migrate deploy --schema=prisma/schema.prisma
```

### 7. Seed Data (Optional)

For staging or demo environments, you can seed the database with demo data. **Do not run this in a real production environment.**

```bash
docker compose -f docker-compose.prod.yml exec api npx tsx prisma/seed.ts
```

### 8. Enable Monitoring

Start the monitoring stack:

```bash
npm run monitoring:up
```
