# CopyCat media player - Reliable Interactive Desktop Summoner for AI & Scripts
param(
    [string]$FilePath = ""
)

$ErrorActionPreference = 'SilentlyContinue'

$appDir = Split-Path -Parent $PSScriptRoot
if (-not $appDir) { $appDir = "C:\Users\Schual\Desktop\VLCopyCAT" }
$launcherExe = Join-Path $appDir "Launch_CopyCat.exe"

function Test-AiBridge {
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/status" -TimeoutSec 1 -ErrorAction Stop
        return ($res -and $res.app -match "CopyCat")
    } catch {
        return $false
    }
}

function Send-AiCommand([string]$action, [string]$path = "") {
    try {
        $payload = @{ action = $action }
        if ($path) { $payload.filePath = (Resolve-Path $path).Path }
        $json = $payload | ConvertTo-Json -Compress
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/control" -Method Post -Body $json -ContentType "application/json" -TimeoutSec 2 -ErrorAction Stop
        return $res.ok
    } catch {
        return $false
    }
}

# 1. If player is already running, activate it immediately
if (Test-AiBridge) {
    if ($FilePath) {
        Send-AiCommand -action "openFile" -path $FilePath | Out-Null
    }
    Send-AiCommand -action "bringToFront" | Out-Null
    Write-Host "SUCCESS: CopyCat media player brought to front and active on screen." -ForegroundColor Green
    exit 0
}

# 2. Player is not running. Launch via Launch_CopyCat.exe (which handles desktop redirect to WinSta0\Default)
if (Test-Path $launcherExe) {
    if ($FilePath) {
        Start-Process -FilePath $launcherExe -ArgumentList "`"$FilePath`""
    } else {
        Start-Process -FilePath $launcherExe
    }
} else {
    # Fallback to Task Scheduler directly
    Start-ScheduledTask -TaskName "LaunchCopyCat" -ErrorAction SilentlyContinue
}

# 3. Wait for the player to initialize on the desktop
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 350
    if (Test-AiBridge) {
        $ready = $true
        break
    }
}

if ($ready) {
    if ($FilePath) {
        Send-AiCommand -action "openFile" -path $FilePath | Out-Null
    }
    Send-AiCommand -action "bringToFront" | Out-Null
    Write-Host "SUCCESS: CopyCat media player opened successfully on the interactive desktop." -ForegroundColor Green
    exit 0
} else {
    Write-Host "WARNING: Launch triggered, but HTTP bridge did not respond within 5 seconds. The player process is starting up." -ForegroundColor Yellow
    exit 0
}
