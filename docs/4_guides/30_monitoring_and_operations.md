# Monitoring and Operations

This guide covers the day-to-day operational procedures for the Smart Restaurant OS, including monitoring, alerting, backups, and troubleshooting.

## Monitoring

### Health Endpoints

-   **API Health:** `https://your-domain.com/api/health`
-   **Nginx Health:** `https://your-domain.com/nginx-health`

The API health endpoint provides the status of the API and its dependencies (database, Redis, AI service).

### Prometheus and Grafana

An optional monitoring stack is included with Prometheus, Grafana, Loki, and Promtail. To start it, run:

```bash
npm run monitoring:up
```

-   **Prometheus:** `http://localhost:9090`
-   **Grafana:** `http://localhost:3001`

Pre-configured alerts are available in `monitoring/alert-rules.yml`.

### Log Aggregation

The included monitoring stack also provides log aggregation with Loki and Promtail. Logs from all services can be viewed in Grafana.

To view logs directly from the containers, use `docker compose logs`.

## Operations

### Backups and Restore

-   **Create a backup:** Run `./scripts/backup-postgres.sh` (Linux/macOS) or `.\scripts\backup-postgres.ps1` (Windows).
-   **Restore from a backup:** Run `./scripts/restore-postgres.sh <backup-file>` or `.\scriptsestore-postgres.ps1 -BackupFile <backup-file>`.

It is recommended to schedule daily backups and test the restore procedure regularly.

### Service Management

-   **Restart a service:** `docker compose -f docker-compose.prod.yml restart <service-name>`
-   **Restart the full stack:** `docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d`

### Secret Rotation

To rotate secrets such as `JWT_SECRET`, database passwords, or webhook secrets, update the value in `.env.production` and restart the affected services. Rotating the `JWT_SECRET` will invalidate all existing user sessions.
