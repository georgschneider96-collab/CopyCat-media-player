# CopyCat — Konversationsprotokoll Export
# Liest das vollständige Transkript der gesamten Konversation aus und aktualisiert
# das chronologische Entwicklungsprotokoll in './CopyCat-Konversationsprotokoll.txt'.

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Aktualisiere CopyCat-Konversationsprotokoll..." -ForegroundColor Cyan

$pyScript = Join-Path $ScriptDir "export_conversation.py"
if (-not (Test-Path $pyScript)) {
    Write-Error "export_conversation.py nicht gefunden in $ScriptDir"
}

& python $pyScript
if ($LASTEXITCODE -eq 0) {
    Write-Host "Erfolgreich aktualisiert: ./CopyCat-Konversationsprotokoll.txt" -ForegroundColor Green
} else {
    Write-Error "Fehler beim Exportieren des Konversationsprotokolls (Exit Code $LASTEXITCODE)"
}
