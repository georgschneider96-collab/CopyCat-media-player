$distDir = 'C:\Users\Schual\Desktop\VLCopyCAT\dist'
$uploadDir = 'C:\Users\Schual\Desktop\CopyCatUpload'

if (-not (Test-Path $uploadDir)) {
    New-Item -Path $uploadDir -ItemType Directory -Force | Out-Null
}

Write-Host "Copying v1.0.2 installer and portable app to CopyCatUpload..." -ForegroundColor Cyan

Copy-Item (Join-Path $distDir 'CopyCat media player Setup 1.0.2.exe') (Join-Path $uploadDir 'CopyCat-media-player-Setup-1.0.2.exe') -Force
Copy-Item (Join-Path $distDir 'CopyCat media player 1.0.2.exe') (Join-Path $uploadDir 'CopyCat-media-player-1.0.2-portable.exe') -Force

# Create portable zip
$portableExe = Join-Path $uploadDir 'CopyCat-media-player-1.0.2-portable.exe'
$zipPath = Join-Path $uploadDir 'CopyCat-media-player-v1.0.2-portable.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $portableExe -DestinationPath $zipPath -CompressionLevel Optimal

# Remove old versions from upload directory
Remove-Item (Join-Path $uploadDir '*1.0.0*') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $uploadDir '*1.0.1*') -Force -ErrorAction SilentlyContinue

Write-Host "Upload folder successfully updated with v1.0.2 files!" -ForegroundColor Green
Get-ChildItem $uploadDir | Select-Object Name, Length, LastWriteTime
