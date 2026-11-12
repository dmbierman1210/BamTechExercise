<#
.SYNOPSIS
  Starts the ACTS API (http://localhost:5204) and the UI (http://localhost:4200) together, against the real API.
.DESCRIPTION
  Run from anywhere: .\scripts\start.ps1
  Pass -Mock to start the UI against the stateful mock API (http://localhost:3000) instead of the API.
  Press Ctrl+C to stop both. The API creates and seeds api\starbase.db on first start (Development).
#>
param([switch]$Mock)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ui = Join-Path $root 'ui'
$npm = if ($IsLinux -or $IsMacOS) { 'npm' } else { 'npm.cmd' }

if (-not (Test-Path (Join-Path $ui 'node_modules'))) {
  Push-Location $ui
  try { & $npm ci } finally { Pop-Location }
}

if ($Mock) {
  Push-Location $ui
  try { & $npm run start:with-mock } finally { Pop-Location }
  return
}

function Stop-Tree($process) {
  if ($process -and -not $process.HasExited) {
    if ($IsLinux -or $IsMacOS) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue }
    else { taskkill /PID $process.Id /T /F | Out-Null }
  }
}

$env:ASPNETCORE_ENVIRONMENT = 'Development'
Write-Host 'Starting the API on http://localhost:5204 and the UI on http://localhost:4200 (Ctrl+C stops both)...'
$api = Start-Process dotnet -ArgumentList @('run', '--project', (Join-Path $root 'api'), '--no-launch-profile', '--urls', 'http://localhost:5204') -NoNewWindow -PassThru
$app = Start-Process $npm -ArgumentList @('run', 'start') -WorkingDirectory $ui -NoNewWindow -PassThru

try {
  while (-not $api.HasExited -and -not $app.HasExited) { Start-Sleep -Seconds 1 }
  Write-Warning 'One of the two processes ended; stopping the other.'
} finally {
  Stop-Tree $api
  Stop-Tree $app
}
