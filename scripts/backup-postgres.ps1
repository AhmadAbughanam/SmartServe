<#
.SYNOPSIS
  Backup PostgreSQL database from docker-compose.prod.yml.

.DESCRIPTION
  Runs pg_dump inside the postgres container and writes a timestamped
  .sql.gz file to the backups/ directory.

.PARAMETER ComposeFile
  Docker Compose file to use. Default: docker-compose.prod.yml

.PARAMETER EnvFile
  Environment file for compose. Default: .env.production

.EXAMPLE
  .\scripts\backup-postgres.ps1
  .\scripts\backup-postgres.ps1 -ComposeFile docker-compose.yml -EnvFile .env
#>

param(
    [string]$ComposeFile = "docker-compose.prod.yml",
    [string]$EnvFile = ".env.production"
)

$ErrorActionPreference = "Stop"

# Ensure backups directory exists
$backupDir = Join-Path $PSScriptRoot ".." "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$filename = "backup_${timestamp}.sql.gz"
$outPath = Join-Path $backupDir $filename

Write-Host "=== PostgreSQL Backup ===" -ForegroundColor Cyan
Write-Host "  Compose file : $ComposeFile"
Write-Host "  Env file     : $EnvFile"
Write-Host "  Output       : $outPath"
Write-Host ""

# Verify the postgres container is running
$containerCheck = docker compose -f $ComposeFile --env-file $EnvFile ps postgres --format "{{.State}}" 2>&1
if ($containerCheck -notmatch "running") {
    Write-Host "ERROR: postgres container is not running." -ForegroundColor Red
    Write-Host "Start it with: docker compose -f $ComposeFile --env-file $EnvFile up -d postgres"
    exit 1
}

# Run pg_dump inside the container, gzip, and stream to host
Write-Host "Running pg_dump..." -ForegroundColor Yellow
docker compose -f $ComposeFile --env-file $EnvFile `
    exec -T postgres `
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip' `
    > $outPath

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pg_dump failed (exit code $LASTEXITCODE)" -ForegroundColor Red
    if (Test-Path $outPath) { Remove-Item $outPath }
    exit 1
}

$size = (Get-Item $outPath).Length
$sizeKB = [math]::Round($size / 1024, 1)
Write-Host ""
Write-Host "Backup complete: $outPath ($sizeKB KB)" -ForegroundColor Green
