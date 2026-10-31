$distDir = 'C:\Users\Schual\Desktop\VLCopyCAT\dist'
$uploadDir = 'C:\Users\Schual\Desktop\CopyCatUpload'

if (-not (Test-Path $uploadDir)) {
    New-Item -Path $uploadDir -ItemType Directory -Force | Out-Null
}

Write-Host "Copying patched installer and portable app to CopyCatUpload..." -ForegroundColor Cyan

Copy-Item (Join-Path $distDir 'CopyCat media player Setup 1.0.1.exe') (Join-Path $uploadDir 'CopyCat-media-player-Setup-1.0.1.exe') -Force
Copy-Item (Join-Path $distDir 'CopyCat media player 1.0.1.exe') (Join-Path $uploadDir 'CopyCat-media-player-1.0.1-portable.exe') -Force

# Create portable zip
$portableExe = Join-Path $uploadDir 'CopyCat-media-player-1.0.1-portable.exe'
$zipPath = Join-Path $uploadDir 'CopyCat-media-player-v1.0.1-portable.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $portableExe -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Upload folder successfully updated with v1.0.1 files!" -ForegroundColor Green
Get-ChildItem $uploadDir | Select-Object Name, Length, LastWriteTime
