#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
ENV_FILE="${2:-.env.production}"

BACKUP_DIR="backups"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
FILENAME="backup_${TIMESTAMP}.sql.gz"
OUTPUT_PATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "=== PostgreSQL Backup ==="
echo "  Compose file : ${COMPOSE_FILE}"
echo "  Env file     : ${ENV_FILE}"
echo "  Output       : ${OUTPUT_PATH}"
echo

CONTAINER_STATE="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps postgres --format "{{.State}}" 2>&1 || true)"
if [ "${CONTAINER_STATE}" != "running" ]; then
  echo "ERROR: postgres container is not running." >&2
  echo "Start it with: docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d postgres" >&2
  exit 1
fi

echo "Running pg_dump..."
if ! docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" \
  exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip' \
  > "${OUTPUT_PATH}"; then
  echo "ERROR: pg_dump failed" >&2
  rm -f "${OUTPUT_PATH}"
  exit 1
fi

SIZE_KB="$(du -k "${OUTPUT_PATH}" | awk '{print $1}')"
echo
echo "Backup complete: ${OUTPUT_PATH} (${SIZE_KB} KB)"
