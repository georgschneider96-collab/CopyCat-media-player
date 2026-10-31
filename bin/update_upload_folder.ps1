$packageJson = Get-Content 'C:\Users\Schual\Desktop\VLCopyCAT\package.json' -Raw | ConvertFrom-Json
$ver = $packageJson.version
$distDir = 'C:\Users\Schual\Desktop\VLCopyCAT\dist'
$uploadDir = 'C:\Users\Schual\Desktop\CopyCatUpload'

if (-not (Test-Path $uploadDir)) {
    New-Item -Path $uploadDir -ItemType Directory -Force | Out-Null
}

Write-Host "Copying v$ver installer and portable app to CopyCatUpload..." -ForegroundColor Cyan

Copy-Item (Join-Path $distDir "CopyCat media player Setup $ver.exe") (Join-Path $uploadDir "CopyCat-media-player-Setup-$ver.exe") -Force
Copy-Item (Join-Path $distDir "CopyCat media player $ver.exe") (Join-Path $uploadDir "CopyCat-media-player-$ver-portable.exe") -Force

# Create portable zip
$portableExe = Join-Path $uploadDir "CopyCat-media-player-$ver-portable.exe"
$zipPath = Join-Path $uploadDir "CopyCat-media-player-v$ver-portable.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $portableExe -DestinationPath $zipPath -CompressionLevel Optimal

# Remove old versions from upload directory
Get-ChildItem $uploadDir | Where-Object { $_.Name -notlike "*$ver*" } | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Upload folder successfully updated with v$ver files!" -ForegroundColor Green
Get-ChildItem $uploadDir | Select-Object Name, Length, LastWriteTime
