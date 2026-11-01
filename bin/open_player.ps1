# CopyCat media player - Reliable Interactive Desktop Summoner for AI & Scripts
param(
    [string]$FilePath = "",
    [double]$Seek = -1,
    [switch]$Close,
    [switch]$Restore
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

function Send-AiCommand([hashtable]$payload) {
    try {
        $json = $payload | ConvertTo-Json -Compress
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/control" -Method Post -Body $json -ContentType "application/json" -TimeoutSec 2 -ErrorAction Stop
        return $res.ok
    } catch {
        return $false
    }
}

if ($Close) {
    if (Test-AiBridge) {
        Send-AiCommand @{ action = "close" } | Out-Null
        Start-Sleep -Milliseconds 500
    }
    Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
    Write-Host "SUCCESS: CopyCat media player closed." -ForegroundColor Green
    exit 0
}

function Dispatch-Actions {
    if ($Restore) {
        $restorePayload = @{ action = "restoreSession" }
        if ($Seek -ge 0) { $restorePayload.seek = [double]$Seek }
        Send-AiCommand $restorePayload | Out-Null
    } elseif ($FilePath) {
        $resolved = (Resolve-Path $FilePath).Path
        $openPayload = @{ action = "openFile"; filePath = $resolved }
        if ($Seek -ge 0) { $openPayload.seek = [double]$Seek }
        Send-AiCommand $openPayload | Out-Null
    }
    if (-not $Restore -and $Seek -ge 0) {
        Send-AiCommand @{ action = "seek"; value = [double]$Seek } | Out-Null
    }
    Send-AiCommand @{ action = "bringToFront" } | Out-Null
}

# 1. If player is already running, activate it immediately
if (Test-AiBridge) {
    Dispatch-Actions
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
    Dispatch-Actions
    Write-Host "SUCCESS: CopyCat media player opened successfully on the interactive desktop." -ForegroundColor Green
    exit 0
} else {
    Write-Host "WARNING: Launch triggered, but HTTP bridge did not respond within 5 seconds." -ForegroundColor Yellow
    exit 0
}
