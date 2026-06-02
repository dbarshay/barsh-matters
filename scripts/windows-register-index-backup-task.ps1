# Barsh Matters Windows backup scheduler helper.
# Run in PowerShell as the Windows user that should own the scheduled backup.
# This is for a future Windows dedicated host only. Normal Windows users accessing the app in a browser do not need this.

$ErrorActionPreference = "Stop"

$Repo = "C:\barsh-matters\clio-lawsuit-aggregator"
$TaskName = "Barsh Matters Index Backup"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$Repo'; npm run backup:indexes`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Runs Barsh Matters local PostgreSQL database/index backup every 15 minutes." -Force

Write-Host "PASS: Registered Windows scheduled task: $TaskName"
