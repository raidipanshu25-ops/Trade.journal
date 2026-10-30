@echo off
setlocal
cd /d "%~dp0"
title Set Trade.journal Sync Token
echo ============================================================
echo   Set Trade.journal MT5 Connector Sync Token
echo ============================================================
echo.

set "NEW_TOKEN=%~1"
if not defined NEW_TOKEN (
    echo Please enter your Sync Token from your Trading Journal dashboard:
    echo (Settings -^> MT5 Connector -^> Copy Sync Token)
    echo.
    set /p "NEW_TOKEN=Sync Token: "
)

if not defined NEW_TOKEN (
    echo [ERROR] No sync token provided. Exiting.
    pause
    exit /b 1
)

:: Trim quotes or whitespace
set "NEW_TOKEN=%NEW_TOKEN:"=%"
set "NEW_TOKEN=%NEW_TOKEN: =%"

echo.
echo [1/2] Saving token to configuration...

:: Use PowerShell to safely update JSON
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$dir = Join-Path $env:USERPROFILE '.tj-connector'; " ^
    "if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; " ^
    "$file = Join-Path $dir 'config.json'; " ^
    "$cfg = @{ backend_url = 'https://trade-journal-ukc2.onrender.com'; sync_token = '%NEW_TOKEN%' }; " ^
    "if (Test-Path $file) { " ^
    "    try { " ^
    "        $existing = Get-Content $file -Raw | ConvertFrom-Json; " ^
    "        if ($existing.backend_url) { $cfg.backend_url = $existing.backend_url }; " ^
    "        if ($existing.mt5_path) { $cfg.mt5_path = $existing.mt5_path }; " ^
    "    } catch {} " ^
    "}; " ^
    "$cfg.sync_token = '%NEW_TOKEN%'; " ^
    "$cfg | ConvertTo-Json | Set-Content $file -Encoding UTF8; " ^
    "Write-Host '[SUCCESS] Token saved to ~/.tj-connector/config.json' -ForegroundColor Green;"

echo.
echo [2/2] Checking if connector is currently running on port 18500...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { " ^
    "    $res = Invoke-RestMethod -Uri 'http://127.0.0.1:18500/set-token' -Method Post -Body (@{ sync_token = '%NEW_TOKEN%' } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 3 -ErrorAction Stop; " ^
    "    Write-Host '[SUCCESS] Running connector detected! Live token updated successfully.' -ForegroundColor Green; " ^
    "} catch { " ^
    "    Write-Host '[INFO] Connector is not currently running. It will use this new token on next start.' -ForegroundColor Cyan; " ^
    "}"

echo.
echo ============================================================
echo   Sync token configured successfully!
echo   You can now launch run_connector.bat
echo ============================================================
echo.
pause
