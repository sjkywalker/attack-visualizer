[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('up', 'rebuild', 'start', 'stop', 'restart', 'down', 'logs', 'status', 'health', 'help')]
    [string]$Command = 'help'
)

$ErrorActionPreference = 'Stop'
$ProjectDirectory = Split-Path -Parent $PSScriptRoot
$EnvironmentFile = Join-Path $ProjectDirectory '.env'
if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
    throw "Missing runtime configuration: $EnvironmentFile"
}
$ConfiguredPort = $env:ATTVIZ_PORT
if (-not $ConfiguredPort) {
    $PortLine = Get-Content -LiteralPath $EnvironmentFile |
        Where-Object { $_ -match '^\s*ATTVIZ_PORT\s*=' } |
        Select-Object -Last 1
    if ($PortLine) { $ConfiguredPort = ($PortLine -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}
$PortNumber = 0
if (-not [int]::TryParse($ConfiguredPort, [ref]$PortNumber) -or $PortNumber -lt 1 -or $PortNumber -gt 65535) {
    throw 'ATTVIZ_PORT in .env must be an integer between 1 and 65535.'
}
$env:ATTVIZ_PORT = $PortNumber.ToString()

function Show-Usage {
    @'
Usage: .\scripts\docker.ps1 <command>

Commands:
  up        Start existing image in the background
  rebuild   Rebuild the image and start the service
  start     Start a previously stopped service
  stop      Stop the service without removing it
  restart   Restart the service without rebuilding
  down      Stop and remove the container and network
  logs      Follow application logs
  status    Show Compose service status
  health    Query the application health endpoint
'@
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not installed or is not available in PATH.'
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose v2 is required (docker compose).'
}

Push-Location $ProjectDirectory
try {
    switch ($Command) {
        'up'      { docker compose up -d }
        'rebuild' { docker compose up --build -d }
        'start'   { docker compose start }
        'stop'    { docker compose stop }
        'restart' { docker compose restart }
        'down'    { docker compose down }
        'logs'    { docker compose logs -f attack-visualizer }
        'status'  { docker compose ps }
        'health'  {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:$PortNumber/healthz" -TimeoutSec 5
            $response | ConvertTo-Json
        }
        'help'    { Show-Usage }
    }
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
