param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,

    [string]$DumpPath = "cloudflare/neon/devchat.sql"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dumpFullPath = Join-Path $root $DumpPath
$dumpDir = Split-Path -Parent $dumpFullPath

New-Item -ItemType Directory -Force -Path $dumpDir | Out-Null

Write-Host "Exporting local DevChat PostgreSQL data to $dumpFullPath ..."
Push-Location $root
try {
    docker compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' | Set-Content -Encoding utf8 $dumpFullPath

    Write-Host "Importing dump into Neon ..."
    Get-Content -Raw $dumpFullPath | docker run --rm -i -e DATABASE_URL="$DatabaseUrl" postgres:16-alpine sh -lc 'psql "$DATABASE_URL"'
}
finally {
    Pop-Location
}

Write-Host "Neon import completed."
