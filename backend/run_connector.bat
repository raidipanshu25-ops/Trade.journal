@echo off
title MT5 Trading Journal Connector
echo ============================================================
echo   MT5 Trading Journal -- Local Connector Launcher
echo ============================================================
echo.

:: Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in your PATH!
    echo Please install Python 3.11 or higher from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [1/2] Installing / verifying required packages...
pip install MetaTrader5 httpx websockets python-dotenv
if %errorlevel% neq 0 (
    echo [WARNING] Package installation encountered an issue. Proceeding anyway...
)

echo.
echo [2/2] Starting MT5 Sync Agent...
echo.
python local_sync_agent.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Sync agent stopped with an error.
    pause
)
