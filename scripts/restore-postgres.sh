#!/usr/bin/env sh
set -eu

BACKUP_FILE="${1:-}"
COMPOSE_FILE="${2:-docker-compose.prod.yml}"
ENV_FILE="${3:-.env.production}"
FORCE="${FORCE:-0}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: scripts/restore-postgres.sh <backup-file> [compose-file] [env-file]" >&2
  echo "Set FORCE=1 to skip the confirmation prompt." >&2
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "=== PostgreSQL Restore ==="
echo "  Compose file : ${COMPOSE_FILE}"
echo "  Env file     : ${ENV_FILE}"
echo "  Backup       : ${BACKUP_FILE}"
echo
echo "  WARNING: This will DROP existing tables and restore from the backup."
echo

if [ "${FORCE}" != "1" ]; then
  printf "Type 'yes' to continue: "
  read -r CONFIRM
  if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
fi

CONTAINER_STATE="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps postgres --format "{{.State}}" 2>&1 || true)"
if [ "${CONTAINER_STATE}" != "running" ]; then
  echo "ERROR: postgres container is not running." >&2
  exit 1
fi

echo "Stopping API service during restore..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop api >/dev/null 2>&1 || true

echo "Restoring from backup..."
if ! gunzip -c "${BACKUP_FILE}" | \
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" \
    exec -T postgres \
    sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction -q'; then
  echo "ERROR: Restore failed" >&2
  echo "Restarting API service..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" start api >/dev/null 2>&1 || true
  exit 1
fi

echo "Restarting API service..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" start api >/dev/null

echo
echo "Restore complete. API restarted."
echo "Verify with: docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs -f api"
