# CopyCat media player - Comprehensive Windows File Associations & Default Video Player Setup
$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path -Parent $scriptDir
$exePath = Join-Path $appDir "Launch_CopyCat.exe"
$iconPath = Join-Path $appDir "assets\icon.ico"

if (-not (Test-Path $exePath)) {
    Write-Error "Could not find Launch_CopyCat.exe at $exePath"
    exit 1
}
if (-not (Test-Path $iconPath)) {
    $iconPath = $exePath
}

$openCommand = "`"$exePath`" `"%1`""
$iconEntry = "`"$iconPath`",0"

Write-Host "Registering CopyCat media player as default video player..." -ForegroundColor Cyan

$videoExtensions = @(
    '.mp4', '.mkv', '.avi', '.mov', '.webm', 
    '.wmv', '.flv', '.m4v', '.ts', '.m2ts', 
    '.mpg', '.mpeg', '.vob', '.ogv', '.3gp'
)

$audioExtensions = @(
    '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'
)

$allExtensions = $videoExtensions + $audioExtensions

# 1. Base ProgID: CopyCat.Video
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

# 2. Base ProgID: CopyCat.Audio
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

# 3. Application Registration
$appKey = "HKCU:\Software\Classes\Applications\Launch_CopyCat.exe"
New-Item -Path $appKey -Force | Out-Null
Set-ItemProperty -Path $appKey -Name 'FriendlyAppName' -Value 'CopyCat media player'

$appIconKey = "$appKey\DefaultIcon"
New-Item -Path $appIconKey -Force | Out-Null
Set-ItemProperty -Path $appIconKey -Name '(Default)' -Value $iconEntry

$appCmdKey = "$appKey\shell\open\command"
New-Item -Path $appCmdKey -Force | Out-Null
Set-ItemProperty -Path $appCmdKey -Name '(Default)' -Value $openCommand

$suppTypesKey = "$appKey\SupportedTypes"
New-Item -Path $suppTypesKey -Force | Out-Null
foreach ($ext in $allExtensions) {
    Set-ItemProperty -Path $suppTypesKey -Name $ext -Value ""
}

# 4. Context Menu: "Play with CopyCat media player" for all videos & audios
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

# 5. Windows Capabilities & RegisteredApplications
$capKey = "HKCU:\Software\CopyCat media player\Capabilities"
New-Item -Path $capKey -Force | Out-Null
Set-ItemProperty -Path $capKey -Name 'ApplicationName' -Value 'CopyCat media player'
Set-ItemProperty -Path $capKey -Name 'ApplicationDescription' -Value 'VLC media player CopyCat based on the redesign of Juxtopposed'
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

# 6. Override existing VLC.* ProgIDs in HKCU (seamlessly takes over all existing UserChoice video associations)
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

# 7. Register OpenWithProgids & Classes defaults for each extension
foreach ($ext in $videoExtensions) {
    # HKCU:\Software\Classes\<ext>
    $extClassKey = "HKCU:\Software\Classes\$ext"
    New-Item -Path $extClassKey -Force | Out-Null
    Set-ItemProperty -Path $extClassKey -Name '(Default)' -Value 'CopyCat.Video'

    # OpenWithProgids
    $owpKey = "$extClassKey\OpenWithProgids"
    New-Item -Path $owpKey -Force | Out-Null
    Set-ItemProperty -Path $owpKey -Name 'CopyCat.Video' -Value ''

    # Explorer FileExts OpenWithProgids
    $explExtProgids = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\OpenWithProgids"
    New-Item -Path $explExtProgids -Force | Out-Null
    Set-ItemProperty -Path $explExtProgids -Name 'CopyCat.Video' -Value ([byte[]]@()) -Type Binary

    # Explorer FileExts OpenWithList
    $explExtList = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\OpenWithList"
    New-Item -Path $explExtList -Force | Out-Null
    Set-ItemProperty -Path $explExtList -Name 'CopyCat' -Value 'Launch_CopyCat.exe'
}

# 8. Notify Windows Shell
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

Write-Host "Success: All video file associations mapped to CopyCat media player!" -ForegroundColor Green
