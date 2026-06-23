# Deployment Guide

Production-like deployment of the Smart Restaurant OS using Docker Compose.

## Architecture

```
                  ┌─────────┐
  :80             │  Nginx  │
  ────────────────┤ (proxy) │
                  └────┬────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
     ┌────▼────┐  ┌────▼────┐      │
     │   Web   │  │   API   │      │
     │ Next.js │  │ NestJS  │      │
     │  :3000  │  │  :4000  │      │
     └─────────┘  └────┬────┘      │
                       │           │
          ┌────────────┼───────────┼────────────┐
          │            │           │            │
     ┌────▼────┐  ┌────▼────┐ ┌───▼───┐  ┌────▼────┐
     │ Postgres│  │  Redis  │ │ MinIO │  │   AI    │
     │  :5432  │  │  :6379  │ │ :9000 │  │ FastAPI │
     └─────────┘  └─────────┘ └───────┘  │  :8000  │
                                          └─────────┘
```

- **Nginx** is the single entry point on port 80. It routes `/api/*` to the API and all other traffic to the Web app.
- **Web** is a standalone Next.js build. `NEXT_PUBLIC_API_BASE_URL` is set to empty string at build time so browser-side API calls go through Nginx (same origin).
- **API** is a compiled NestJS server. It connects to Postgres and Redis via Docker-internal hostnames.
- **Postgres**, **Redis**, and **MinIO** are not exposed to the host by default — only reachable inside the Docker network.
- **AI** is optional for core operations. In production compose, API startup is gated by Postgres and Redis, not by AI health; `/api/health` reports AI as degraded/unavailable when it is down.

## Prerequisites

- Docker Engine 20+ and Docker Compose v2
- The repository cloned locally
- Ports 80 (Nginx) free on the host

## Quick Start

```bash
# 1. Copy and edit the production env file
cp .env.production.example .env.production
# Edit .env.production — at minimum change:
#   POSTGRES_PASSWORD, JWT_SECRET, MINIO_ROOT_PASSWORD
#   Make sure DATABASE_URL password matches POSTGRES_PASSWORD

# 2. Build and start all services
npm run docker:prod:build
npm run docker:prod:up

# 3. Run database migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy --schema=prisma/schema.prisma

# 4. (Optional) Seed demo data — for demo/testing only
docker compose -f docker-compose.prod.yml exec api npx tsx prisma/seed.ts

# 5. Open http://localhost in your browser
```

## Scripts Reference

| Script | Description |
|---|---|
| `npm run typecheck:api` | Typecheck the NestJS API workspace |
| `npm run typecheck:web` | Typecheck the Next.js web workspace |
| `npm run build:api` | Build the API workspace, including Prisma generate |
| `npm run build:web` | Build the web workspace |
| `npm run test:critical` | Run critical backend business/security tests |
| `npm run smoke:health` | Check `/api/health` without requiring seed data |
| `npm run docker:prod:build` | Build production Docker images |
| `npm run docker:prod:up` | Start all production services (detached) |
| `npm run docker:prod:down` | Stop and remove production containers |
| `npm run docker:prod:logs` | Tail logs from all services |
| `npm run prisma:deploy` | Run migrations (from host, requires DATABASE_URL) |

## CI/CD Verification

GitHub Actions validation workflow: `.github/workflows/ci.yml`.

The CI job runs on Ubuntu with PostgreSQL and Redis service containers. It performs:

1. `npm ci`
2. `npm run prisma:validate`
3. `npm run prisma:generate`
4. `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma`
5. `npm run typecheck`
6. `npm run test:critical`
7. `npm run build:web`
8. `npm run build:api`

The local Windows Prisma `EPERM` issue should not apply to CI because the Ubuntu runner is not expected to hold the generated Windows query engine file open.

GitHub Actions image release workflow: `.github/workflows/release-images.yml`.

The release workflow runs on:

- pushes to `main`
- version tags such as `v1.0.0`
- manual `workflow_dispatch`

It publishes these images to GHCR:

- `ghcr.io/<owner>/smart-restaurant-os-api`
- `ghcr.io/<owner>/smart-restaurant-os-web`
- `ghcr.io/<owner>/smart-restaurant-os-ai`

Tags include the branch ref, Git tag, commit SHA, and `latest` on `main`.

## Environment Variables

All production environment variables are documented in `.env.production.example`. Key variables:

### Required

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Database password (used by Postgres container) |
| `DATABASE_URL` | Full Postgres connection string (password must match above) |
| `JWT_SECRET` | 64-byte hex secret for JWT signing |

### Security

| Variable | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost` | Comma-separated allowed origins |
| `FRONTEND_ORIGIN` | `http://localhost` | Used for CSP headers |
| `COOKIE_SECURE` | `true` in production | API forces secure cookies when `NODE_ENV=production`; use HTTPS for browser cookie flows |
| `COOKIE_SAME_SITE` | `lax` | Cookie SameSite policy |
| `COOKIE_DOMAIN` | (unset) | Set to `.yourdomain.com` for cross-subdomain cookies |

### Geo-Fencing

| Variable | Default | Description |
|---|---|---|
| `GEOFENCING_ENABLED` | `true` | Global switch for backend geo-fencing checks |
| `GEOFENCING_DEMO_BYPASS` | `false` | Explicit non-production bypass for demos only; ignored in production |
| `GEOFENCING_DEFAULT_RADIUS_M` | `100` | Default branch radius for new configuration |
| `GEOFENCING_MAX_ACCURACY_M` | `1000` | Reject browser locations less accurate than this many meters |

Customer QR/table session start is enforced by the API when the target branch has `geofenceEnabled=true`. Do not enable `GEOFENCING_DEMO_BYPASS` in production.

### Provider Validation

The API validates environment variables at startup:

- `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` are required.
- URL-shaped values such as Redis, AI, S3, frontend, and CORS origins must parse as URLs.
- `PAYMENT_PROVIDER` must be `mock` or `stripe`.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are required only when `PAYMENT_PROVIDER=stripe`.
- `JWT_SECRET` must be at least 32 characters when `NODE_ENV=production`.
- Geo-fencing booleans and numeric thresholds are validated at startup.

`PAYMENT_PROVIDER=mock` is useful for demos and staging without real external capture. Use a real gateway before accepting real customer payments.

### Build-Time (Web)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `""` (empty) | Empty = same-origin via Nginx. Set full URL if API is on a different origin. |

## Database Migrations

Migrations use Prisma Migrate. In production, always use `migrate deploy` (never `migrate dev`).

```bash
# Run from inside the API container
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Seed Data

The seed script populates demo data (branches, tables, menu items, staff accounts). It is intended for **demo and development only**.

```bash
# Only run if you want demo data
docker compose -f docker-compose.prod.yml exec api npx tsx prisma/seed.ts
```

Do not run the seed script in a real production environment — it creates accounts with known passwords.

## Health Checks

| Service | Endpoint | Method |
|---|---|---|
| Nginx | `http://localhost/nginx-health` | GET |
| API | `http://localhost/api/health` (via Nginx) | GET |
| API (direct) | Container-internal `:4000/api/health` | GET |
| Postgres | `pg_isready` (Docker healthcheck) | — |
| Redis | `redis-cli ping` (Docker healthcheck) | — |

The API health endpoint returns:
```json
{
  "service": "api",
  "status": "ok",
  "timestamp": "2026-05-11T00:00:00.000Z",
  "environment": "production",
  "version": "0.1.0",
  "commit": "unknown",
  "dependencies": {
    "database": "ok",
    "redis": "ok",
    "ai": "unavailable"
  }
}
```

`status: "degraded"` means a non-critical dependency (AI service) is unavailable. Core functionality still works.

After deployment, run:

```bash
npm run smoke:health -- http://localhost
```

Use `npm run smoke -- http://localhost` only after migrations and demo seed data are present.

## Docker Images

### API (apps/api/Dockerfile)

Three-stage multi-stage build:

1. **deps** — Installs all npm dependencies (including build tools for bcrypt native bindings)
2. **build** — Generates Prisma client, compiles TypeScript to `dist/`
3. **production** — Clean Alpine image with production dependencies only, compiled output, and Prisma client

### Web (apps/web/Dockerfile)

Three-stage multi-stage build:

1. **deps** — Installs all npm dependencies
2. **build** — Builds Next.js with `output: "standalone"` (includes only required node_modules)
3. **production** — Minimal image running the standalone Next.js server

### Build Notes

- `NEXT_PUBLIC_API_BASE_URL` is a build argument — it must be set at image build time, not runtime.
- bcrypt requires native compilation. The API Dockerfile installs build tools in stage 1 and 3 (then removes them).
- Both Dockerfiles build from the repo root context (needed for npm workspace resolution).

## HTTPS Setup

The Nginx config includes commented placeholders for HTTPS. To enable:

1. Obtain SSL certificates (Let's Encrypt, self-signed, etc.)
2. Place `cert.pem` and `key.pem` in `nginx/ssl/`
3. Uncomment the SSL lines in `nginx/nginx.conf`
4. Uncomment the port 443 mapping in `docker-compose.prod.yml`
5. Set `COOKIE_SECURE=true` in `.env.production`
6. Update `CORS_ORIGINS` and `FRONTEND_ORIGIN` to use `https://`

## Troubleshooting

### API fails to start — "Missing required environment variable"

Ensure `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` are set in `.env.production`.

### API shows "status: degraded"

The AI service may not be running. Core features (ordering, KDS, payments) work normally without it. Check AI logs: `docker compose -f docker-compose.prod.yml logs ai`

### Database connection refused

The API waits for Postgres to be healthy (via `depends_on` + healthcheck). If it still fails:
```bash
# Check Postgres logs
docker compose -f docker-compose.prod.yml logs postgres

# Verify DATABASE_URL matches POSTGRES_USER and POSTGRES_PASSWORD
```

### "Cannot find module" errors in API

Ensure the Prisma client was generated during build. Rebuild:
```bash
npm run docker:prod:build --no-cache
```

### Known Windows Prisma EPERM issue

On Windows development machines, `prisma generate` can fail with an error similar to:

```text
EPERM: operation not permitted, rename
node_modules\.prisma\client\query_engine-windows.dll.node.tmp...
-> node_modules\.prisma\client\query_engine-windows.dll.node
```

This usually means a Node process, API watcher, editor extension, antivirus scanner, or previous test process is holding the generated Prisma query engine file open.

Recommended local workaround:

1. Stop API dev servers, test watchers, and Prisma Studio.
2. Check for running Node processes and stop the stale process if needed.
3. Retry `npm run prisma:generate --workspace @smart-restaurant/api`.
4. If it persists, restart the terminal or machine, then rerun the command.

This is a local file-locking issue, not a TypeScript compilation failure. `npm run typecheck --workspace @smart-restaurant/api` can still pass while the API build is blocked at `prisma generate`.

### Web shows blank page or API errors

Check that `NEXT_PUBLIC_API_BASE_URL` was set correctly at build time. For same-origin Nginx setups, it should be empty string. Rebuild the web image if you change it.

### Port 80 already in use

Change the Nginx port:
```bash
NGINX_PORT=8080 npm run docker:prod:up
```

Or set `NGINX_PORT=8080` in `.env.production`.

## Local Development (Unchanged)

The dev workflow is unaffected. Continue using:

```bash
npm run dev:infra    # Start Postgres + Redis (dev ports 5435, 6380)
npm run dev:api      # Start API with tsx watch
npm run dev:web      # Start Next.js dev server
```

The dev `docker-compose.yml` and production `docker-compose.prod.yml` are completely independent.

## Operations

For day-to-day operations, backup/restore, secret rotation, and troubleshooting, see [operations.md](operations.md).

## Monitoring

For monitoring strategy, alerting, Prometheus setup, backup scheduling, and production readiness checklist, see [monitoring.md](monitoring.md).

## Known Limitations

- **No HTTPS** — TLS termination requires certificates. Nginx config has placeholders but no automation (e.g., certbot).
- **No Kubernetes** — This setup uses Docker Compose only. K8s manifests are out of scope for this phase.
- **No CI/CD pipeline** — Images must be built manually. A future phase could add GitHub Actions to build and push images.
- **No external database** — Postgres runs in a container. For production, consider a managed database (RDS, Cloud SQL, etc.) and update `DATABASE_URL` accordingly.
- **No log aggregation** — Logs go to stdout/stderr. Loki/ELK setup documented in [monitoring.md](monitoring.md) but not deployed.
- **MinIO is development-grade** — For production object storage, consider S3 or a managed MinIO instance.
- **Payment provider finalization** — Gateway logic is adapter-based, but real provider credentials, live webhook secrets, and provider-specific operational runbooks must be finalized before production.
- **AI service optionality** — Core restaurant operations work without the AI service. Production AI usage needs provider monitoring, cost controls, and data retention review.

## Production TODOs (Future Phases)

- [ ] HTTPS with Let's Encrypt / certbot
- [ ] CI/CD pipeline to build and push images
- [ ] App-level Prometheus metrics (`prom-client`)
- [ ] Grafana dashboards
- [ ] Log aggregation (Loki + Promtail)
- [ ] Rate limiting at Nginx level
- [ ] Horizontal scaling (multiple API/Web replicas behind Nginx)
- [ ] Managed database migration
- [ ] Real payment gateway integration
- [ ] Real SMS provider integration
