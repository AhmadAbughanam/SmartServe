# Monitoring & Alerting Guide

Monitoring strategy for the Smart Restaurant OS production deployment.

For deployment setup, see [deployment.md](deployment.md). For operations procedures, see [operations.md](operations.md).

---

## Table of Contents

1. [What to Monitor](#what-to-monitor)
2. [Health Endpoints](#health-endpoints)
3. [Recommended Alerts](#recommended-alerts)
4. [Prometheus Setup](#prometheus-setup)
5. [Log Aggregation](#log-aggregation)
6. [Backup Monitoring](#backup-monitoring)
7. [Backup Scheduling](#backup-scheduling)
8. [Production Readiness Checklist](#production-readiness-checklist)
9. [Future Enhancements](#future-enhancements)

---

## What to Monitor

### Critical (Immediate Response)

| Signal | Source | Impact |
|---|---|---|
| API health | `GET /api/health` | Ordering, KDS, payments unavailable |
| Database health | API health → `dependencies.database` | All write operations fail |
| Redis health | API health → `dependencies.redis` | Sessions, caching, rate limiting fail |
| Nginx availability | `GET /nginx-health` | Entire app unreachable |
| Web availability | Frontend loads via Nginx | Customers can't order |

### Warning (Investigate Within Hours)

| Signal | Source | Impact |
|---|---|---|
| AI service health | API health → `dependencies.ai` | Recommendations/chatbot down, core OK |
| MinIO availability | Direct check or API errors | File uploads fail |
| High 5xx error rate | API request logs | Possible bugs or infrastructure issues |
| Disk space low | `docker system df`, host `df` | Containers may fail |
| No backup in 24h | Backup file timestamps | Data loss risk on failure |

### Informational (Review Weekly)

| Signal | Source | Impact |
|---|---|---|
| Auth failure spikes | API logs for 401 responses | Possible brute-force attempts |
| Rate limit triggers | API throttler logs | Bot activity or misconfigured clients |
| Payment webhook failures | API logs for webhook 4xx/5xx | Payment status not updating |
| Request latency P95 | API request logs | User experience degradation |
| Low inventory stock | API `/api/inventory/low-stock` | Menu items may become unavailable |

---

## Health Endpoints

### API Health

```bash
curl http://localhost/api/health
```

Response:
```json
{
  "service": "api",
  "status": "ok",
  "timestamp": "2026-04-20T12:00:00.000Z",
  "dependencies": {
    "database": "ok",
    "redis": "ok",
    "ai": "ok"
  }
}
```

| Status | Meaning | Action |
|---|---|---|
| `ok` | All dependencies healthy | None |
| `degraded` | Non-critical dependency down (AI) | Investigate AI service |
| `error` | Critical dependency down (DB/Redis) | Immediate response |

### Nginx Health

```bash
curl http://localhost/nginx-health
# Returns: "ok"
```

### AI Service Health

```bash
# Direct (within Docker network)
docker compose -f docker-compose.prod.yml exec ai \
  python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read().decode())"
```

Response:
```json
{
  "service": "ai-services",
  "status": "ok",
  "timestamp": "2026-04-20T12:00:00.000Z"
}
```

### Docker Healthcheck Status

```bash
# All containers
docker compose -f docker-compose.prod.yml ps

# Specific container health details
docker inspect --format='{{json .State.Health.Status}}' $(docker compose -f docker-compose.prod.yml ps -q api)
```

---

## Recommended Alerts

### Tier 1: Critical (Page / SMS)

| # | Alert | Condition | Response |
|---|---|---|---|
| 1 | **API Down** | `/api/health` unreachable for 2 min | Check container, restart if needed |
| 2 | **Database Down** | `dependencies.database != "ok"` for 2 min | Check Postgres container and logs |
| 3 | **Redis Down** | `dependencies.redis != "ok"` for 2 min | Check Redis container and logs |
| 4 | **Nginx Down** | `/nginx-health` unreachable for 2 min | Check Nginx container, port conflicts |
| 5 | **Disk Space Critical** | Host disk usage > 90% | Prune Docker, clean old backups |

### Tier 2: Warning (Email / Slack)

| # | Alert | Condition | Response |
|---|---|---|---|
| 6 | **AI Service Down** | `/health` unreachable for 10 min | Non-critical, check AI container |
| 7 | **No Backup in 24h** | Latest backup file > 24h old | Run backup, check scheduler |
| 8 | **High 5xx Rate** | > 5% of requests return 5xx over 5 min | Check API logs for errors |
| 9 | **Auth Failure Spike** | > 50 failed logins in 5 min | Possible brute force, check IP |
| 10 | **Payment Webhook Fail** | Webhook endpoint returns non-200 | Check payment provider config |

### Implementation Options

**Simple (no extra infrastructure):**
- Cron/scheduled task that curls health endpoints and sends email on failure
- Example script: `scripts/health-check.ps1` (not yet created)

**Prometheus + Alertmanager (included configs):**
- Uses `monitoring/prometheus.yml` and `monitoring/alert-rules.yml`
- Alertmanager sends to email, Slack, PagerDuty, etc.

**Cloud-native:**
- AWS CloudWatch, GCP Cloud Monitoring, Azure Monitor
- Uptime monitoring: UptimeRobot, Pingdom, Better Uptime

---

## Prometheus Setup

An optional Prometheus configuration is included in `monitoring/`. It scrapes health endpoints without requiring app-level instrumentation.

### Quick Start

```bash
# Start production stack + monitoring
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml \
  --env-file .env.production up -d

# Open Prometheus UI
# http://localhost:9090
```

### What It Monitors

| Job | Target | Interval | What |
|---|---|---|---|
| `api-health` | `api:4000/api/health` | 15s | API + dependency health |
| `nginx-health` | `nginx:80/nginx-health` | 15s | Nginx availability |
| `ai-health` | `ai:8000/health` | 30s | AI service health |
| `prometheus` | `localhost:9090` | 30s | Prometheus self-monitoring |

### Alert Rules

Pre-configured alerts in `monitoring/alert-rules.yml`:

- **ApiDown**: API unreachable for 2 minutes (critical)
- **NginxDown**: Nginx unreachable for 2 minutes (critical)
- **AiServiceDown**: AI unreachable for 10 minutes (warning)
- **HighScrapeFailureRate**: Prometheus scrape issues (warning)
- **PrometheusStorageHigh**: Storage exceeds 5 GB (warning)

### Adding Alertmanager

1. Create `monitoring/alertmanager.yml`:
   ```yaml
   global:
     smtp_smarthost: 'smtp.gmail.com:587'
     smtp_from: 'alerts@yourdomain.com'
     smtp_auth_username: 'alerts@yourdomain.com'
     smtp_auth_password: 'APP_PASSWORD'

   route:
     receiver: 'email'
     group_wait: 30s
     group_interval: 5m
     repeat_interval: 4h

   receivers:
     - name: 'email'
       email_configs:
         - to: 'team@yourdomain.com'
   ```
2. Uncomment the `alertmanager` service in `docker-compose.monitoring.yml`
3. Uncomment `rule_files` in `monitoring/prometheus.yml`
4. Restart the monitoring stack

### Adding Grafana

1. Uncomment the `grafana` service in `docker-compose.monitoring.yml`
2. Set `GRAFANA_PASSWORD` in `.env.production`
3. Restart: `docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml --env-file .env.production up -d`
4. Open `http://localhost:3001`, log in as `admin`
5. Add Prometheus as a data source: `http://prometheus:9090`

### Adding Database/Redis Exporters

For deeper metrics, add dedicated exporters:

```yaml
# Add to docker-compose.monitoring.yml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter:v0.15.0
  environment:
    DATA_SOURCE_NAME: "postgresql://postgres:PASSWORD@postgres:5432/smart_restaurant?sslmode=disable"
  depends_on:
    - postgres

redis-exporter:
  image: oliver006/redis_exporter:v1.58.0
  environment:
    REDIS_ADDR: "redis://redis:6379"
  depends_on:
    - redis
```

Then uncomment the corresponding scrape configs in `monitoring/prometheus.yml`.

### App-Level Metrics (Future)

For detailed request metrics (latency histograms, error rates by endpoint), add `prom-client` to the API:

```bash
npm install prom-client --workspace=@smart-restaurant/api
```

Then expose a `/api/metrics` endpoint. This is not implemented in Phase 1 to avoid adding dependencies.

---

## Log Aggregation

### Current Approach

Logs go to stdout/stderr (Docker default) and are viewed with:

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service with line limit
docker compose -f docker-compose.prod.yml logs --tail 200 api
docker compose -f docker-compose.prod.yml logs --tail 200 nginx
```

### API Log Format

```
[HTTP] GET /api/health 200 3ms
[HTTP] POST /api/auth/staff/login 201 45ms
[HTTP] GET /api/menu 200 12ms
[HTTP] POST /api/orders 401 2ms        ← warn level (4xx)
[HTTP] GET /api/internal 500 8ms       ← error level (5xx)
```

### Nginx Access Logs

```bash
docker compose -f docker-compose.prod.yml exec nginx \
  cat /var/log/nginx/access.log | tail -50
```

### What Must NOT Be Logged

- JWT tokens or access tokens
- Passwords or password hashes
- OTP codes
- Payment card numbers or CVVs
- Webhook secrets
- Database connection strings with passwords
- Cookie values

The API request logger logs only: HTTP method, path, status code, and response time. No request bodies, headers, or query parameters.

### Recommended Future Stack

**Option A: Loki + Promtail + Grafana (lightweight)**

Best for Docker Compose deployments. Promtail ships container logs to Loki, Grafana provides a query UI.

```yaml
# Add to docker-compose.monitoring.yml
loki:
  image: grafana/loki:2.9.0
  command: -config.file=/etc/loki/local-config.yaml
  volumes:
    - loki-data:/loki

promtail:
  image: grafana/promtail:2.9.0
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - ./monitoring/promtail.yml:/etc/promtail/config.yml:ro
```

**Option B: ELK Stack (heavier)**

Elasticsearch + Logstash + Kibana. More powerful but higher resource usage. Better for large-scale deployments.

**Option C: Managed services**

AWS CloudWatch Logs, GCP Cloud Logging, Datadog, etc. Simplest operationally, requires cloud provider.

---

## Backup Monitoring

### Check Backup Freshness

```powershell
# PowerShell — find latest backup
Get-ChildItem backups\*.sql.gz | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

```bash
# Linux — find latest backup
ls -lt backups/*.sql.gz | head -1
```

### Alert on Missing Backups

Add to a monitoring script or cron job:

```bash
# Alert if no backup file modified in last 24 hours
LATEST=$(find backups -name "*.sql.gz" -mmin -1440 | head -1)
if [ -z "$LATEST" ]; then
  echo "ALERT: No backup in the last 24 hours!"
  # Send notification here
fi
```

---

## Backup Scheduling

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task:
   - **Name**: Smart Restaurant DB Backup
   - **Trigger**: Daily at 02:00
   - **Action**: Start a program
   - **Program**: `powershell.exe`
   - **Arguments**: `-ExecutionPolicy Bypass -File C:\path\to\project\scripts\backup-postgres.ps1`
   - **Start in**: `C:\path\to\project`

Or via PowerShell:

```powershell
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-ExecutionPolicy Bypass -File C:\path\to\project\scripts\backup-postgres.ps1" `
  -WorkingDirectory "C:\path\to\project"

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

Register-ScheduledTask `
  -TaskName "SmartRestaurant-DBBackup" `
  -Action $action `
  -Trigger $trigger `
  -Description "Daily database backup"
```

### Linux Cron

```bash
# Edit crontab
crontab -e

# Add daily backup at 02:00
0 2 * * * cd /path/to/project && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip' > backups/backup_$(date +\%Y-\%m-\%d_\%H\%M\%S).sql.gz 2>> /var/log/backup.log
```

### Backup Retention

Recommended policy:

| Period | Retention | Count |
|---|---|---|
| Daily | 7 days | ~7 backups |
| Weekly | 4 weeks | ~4 backups |
| Monthly | 6 months | ~6 backups |

Retention cleanup (Linux):
```bash
# Delete backups older than 30 days
find backups -name "*.sql.gz" -mtime +30 -delete
```

Retention cleanup (PowerShell):
```powershell
# Delete backups older than 30 days
Get-ChildItem backups\*.sql.gz | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

### Restore Drill Schedule

Test your restore procedure monthly:

1. Take a fresh backup
2. Spin up a temporary Postgres container
3. Restore the backup into it
4. Run a few queries to verify data integrity
5. Remove the temporary container

```bash
# Quick restore test (does NOT touch production)
docker run --rm -d --name pg-test -e POSTGRES_PASSWORD=test postgres:16-alpine
sleep 5
gunzip -c backups/latest.sql.gz | docker exec -i pg-test psql -U postgres -d postgres -q
docker exec pg-test psql -U postgres -d postgres -c "SELECT count(*) FROM \"Staff\";"
docker stop pg-test
```

---

## Production Readiness Checklist

Use this checklist before going live or during periodic reviews.

### Infrastructure

- [ ] All services start and reach `healthy` status
- [ ] Health endpoints respond: `/api/health`, `/nginx-health`
- [ ] Database migrations are up to date (`prisma migrate status`)
- [ ] Docker volumes have adequate disk space

### Security

- [ ] `JWT_SECRET` is a strong random value (not the example)
- [ ] `POSTGRES_PASSWORD` is strong and matches `DATABASE_URL`
- [ ] `MINIO_ROOT_PASSWORD` is changed from default
- [ ] `PAYMENT_WEBHOOK_SECRET` is set (even for mock provider)
- [ ] `CORS_ORIGINS` is set to actual domain (not `*`)
- [ ] `COOKIE_SECURE=true` (when using HTTPS)
- [ ] No demo seed data in production database (unless intentional)
- [ ] `.env.production` is not committed to git

### Backups

- [ ] Backup script tested manually
- [ ] Backup scheduled (daily recommended)
- [ ] Backup retention configured
- [ ] Restore procedure tested on a separate database
- [ ] Backup files are not in the git repository

### Monitoring

- [ ] Health endpoints are monitored (Prometheus, uptime checker, or manual)
- [ ] Alert contacts configured (email, Slack, SMS)
- [ ] Log viewing procedure documented and tested
- [ ] Disk space alerts configured

### Networking

- [ ] HTTPS/TLS configured (or documented as TODO)
- [ ] Nginx security headers present
- [ ] Ports not exposed unnecessarily (DB, Redis are internal-only)
- [ ] Rate limiting active on auth endpoints

### Operations

- [ ] Team knows how to view logs
- [ ] Team knows how to restart services
- [ ] Team knows how to run migrations
- [ ] Team knows how to restore from backup
- [ ] Rollback plan documented for failed deployments
- [ ] Secret rotation procedure known

---

## Future Enhancements

- [ ] App-level Prometheus metrics (`prom-client` + `/api/metrics` endpoint)
- [ ] Grafana dashboards for request latency, error rates, DB connections
- [ ] Alertmanager with email/Slack notifications
- [ ] Log aggregation with Loki + Promtail
- [ ] Postgres and Redis exporters for deeper metrics
- [ ] Uptime monitoring via external service (UptimeRobot, etc.)
- [ ] Automated backup verification (restore test in CI)
- [ ] Performance benchmarking baseline
