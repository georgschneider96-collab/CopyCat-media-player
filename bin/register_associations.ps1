# CopyCat media player - Comprehensive Windows File Associations & Default Video Player Setup
param(
    [string]$TargetExe = ""
)

$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path -Parent $scriptDir

# 1. Determine target executable path
$portableUpload = Get-ChildItem "C:\Users\Schual\Desktop\CopyCatUpload" -Filter "CopyCat*portable.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$portableUploadPath = if ($portableUpload) { $portableUpload.FullName } else { "" }
$portableUploadName = if ($portableUpload) { $portableUpload.Name } else { "CopyCat-media-player-portable.exe" }

$candidateExes = @(
    $TargetExe,
    "$env:ProgramFiles\CopyCat media player\CopyCat media player.exe",
    "${env:ProgramFiles(x86)}\CopyCat media player\CopyCat media player.exe",
    "$env:LOCALAPPDATA\Programs\copycat-media-player\CopyCat media player.exe",
    $portableUploadPath,
    (Join-Path $appDir "dist\win-unpacked\CopyCat media player.exe"),
    (Join-Path $appDir "Launch_CopyCat.exe"),
    (Join-Path $appDir "CopyCat media player.exe")
)

$exePath = ""
foreach ($cand in $candidateExes) {
    if ($cand -and (Test-Path $cand)) {
        $exePath = (Resolve-Path $cand).Path
        break
    }
}

if (-not $exePath) {
    $exePath = (Join-Path $appDir "Launch_CopyCat.exe")
}

$iconPath = Join-Path $appDir "assets\icon.ico"
if (-not (Test-Path $iconPath)) {
    $iconPath = $exePath
}

$openCommand = "`"$exePath`" `"%1`""
$dirCommand = "`"$exePath`" `"%V`""
$iconEntry = "`"$iconPath`",0"

Write-Host "Registering CopyCat media player ($exePath)..." -ForegroundColor Cyan

$videoExtensions = @(
    '.mp4', '.mkv', '.avi', '.mov', '.webm', 
    '.wmv', '.flv', '.m4v', '.ts', '.m2ts', 
    '.mpg', '.mpeg', '.vob', '.ogv', '.3gp'
)

$audioExtensions = @(
    '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'
)

$allExtensions = $videoExtensions + $audioExtensions

# 2. Base ProgID: CopyCat.Video
$progIdVideo = "HKCU:\Software\Classes\CopyCat.Video"
New-Item -Path $progIdVideo -Force | Out-Null
Set-ItemProperty -Path $progIdVideo -Name '(Default)' -Value 'CopyCat Video File'
Set-ItemProperty -Path $progIdVideo -Name 'FriendlyTypeName' -Value 'CopyCat Video File'

$vIcon = "$progIdVideo\DefaultIcon"
New-Item -Path $vIcon -Force | Out-Null
Set-ItemProperty -Path $vIcon -Name '(Default)' -Value $iconEntry

$vCmd = "$progIdVideo\shell\open\command"
New-Item -Path $vCmd -Force | Out-Null
Set-ItemProperty -Path $vCmd -Name '(Default)' -Value $openCommand

# 3. Base ProgID: CopyCat.Audio
$progIdAudio = "HKCU:\Software\Classes\CopyCat.Audio"
New-Item -Path $progIdAudio -Force | Out-Null
Set-ItemProperty -Path $progIdAudio -Name '(Default)' -Value 'CopyCat Audio File'
Set-ItemProperty -Path $progIdAudio -Name 'FriendlyTypeName' -Value 'CopyCat Audio File'

$aIcon = "$progIdAudio\DefaultIcon"
New-Item -Path $aIcon -Force | Out-Null
Set-ItemProperty -Path $aIcon -Name '(Default)' -Value $iconEntry

$aCmd = "$progIdAudio\shell\open\command"
New-Item -Path $aCmd -Force | Out-Null
Set-ItemProperty -Path $aCmd -Name '(Default)' -Value $openCommand

# 4. Register All Relevant Executable Names in Applications (so Windows Open With always recognizes them)
$registeredAppNames = @(
    "CopyCat media player.exe",
    $portableUploadName,
    "CopyCat-media-player-1.0.6-portable.exe",
    "CopyCat-media-player-1.0.5-portable.exe",
    "Launch_CopyCat.exe"
)
if ($TargetExe) {
    $targetName = Split-Path -Leaf $TargetExe
    if ($targetName -and -not ($registeredAppNames -contains $targetName)) {
        $registeredAppNames += $targetName
    }
}

foreach ($appName in $registeredAppNames) {
    $thisAppKey = "HKCU:\Software\Classes\Applications\$appName"
    New-Item -Path $thisAppKey -Force | Out-Null
    Set-ItemProperty -Path $thisAppKey -Name '(Default)' -Value 'CopyCat media player'
    Set-ItemProperty -Path $thisAppKey -Name 'FriendlyAppName' -Value 'CopyCat media player'

    $appIconKey = "$thisAppKey\DefaultIcon"
    New-Item -Path $appIconKey -Force | Out-Null
    Set-ItemProperty -Path $appIconKey -Name '(Default)' -Value $iconEntry

    $appCmdKey = "$thisAppKey\shell\open\command"
    New-Item -Path $appCmdKey -Force | Out-Null
    $specificExe = $exePath
    if ($appName -eq "Launch_CopyCat.exe" -and (Test-Path (Join-Path $appDir "Launch_CopyCat.exe"))) {
        $specificExe = Join-Path $appDir "Launch_CopyCat.exe"
    } elseif ($portableUploadPath -and ($appName -eq $portableUploadName -or $appName -eq (Split-Path -Leaf $portableUploadPath))) {
        $specificExe = $portableUploadPath
    }
    Set-ItemProperty -Path $appCmdKey -Name '(Default)' -Value "`"$specificExe`" `"%1`""

    $suppTypesKey = "$thisAppKey\SupportedTypes"
    New-Item -Path $suppTypesKey -Force | Out-Null
    foreach ($ext in $allExtensions) {
        Set-ItemProperty -Path $suppTypesKey -Name $ext -Value ""
    }

    # Add to SystemFileAssociations OpenWithList
    $sysVideoOwp = "HKCU:\Software\Classes\SystemFileAssociations\video\OpenWithList\$appName"
    New-Item -Path $sysVideoOwp -Force | Out-Null
    $sysAudioOwp = "HKCU:\Software\Classes\SystemFileAssociations\audio\OpenWithList\$appName"
    New-Item -Path $sysAudioOwp -Force | Out-Null
}

# 5. Context Menu: "Play with CopyCat media player" on Videos, Audios, and Folders
$sysVideoKey = "HKCU:\Software\Classes\SystemFileAssociations\video\shell\CopyCat"
New-Item -Path $sysVideoKey -Force | Out-Null
Set-ItemProperty -Path $sysVideoKey -Name '(Default)' -Value 'Play with CopyCat media player'
Set-ItemProperty -Path $sysVideoKey -Name 'Icon' -Value $iconEntry
$sysVideoCmdKey = "$sysVideoKey\command"
New-Item -Path $sysVideoCmdKey -Force | Out-Null
Set-ItemProperty -Path $sysVideoCmdKey -Name '(Default)' -Value $openCommand

$sysAudioKey = "HKCU:\Software\Classes\SystemFileAssociations\audio\shell\CopyCat"
New-Item -Path $sysAudioKey -Force | Out-Null
Set-ItemProperty -Path $sysAudioKey -Name '(Default)' -Value 'Play with CopyCat media player'
Set-ItemProperty -Path $sysAudioKey -Name 'Icon' -Value $iconEntry
$sysAudioCmdKey = "$sysAudioKey\command"
New-Item -Path $sysAudioCmdKey -Force | Out-Null
Set-ItemProperty -Path $sysAudioCmdKey -Name '(Default)' -Value $openCommand

# Right click folder -> "Play with CopyCat media player"
$dirShellKey = "HKCU:\Software\Classes\Directory\shell\CopyCat"
New-Item -Path $dirShellKey -Force | Out-Null
Set-ItemProperty -Path $dirShellKey -Name '(Default)' -Value 'Play with CopyCat media player'
Set-ItemProperty -Path $dirShellKey -Name 'Icon' -Value $iconEntry
$dirCmdKey = "$dirShellKey\command"
New-Item -Path $dirCmdKey -Force | Out-Null
Set-ItemProperty -Path $dirCmdKey -Name '(Default)' -Value $openCommand

$dirBgShellKey = "HKCU:\Software\Classes\Directory\Background\shell\CopyCat"
New-Item -Path $dirBgShellKey -Force | Out-Null
Set-ItemProperty -Path $dirBgShellKey -Name '(Default)' -Value 'Play with CopyCat media player'
Set-ItemProperty -Path $dirBgShellKey -Name 'Icon' -Value $iconEntry
$dirBgCmdKey = "$dirBgShellKey\command"
New-Item -Path $dirBgCmdKey -Force | Out-Null
Set-ItemProperty -Path $dirBgCmdKey -Name '(Default)' -Value $dirCommand

# 6. Windows Capabilities & RegisteredApplications (for Windows Settings -> Default Apps)
$capKey = "HKCU:\Software\CopyCat media player\Capabilities"
New-Item -Path $capKey -Force | Out-Null
Set-ItemProperty -Path $capKey -Name 'ApplicationName' -Value 'CopyCat media player'
Set-ItemProperty -Path $capKey -Name 'ApplicationDescription' -Value 'CopyCat media player based on Juxtopposed redesign'
Set-ItemProperty -Path $capKey -Name 'ApplicationIcon' -Value $iconEntry

$fileAssocKey = "$capKey\FileAssociations"
New-Item -Path $fileAssocKey -Force | Out-Null
foreach ($ext in $videoExtensions) {
    Set-ItemProperty -Path $fileAssocKey -Name $ext -Value "CopyCat.Video"
}
foreach ($ext in $audioExtensions) {
    Set-ItemProperty -Path $fileAssocKey -Name $ext -Value "CopyCat.Audio"
}

$regAppKey = "HKCU:\Software\RegisteredApplications"
New-Item -Path $regAppKey -Force | Out-Null
Set-ItemProperty -Path $regAppKey -Name 'CopyCat media player' -Value 'Software\CopyCat media player\Capabilities'

# 7. Override existing VLC.* ProgIDs in HKCU (takes over legacy VLC player associations)
foreach ($ext in $videoExtensions) {
    $rawExt = $ext.TrimStart('.')
    $vlcProgId = "HKCU:\Software\Classes\VLC.$rawExt"
    New-Item -Path $vlcProgId -Force | Out-Null
    Set-ItemProperty -Path $vlcProgId -Name '(Default)' -Value 'CopyCat Video File'
    Set-ItemProperty -Path $vlcProgId -Name 'FriendlyTypeName' -Value 'CopyCat Video File'

    $vlcIcon = "$vlcProgId\DefaultIcon"
    New-Item -Path $vlcIcon -Force | Out-Null
    Set-ItemProperty -Path $vlcIcon -Name '(Default)' -Value $iconEntry

    $vlcCmd = "$vlcProgId\shell\open\command"
    New-Item -Path $vlcCmd -Force | Out-Null
    Set-ItemProperty -Path $vlcCmd -Name '(Default)' -Value $openCommand
}

# 8. Register OpenWithProgids & Explorer FileExts for all extensions
foreach ($ext in $allExtensions) {
    $prog = if ($videoExtensions -contains $ext) { 'CopyCat.Video' } else { 'CopyCat.Audio' }

    # HKCU:\Software\Classes\<ext>
    $extClassKey = "HKCU:\Software\Classes\$ext"
    New-Item -Path $extClassKey -Force | Out-Null
    Set-ItemProperty -Path $extClassKey -Name '(Default)' -Value $prog

    # OpenWithProgids
    $owpKey = "$extClassKey\OpenWithProgids"
    New-Item -Path $owpKey -Force | Out-Null
    Set-ItemProperty -Path $owpKey -Name $prog -Value ''

    # Explorer FileExts OpenWithProgids
    $explExtProgids = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\OpenWithProgids"
    New-Item -Path $explExtProgids -Force | Out-Null
    Set-ItemProperty -Path $explExtProgids -Name $prog -Value ([byte[]]@()) -Type Binary

    # Explorer FileExts OpenWithList
    $explExtList = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\OpenWithList"
    New-Item -Path $explExtList -Force | Out-Null
    Set-ItemProperty -Path $explExtList -Name 'a' -Value 'CopyCat media player.exe'
    Set-ItemProperty -Path $explExtList -Name 'b' -Value $portableUploadName
    Set-ItemProperty -Path $explExtList -Name 'c' -Value 'Launch_CopyCat.exe'
    Set-ItemProperty -Path $explExtList -Name 'MRUList' -Value 'abc'
}

# 9. Register copycat:// Custom URL Protocol
$urlKey = "HKCU:\Software\Classes\copycat"
New-Item -Path $urlKey -Force | Out-Null
Set-ItemProperty -Path $urlKey -Name '(Default)' -Value 'URL:CopyCat Protocol'
Set-ItemProperty -Path $urlKey -Name 'URL Protocol' -Value ''
$urlCmd = "$urlKey\shell\open\command"
New-Item -Path $urlCmd -Force | Out-Null
Set-ItemProperty -Path $urlCmd -Name '(Default)' -Value $openCommand

# 10. Register Interactive Task for Instant AI / Background Desktop Launch
try {
    $taskExe = if (Test-Path (Join-Path $appDir "Launch_CopyCat.exe")) { (Join-Path $appDir "Launch_CopyCat.exe") } else { $exePath }
    $workDir = Split-Path -Parent $taskExe
    $action = New-ScheduledTaskAction -Execute $taskExe -WorkingDirectory $workDir
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances Parallel
    Register-ScheduledTask -TaskName "LaunchCopyCat" -Action $action -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "Interactive desktop launch task 'LaunchCopyCat' registered for $taskExe." -ForegroundColor DarkCyan
} catch {}

# 11. Register Global 'copycat' CLI Command in WindowsApps (%PATH%)
try {
    $winAppsDir = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps"
    if (Test-Path $winAppsDir) {
        $cmdTarget = Join-Path $winAppsDir "copycat.cmd"
        $ps1Target = Join-Path $winAppsDir "copycat.ps1"
        $safeExe = $exePath.Replace("'", "''")

        $ps1Script = @'
param(
    [string]$FilePath = "",
    [double]$Seek = -1,
    [switch]$Close,
    [switch]$Restore
)

$ErrorActionPreference = 'SilentlyContinue'

function Test-Bridge {
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/status" -TimeoutSec 1 -ErrorAction Stop
        return ($res -and $res.app -match "CopyCat")
    } catch {
        return $false
    }
}

function Send-Command([hashtable]$payload) {
    try {
        $json = $payload | ConvertTo-Json -Compress
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/control" -Method Post -Body $json -ContentType "application/json" -TimeoutSec 2 -ErrorAction Stop
        return $res.ok
    } catch {
        return $false
    }
}

if ($Close) {
    if (Test-Bridge) {
        Send-Command @{ action = "close" } | Out-Null
        Start-Sleep -Milliseconds 500
    }
    Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
    Write-Host "[CopyCat] Player closed." -ForegroundColor Green
    exit 0
}

$regCmd = (Get-ItemProperty "HKCU:\Software\Classes\CopyCat.Video\shell\open\command" -ErrorAction SilentlyContinue).'(Default)'
$regExe = if ($regCmd -match '^\s*"([^"]+)"') { $matches[1] } else { "" }

$candidates = @(
    "$env:ProgramFiles\CopyCat media player\CopyCat media player.exe",
    "${env:ProgramFiles(x86)}\CopyCat media player\CopyCat media player.exe",
    "$env:LOCALAPPDATA\Programs\copycat-media-player\CopyCat media player.exe",
    $regExe,
    (Get-ChildItem -Path "$env:USERPROFILE\Desktop", "$env:USERPROFILE\Downloads" -Filter "*CopyCat*.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName -First 1),
    "C:\Users\Schual\Desktop\VLCopyCAT\Launch_CopyCat.exe"
)

$targetExe = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not (Test-Bridge)) {
    if (Get-ScheduledTask -TaskName "LaunchCopyCat" -ErrorAction SilentlyContinue) {
        schtasks.exe /run /tn "LaunchCopyCat" | Out-Null
    } elseif ($targetExe) {
        $shell = New-Object -ComObject Shell.Application
        $shell.ShellExecute($targetExe, "", "", "open", 1)
    }
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 250
        if (Test-Bridge) { break }
    }
}

if (Test-Bridge) {
    if ($FilePath -and (Test-Path $FilePath)) {
        $resolved = (Resolve-Path $FilePath).Path
        $body = @{ action = "openFile"; filePath = $resolved }
        if ($Seek -ge 0) { $body.seek = [double]$Seek }
        Send-Command $body | Out-Null
        Send-Command @{ action = "bringToFront" } | Out-Null
        Write-Host "[CopyCat] Playing: $resolved" -ForegroundColor Green
    } else {
        Send-Command @{ action = "bringToFront" } | Out-Null
        Write-Host "[CopyCat] Active on desktop (http://127.0.0.1:4500)" -ForegroundColor Green
    }
} else {
    Write-Host "[CopyCat] Error: Player could not be launched on interactive desktop." -ForegroundColor Red
}
'@
        Set-Content -Path $ps1Target -Value $ps1Script -Encoding UTF8 -Force
        Set-Content -Path $cmdTarget -Value "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0copycat.ps1`" %*" -Encoding Ascii -Force
        Write-Host "CLI command 'copycat' registered in $winAppsDir" -ForegroundColor DarkCyan
    }
} catch {}

# 12. Register Global Antigravity AI Skill (if Antigravity is installed)
try {
    $geminiDir = Join-Path $env:USERPROFILE ".gemini"
    if (Test-Path $geminiDir) {
        $skillDir = Join-Path $geminiDir "config\skills\copycat-player"
        if (-not (Test-Path $skillDir)) {
            New-Item -Path $skillDir -ItemType Directory -Force | Out-Null
        }
        $skillFile = Join-Path $skillDir "SKILL.md"
        $skillContent = @'
---
name: copycat-player
description: >-
  Play, pause, seek, control, or open video and audio files in CopyCat Media Player,
  or launch CopyCat onto the interactive Windows desktop from an AI assistant or terminal.
---

# CopyCat Media Player AI Integration Guide

CopyCat Media Player is a desktop media player running on this PC. It features a local REST API bridge on `http://127.0.0.1:4500`.

## ⚠️ Important: Launching on Windows from an AI Terminal
When running inside an AI assistant terminal or background sandbox, NEVER use `Start-Process "CopyCat media player.exe"` directly. Windows automatically blocks background processes from creating interactive desktop windows on your screen.

### How to Launch the Player Onto the Interactive Desktop
Run any of these commands in PowerShell:

```powershell
# Method 1 (Universal Shell COM invocation - works from any terminal or sandbox):
(New-Object -ComObject Shell.Application).ShellExecute("C:\path\to\CopyCat media player.exe", "C:\path\to\video.mp4", "", "open", 1)

# Method 2 (Universal CLI command on PATH):
copycat "C:\path\to\video.mp4"

# Method 3 (Via Task Scheduler):
schtasks.exe /run /tn "LaunchCopyCat"
```

## How to Play Media and Control Playback via HTTP
Once running, the player listens on `http://127.0.0.1:4500`.

### 1. Open and Play a File
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/control" -Method Post -ContentType "application/json" -Body '{"action":"openFile","filePath":"C:\\path\\to\\video.mp4"}'
```

### 2. Set Playback Speed (e.g. 1.25x)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/control" -Method Post -ContentType "application/json" -Body '{"action":"speed","value":1.25}'
```

### 3. Check Current Status
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/status"
```

### 4. Close the Player When Done
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/control" -Method Post -ContentType "application/json" -Body '{"action":"close"}'
```
'@
        Set-Content -Path $skillFile -Value $skillContent -Encoding UTF8 -Force
        Write-Host "Global Antigravity skill 'copycat-player' registered at $skillFile" -ForegroundColor DarkCyan
    }
} catch {}

# 13. Notify Windows Shell
try {
    [ShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {
    $code = @"
using System;
using System.Runtime.InteropServices;
public class ShellNotify {
    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@
    try {
        Add-Type -TypeDefinition $code
        [ShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
    } catch {}
}

Write-Host "Success: All video and audio file associations mapped to CopyCat media player!" -ForegroundColor Green
