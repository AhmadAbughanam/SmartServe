$root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path (Join-Path $root ".env"))) {
  Copy-Item (Join-Path $root ".env.example") (Join-Path $root ".env")
}

$aiEnv = Join-Path $root "apps/ai-services/.env"
if (-not (Test-Path $aiEnv)) {
  Copy-Item (Join-Path $root "apps/ai-services/.env.example") $aiEnv
}

Write-Host "Environment files are ready."
Write-Host "Next steps:"
Write-Host "  1. docker compose up -d postgres redis minio"
Write-Host "  2. npm.cmd install"
Write-Host "  3. python -m venv .venv"
Write-Host "  4. .\\.venv\\Scripts\\Activate.ps1"
Write-Host "  5. python -m pip install -r apps/ai-services/requirements.txt"
