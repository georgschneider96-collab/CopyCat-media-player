# CopyCat — Projekt-Export für NotebookLM
# Durchsucht alle relevanten Projektdateien im Arbeitsverzeichnis,
# sortiert sie in logischer Architektur-Reihenfolge und schreibt alles UTF-8-kodiert in './CopyCat-Gesamtprojekt.txt'.

$ErrorActionPreference = 'Stop'

$ProjectRoot = Resolve-Path './'
$OutputFile  = Join-Path $ProjectRoot 'CopyCat-Gesamtprojekt.txt'

$AllowedExtensions = @('.json', '.js', '.html', '.css', '.md', '.ps1')
$ExcludedDirs      = @('.git', 'node_modules', 'dist', 'out', 'build', 'bin', 'assets')
$ExcludedFiles     = @('CopyCat-Gesamtprojekt.txt', 'package-lock.json')

$PriorityOrder = @(
    './package.json',
    './main.js',
    './src/main/container.js',
    './src/main/stream-manager.js',
    './src/main/logger.js',
    './src/main/session.js',
    './src/main/updater.js',
    './src/main/media-resolver.js',
    './src/main/ipc.js',
    './src/main/server.js',
    './preload.js',
    './src/index.html',
    './src/styles.css',
    './src/icons.js',
    './src/app.js',
    './AI_CONTEXT.md',
    './README.md',
    './export_notebooklm.ps1'
)

$AllFiles = Get-ChildItem -Path $ProjectRoot -Recurse -File | Where-Object {
    $ext = $_.Extension.ToLowerInvariant()
    if ($AllowedExtensions -notcontains $ext) { return $false }
    if ($ExcludedFiles -contains $_.Name) { return $false }

    $relPath = $_.FullName.Substring($ProjectRoot.Path.Length).TrimStart('\', '/')
    $segments = $relPath -split '[\\/]'
    foreach ($dir in $ExcludedDirs) {
        if ($segments -contains $dir) { return $false }
    }
    return $true
}

$Files = $AllFiles | Sort-Object {
    $rel = './' + ($_.FullName.Substring($ProjectRoot.Path.Length).TrimStart('\', '/') -replace '\\', '/')
    $idx = $PriorityOrder.IndexOf($rel)
    if ($idx -ge 0) { $idx } else { 999 }
}, FullName

function Get-CodeFenceLang([string]$Extension) {
    switch ($Extension.ToLowerInvariant()) {
        '.js'   { return 'javascript' }
        '.json' { return 'json' }
        '.html' { return 'html' }
        '.css'  { return 'css' }
        '.md'   { return 'markdown' }
        '.ps1'  { return 'powershell' }
        default { return 'text' }
    }
}

$Sb = [System.Text.StringBuilder]::new()
[void]$Sb.AppendLine("================================================================================")
[void]$Sb.AppendLine("# PROJEKT-GESAMTDOKUMENTATION: VLCopyCat / CopyCat Media Player")
[void]$Sb.AppendLine("Aktualisiert am: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$Sb.AppendLine("Enthaltene Dateien ($($Files.Count)):")
foreach ($F in $Files) {
    $Rel = './' + ($F.FullName.Substring($ProjectRoot.Path.Length).TrimStart('\', '/') -replace '\\', '/')
    [void]$Sb.AppendLine("  - $Rel")
}
[void]$Sb.AppendLine("================================================================================")
[void]$Sb.AppendLine("")

foreach ($File in $Files) {
    $RelPath = './' + ($File.FullName.Substring($ProjectRoot.Path.Length).TrimStart('\', '/') -replace '\\', '/')
    $Lang    = Get-CodeFenceLang $File.Extension
    $RawContent = Get-Content -LiteralPath $File.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue

    if ([string]::IsNullOrWhiteSpace($RawContent)) {
        continue
    }

    $CleanedContent = ($RawContent -replace "`r`n", "`n").Trim()
    $CleanedContent = [regex]::Replace($CleanedContent, "`n{3,}", "`n`n")

    $Fence   = if ($File.Extension.ToLowerInvariant() -eq '.md') { '````````' } else { '``````' }

    [void]$Sb.AppendLine("################################################################################")
    [void]$Sb.AppendLine("## DATEI: $RelPath")
    [void]$Sb.AppendLine("################################################################################")
    [void]$Sb.AppendLine("")
    [void]$Sb.AppendLine("$Fence$Lang")
    [void]$Sb.AppendLine($CleanedContent)
    [void]$Sb.AppendLine("$Fence")
    [void]$Sb.AppendLine("")
}

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($OutputFile, $Sb.ToString(), $Utf8NoBom)

Write-Output "Aktualisiert: ./CopyCat-Gesamtprojekt.txt ($($Files.Count) Dateien)"
