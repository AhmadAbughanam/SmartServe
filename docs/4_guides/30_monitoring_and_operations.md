# Monitoring and Operations

This guide covers the day-to-day operational procedures for the Smart Restaurant OS, including monitoring, alerting, backups, rollback readiness, and troubleshooting.

## Monitoring

### Health Endpoints

- **API Health:** `https://your-domain.com/api/health`
- **Nginx Health:** `https://your-domain.com/nginx-health`

The API health endpoint provides the status of the API and its dependencies (database, Redis, AI service).

### Prometheus and Grafana

An optional monitoring stack is included with Prometheus, Grafana, Loki, and Promtail. To start it, run:

```bash
npm run monitoring:up
```

- **Prometheus:** `http://localhost:9090`
- **Grafana:** `http://localhost:3001`

These ports bind to `127.0.0.1` by default in the monitoring overlay. Keep them private in production and access them only through:

- SSH tunnel
- VPN
- or an authenticated reverse proxy

Treat public monitoring exposure as a deployment blocker.

Pre-configured alerts are available in `monitoring/alert-rules.yml`.

### Log Aggregation

The included monitoring stack also provides log aggregation with Loki and Promtail. Logs from all services can be viewed in Grafana.

To view logs directly from the containers, use `docker compose logs`.

## Operations

### Backups and Restore

- **Create a PostgreSQL backup:** Run `./scripts/backup-postgres.sh` (Linux/macOS) or `.\scripts\backup-postgres.ps1` (Windows).
- **Restore a PostgreSQL backup:** Run `./scripts/restore-postgres.sh <backup-file>` or `.\scripts\restore-postgres.ps1 -BackupFile <backup-file>`.
- **Back up MinIO/object storage:** Run `npm run minio:backup`.
- **Restore MinIO/object storage:** Run `npm run minio:restore -- <backup-file>`.

Only pass `--force` to the MinIO restore command when you explicitly intend to overwrite existing object-storage data.

It is recommended to schedule daily backups and test the restore procedure regularly.

Before any production rollout:

1. Record the currently deployed `API_IMAGE`, `WEB_IMAGE`, and `AI_IMAGE` tags or digests.
2. Run the PostgreSQL backup.
3. Run the MinIO backup.
4. Validate `.env.production` with `npm run validate:prod-env`.

### Rollback

Preferred rollback order:

1. Roll the app back first by restoring the previous `API_IMAGE`, `WEB_IMAGE`, and `AI_IMAGE` values.
2. Run `npm run docker:prod:up`.
3. Prefer forward-fix migrations if the schema has already moved.
4. Restore PostgreSQL only when data integrity is broken and a forward fix is not sufficient.
5. Restore MinIO only when object-storage integrity is broken and a forward fix is not sufficient.

### Service Management

- **Restart a service:** `docker compose -f docker-compose.prod.yml restart <service-name>`
- **Restart the full stack:** `docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d`

### Secret Rotation

To rotate secrets such as `JWT_SECRET`, database passwords, or webhook secrets, update the value in `.env.production` and restart the affected services. Rotating the `JWT_SECRET` will invalidate all existing user sessions.
