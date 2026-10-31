@echo off
pushd "%~dp0"
if exist ".\node_modules\electron\dist\electron.exe" (
    start "" ".\node_modules\electron\dist\electron.exe" . %*
) else (
    echo Installing CopyCat media player dependencies...
    call npm install
    node node_modules/electron/install.js
    start "" ".\node_modules\electron\dist\electron.exe" . %*
)
popd
