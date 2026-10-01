# Щоденний локальний обхід магазинів, які не пускають запити з дата-центрів (ОЛДІ, М2).
# Реєструє завдання Планувальника Windows для поточного користувача:
#   powershell -ExecutionPolicy Bypass -File tools\price-parser\schedule-local.ps1
# Якщо комп'ютер у цей час вимкнено — завдання виконається після ввімкнення.
# Журнал останнього запуску: %LOCALAPPDATA%\moduler-price-parser.log
# Прибрати:  Unregister-ScheduledTask -TaskName "Moduler price parser" -Confirm:$false
param([string]$Sites = "oldi,m2", [string]$At = "10:00")

$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$node = (Get-Command node).Source
$log = Join-Path $env:LOCALAPPDATA "moduler-price-parser.log"
$cmd = "& '$node' tools/price-parser/run.mjs --site=$Sites *> '$log'"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"$cmd`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName "Moduler price parser" -Action $action -Trigger $trigger -Settings $settings `
  -Description "Ціни будматеріалів: щоденний обхід $Sites і запис у CRM Модулер" -Force | Out-Null
Write-Output "Готово: щодня о $At обхід $Sites. Журнал: $log"
