# Starts apps/api and apps/worker, each supervised by its own watchdog.ps1
# instance, for resilient local development on this machine. Each watchdog
# is itself launched detached (Start-Process, not awaited) so it keeps
# running independent of whatever shell/tool session started it - see
# watchdog.ps1's own comment for why that matters.
#
# Also registered (see install-autostart.ps1) to run automatically at user
# logon, so a machine reboot doesn't silently leave api/worker down until
# someone remembers to run this by hand.
#
# Usage: powershell -File .dev-scripts\start.ps1
# Stop everything:  powershell -File .dev-scripts\stop.ps1
# Check status:      powershell -File .dev-scripts\status.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent

function Start-Watchdog {
  param([string]$AppName, [string]$AppDir)

  # Fast-path check only - the AUTHORITATIVE single-instance guard is inside
  # watchdog.ps1 itself (it re-checks and refuses to run a duplicate even if
  # launched some other way than through this script). This check here just
  # avoids spawning a redundant process at all in the common case.
  $existingPidFile = Join-Path $PSScriptRoot "$AppName.watchdog.pid"
  if (Test-Path $existingPidFile) {
    $existingPid = Get-Content $existingPidFile
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
      Write-Host "$AppName watchdog already running (pid $existingPid) - skipping"
      return
    }
  }

  # watchdog.ps1 writes its OWN pid to $existingPidFile on startup (after
  # its own uniqueness check) - not done here, to avoid two writers racing
  # on the same file.
  $proc = Start-Process -FilePath 'powershell' -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    (Join-Path $PSScriptRoot 'watchdog.ps1'),
    '-AppName', $AppName, '-AppDir', $AppDir
  ) -WindowStyle Hidden -PassThru
  Write-Host "$AppName watchdog launched (pid $($proc.Id))"
}

Start-Watchdog -AppName 'api' -AppDir (Join-Path $repoRoot 'apps\api')
Start-Watchdog -AppName 'worker' -AppDir (Join-Path $repoRoot 'apps\worker')

Write-Host "`nGive it a few seconds, then check: powershell -File .dev-scripts\status.ps1"
