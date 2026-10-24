# 本部 PC で 1 回だけ実行する(管理者の PowerShell)。
#   powershell -ExecutionPolicy Bypass -File hosts\obs\relay-task.ps1 -Ffmpeg <ffmpeg.exe の場所>
# 中継(kosensai-live relay)を PC の起動時に起動するタスクと、SRT の待ち受けのポートの受信の許可を登録する。
# タスクはログオンしていなくても動き、画面を持たない。出力は hosts\obs\.relay\relay.log に追記する。
param([Parameter(Mandatory)][string]$Ffmpeg, [string]$Uv = (Get-Command uv -ErrorAction Stop).Source)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$log = Join-Path $repo 'hosts\obs\.relay\relay.log'
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null

$name = 'kosensai-live relay'
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -WorkingDirectory $repo `
    -Argument "/c `"`"$Uv`" run kosensai-live relay --ffmpeg `"$Ffmpeg`" >> `"$log`" 2>&1`""
$trigger = New-ScheduledTaskTrigger -AtStartup
# S4U: パスワードを保存せずに、ログオンの有無によらず動かす(ネットワークの資格情報は使用しない)。
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
# relay は ffmpeg が無い時などにだけ終了する。終了したら 1 分後に起動し直す。
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Output "タスク「$name」を登録しました(ログ: $log)"

# 受信の許可はポートで指定する(ffmpeg の場所が変わっても外れない)。
$ports = (Get-Content (Join-Path $repo 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json).channels |
    Where-Object { $_.obsListenPort } | ForEach-Object { [string]$_.obsListenPort }
$rule = 'kosensai-live relay (SRT)'
Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol UDP -LocalPort $ports -Action Allow `
    -Profile Private, Public | Out-Null
Write-Output "受信の許可「$rule」を登録しました(UDP $($ports -join ', '))"
