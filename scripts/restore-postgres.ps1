<#
.SYNOPSIS
  Restore a PostgreSQL backup into the docker-compose.prod.yml database.

.DESCRIPTION
  Reads a .sql.gz backup file and pipes it into the postgres container.
  WARNING: This is destructive — it drops and recreates tables.

.PARAMETER BackupFile
  Path to the .sql.gz backup file (required).

.PARAMETER ComposeFile
  Docker Compose file to use. Default: docker-compose.prod.yml

.PARAMETER EnvFile
  Environment file for compose. Default: .env.production

.PARAMETER Force
  Skip the confirmation prompt.

.EXAMPLE
  .\scripts\restore-postgres.ps1 -BackupFile backups\backup_2026-04-20_120000.sql.gz
  .\scripts\restore-postgres.ps1 -BackupFile backups\backup_2026-04-20_120000.sql.gz -Force
#>

param(
    [Parameter(Mandatory)]
    [string]$BackupFile,

    [string]$ComposeFile = "docker-compose.prod.yml",
    [string]$EnvFile = ".env.production",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Host "ERROR: Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "=== PostgreSQL Restore ===" -ForegroundColor Cyan
Write-Host "  Compose file : $ComposeFile"
Write-Host "  Env file     : $EnvFile"
Write-Host "  Backup       : $BackupFile"
Write-Host ""
Write-Host "  WARNING: This will DROP existing tables and restore from the backup." -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Type 'yes' to continue"
    if ($confirm -ne "yes") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 0
    }
}

# Verify the postgres container is running
$containerCheck = docker compose -f $ComposeFile --env-file $EnvFile ps postgres --format "{{.State}}" 2>&1
if ($containerCheck -notmatch "running") {
    Write-Host "ERROR: postgres container is not running." -ForegroundColor Red
    exit 1
}

# Stop the API to prevent writes during restore
Write-Host "Stopping API service during restore..." -ForegroundColor Yellow
docker compose -f $ComposeFile --env-file $EnvFile stop api 2>$null

Write-Host "Restoring from backup..." -ForegroundColor Yellow

# Decompress and pipe into psql
Get-Content $BackupFile -Raw -AsByteStream | `
    docker compose -f $ComposeFile --env-file $EnvFile `
    exec -T postgres `
    sh -c 'gunzip | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction -q'

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Restore failed (exit code $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "Restarting API service..." -ForegroundColor Yellow
    docker compose -f $ComposeFile --env-file $EnvFile start api
    exit 1
}

# Restart the API
Write-Host "Restarting API service..." -ForegroundColor Yellow
docker compose -f $ComposeFile --env-file $EnvFile start api

Write-Host ""
Write-Host "Restore complete. API restarted." -ForegroundColor Green
Write-Host "Verify with: docker compose -f $ComposeFile --env-file $EnvFile logs -f api" -ForegroundColor Cyan
