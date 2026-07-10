# Removes the scheduled task registered by install-autostart.ps1.
#
# Usage: powershell -File .dev-scripts\uninstall-autostart.ps1

$ErrorActionPreference = 'SilentlyContinue'
$taskName = 'SpeedoraDevWatchdogAutostart'

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "Removed scheduled task '$taskName'."
} else {
  Write-Host "Scheduled task '$taskName' was not registered - nothing to do."
}
