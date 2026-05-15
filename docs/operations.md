# Operations Runbook

Day-to-day operational procedures for the Smart Restaurant OS production deployment.

For initial setup and architecture overview, see [deployment.md](deployment.md). For monitoring, alerting, and production readiness, see [monitoring.md](monitoring.md).

---

## Table of Contents

1. [Backup & Restore](#backup--restore)
2. [Health Checks](#health-checks)
3. [Viewing Logs](#viewing-logs)
4. [Service Management](#service-management)
5. [Database Migrations](#database-migrations)
6. [Secret Rotation](#secret-rotation)
7. [Troubleshooting](#troubleshooting)
8. [Operational Checklist](#operational-checklist)

---

## Backup & Restore

### Automated Postgres Backup

```powershell
# PowerShell (Windows)
.\scripts\backup-postgres.ps1

# With custom compose file (e.g., dev)
.\scripts\backup-postgres.ps1 -ComposeFile docker-compose.yml -EnvFile .env
```

**Linux/macOS equivalent:**
```bash
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)

mkdir -p backups
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip' \
  > "backups/backup_${TIMESTAMP}.sql.gz"
```

Backups are saved to `backups/` (git-ignored). The `--clean --if-exists` flags mean the backup includes DROP statements for a clean restore.

### Restore from Backup

```powershell
# PowerShell (Windows) — will prompt for confirmation
.\scripts\restore-postgres.ps1 -BackupFile backups\backup_2026-04-20_120000.sql.gz

# Skip confirmation prompt
.\scripts\restore-postgres.ps1 -BackupFile backups\backup_2026-04-20_120000.sql.gz -Force
```

**Linux/macOS equivalent:**
```bash
echo "WARNING: This will drop and recreate tables. Press Ctrl+C to abort."
read -p "Type 'yes' to continue: " CONFIRM
[ "$CONFIRM" = "yes" ] || exit 0

docker compose -f docker-compose.prod.yml --env-file .env.production stop api
gunzip -c backups/backup_2026-04-20_120000.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction -q'
docker compose -f docker-compose.prod.yml --env-file .env.production start api
```

The restore script:
1. Stops the API to prevent writes during restore
2. Pipes the decompressed SQL into psql with `--single-transaction`
3. Restarts the API after completion

### Backup Schedule Recommendation

For production, set up a cron job or scheduled task:

```
# Example cron (Linux): daily at 02:00
0 2 * * * cd /path/to/project && ./scripts/backup-postgres.sh >> /var/log/backup.log 2>&1
```

Retain at least 7 daily backups. Older backups can be moved to external storage.

### MinIO / Object Storage Backup

MinIO data lives in the `minio-data` Docker volume. To back up:

```bash
# Export the volume to a tarball
docker run --rm -v gp_minio-data:/data -v $(pwd)/backups:/backup alpine \
  tar czf /backup/minio_$(date +%Y-%m-%d).tar.gz -C /data .
```

For production, consider using `mc mirror` (MinIO Client) to sync to external S3-compatible storage.

---

## Health Checks

### Quick Health Check

```bash
# Via Nginx (public)
curl http://localhost/api/health

# Direct to API container
docker compose -f docker-compose.prod.yml exec api wget -qO- http://localhost:4000/api/health

# Nginx health
curl http://localhost/nginx-health

# AI service health
docker compose -f docker-compose.prod.yml exec ai python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read().decode())"
```

### Health Response Format

```json
{
  "service": "api",
  "status": "ok",
  "dependencies": {
    "database": "ok",
    "redis": "ok",
    "ai": "ok"
  }
}
```

| Status | Meaning |
|---|---|
| `ok` | All dependencies healthy |
| `degraded` | Non-critical dependency down (e.g., AI service) |
| `error` | Critical dependency down (database or Redis) |

### Container Health Status

```bash
docker compose -f docker-compose.prod.yml ps
```

Look for `healthy` in the STATUS column. `unhealthy` means the container's healthcheck is failing.

---

## Viewing Logs

### Docker Compose Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f ai

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail 100 api
```

### API Log Format

The API logs HTTP requests in this format:
```
[HTTP] GET /api/health 200 3ms
[HTTP] POST /api/auth/staff/login 201 45ms
[HTTP] GET /api/menu 200 12ms
[HTTP] POST /api/orders 401 2ms    (warn level for 4xx)
[HTTP] GET /api/internal 500 8ms   (error level for 5xx)
```

**Security**: The request logger does NOT log request bodies, authorization headers, cookies, or query strings. Tokens, passwords, OTPs, and payment data are never written to logs.

### Nginx Access Logs

Nginx logs are inside the container at `/var/log/nginx/access.log`:
```bash
docker compose -f docker-compose.prod.yml exec nginx cat /var/log/nginx/access.log | tail -50
```

---

## Service Management

### Rolling Restart

```bash
# Restart a single service (zero-downtime for stateless services)
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart web

# Rebuild and restart (after code changes)
docker compose -f docker-compose.prod.yml up -d --build api
docker compose -f docker-compose.prod.yml up -d --build web
```

### Full Stack Restart

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Note: `down` does NOT remove volumes. Data is preserved. Use `down -v` only to destroy all data (dangerous).

### Scale a Service

```bash
# Run 2 API instances (Nginx will round-robin)
docker compose -f docker-compose.prod.yml up -d --scale api=2
```

---

## Database Migrations

### Deploy Migrations

```bash
# Run pending migrations in production
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy --schema=prisma/schema.prisma
```

Always use `migrate deploy` in production (never `migrate dev`).

### Recovering from a Failed Migration

1. Check migration status:
   ```bash
   docker compose -f docker-compose.prod.yml exec api \
     npx prisma migrate status --schema=prisma/schema.prisma
   ```

2. If a migration failed mid-way, mark it as rolled back:
   ```bash
   docker compose -f docker-compose.prod.yml exec api \
     npx prisma migrate resolve --rolled-back "MIGRATION_NAME" --schema=prisma/schema.prisma
   ```

3. Fix the migration SQL, then re-deploy:
   ```bash
   docker compose -f docker-compose.prod.yml exec api \
     npx prisma migrate deploy --schema=prisma/schema.prisma
   ```

4. If the database is in an inconsistent state, restore from the pre-migration backup.

### Pre-Migration Checklist

1. Take a backup: `.\scripts\backup-postgres.ps1`
2. Review the migration SQL in `apps/api/prisma/migrations/`
3. Run `migrate deploy`
4. Verify with `migrate status`
5. Test the API health endpoint

### Seed Data (Demo Only)

```bash
docker compose -f docker-compose.prod.yml exec api npx tsx prisma/seed.ts
```

The seed script creates demo branches, tables, menu items, and staff accounts with **known passwords**. Never run it on a real production database with customer data.

---

## Secret Rotation

### JWT Secret

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update `JWT_SECRET` in `.env.production`
3. Restart the API: `docker compose -f docker-compose.prod.yml restart api`

**Impact**: All existing staff and customer sessions are invalidated. Users must log in again.

### Payment Webhook Secret

1. Update `PAYMENT_WEBHOOK_SECRET` in `.env.production`
2. Update the corresponding secret in your payment provider's dashboard
3. Restart the API

### Database Password

1. Update `POSTGRES_PASSWORD` in `.env.production`
2. Update the password in `DATABASE_URL` to match
3. Change the password inside Postgres:
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres \
     psql -U postgres -c "ALTER USER postgres PASSWORD 'NEW_PASSWORD';"
   ```
4. Restart the API

### MinIO Password

1. Update `MINIO_ROOT_PASSWORD` in `.env.production`
2. Restart MinIO: `docker compose -f docker-compose.prod.yml restart minio`
3. Update `S3_ENDPOINT` credentials if used by the API

---

## Troubleshooting

### Port Conflicts

```bash
# Check what's using a port (Windows PowerShell)
netstat -ano | findstr :80
netstat -ano | findstr :4000

# Check what's using a port (Linux)
ss -tlnp | grep :80
```

Change the Nginx port if 80 is taken:
```
NGINX_PORT=8080
```

### Docker Volume Issues

```bash
# List volumes
docker volume ls | grep gp_

# Inspect a volume
docker volume inspect gp_postgres-data

# DANGER: Remove all data (irreversible)
docker compose -f docker-compose.prod.yml down -v
```

### Container Won't Start

```bash
# Check logs for the failing container
docker compose -f docker-compose.prod.yml logs --tail 50 api

# Check if healthcheck is failing
docker inspect $(docker compose -f docker-compose.prod.yml ps -q api) --format='{{json .State.Health}}'
```

### API Returns "status: degraded"

The AI service is unavailable. This is non-critical — core features (ordering, KDS, payments) work normally. Check:
```bash
docker compose -f docker-compose.prod.yml logs ai
```

### Database Connection Refused

1. Verify Postgres is running: `docker compose -f docker-compose.prod.yml ps postgres`
2. Check `DATABASE_URL` matches `POSTGRES_USER` and `POSTGRES_PASSWORD`
3. Verify the hostname is `postgres` (Docker service name), not `localhost`

### Redis Connection Refused

1. Verify Redis is running: `docker compose -f docker-compose.prod.yml ps redis`
2. Check `REDIS_URL` uses `redis` as hostname, not `localhost`

### "Cannot find module" Errors in API

Prisma client may be missing. Rebuild the image:
```bash
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml up -d api
```

---

## Operational Checklist

### Daily

- [ ] Verify health: `curl http://localhost/api/health`
- [ ] Check for error logs: `docker compose -f docker-compose.prod.yml logs --tail 100 api | grep ERROR`
- [ ] Run backup: `.\scripts\backup-postgres.ps1`
- [ ] Verify backup file exists and has non-zero size

### Weekly

- [ ] Review backup retention (delete backups older than 30 days)
- [ ] Check disk usage: `docker system df`
- [ ] Review API error rate in logs
- [ ] Test restore on a separate database (if resources allow)

### Before Deployments

- [ ] Take a fresh backup
- [ ] Review migration SQL if any
- [ ] Run migrations
- [ ] Rebuild and restart affected services
- [ ] Verify health endpoint
- [ ] Spot-check key features (login, ordering, KDS)

### Monthly

- [ ] Rotate JWT secret (optional, causes session invalidation)
- [ ] Review Docker image sizes: `docker images smart-restaurant-*`
- [ ] Prune unused Docker resources: `docker system prune -f`
- [ ] Verify backup restore procedure works
