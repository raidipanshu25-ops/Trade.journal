@echo off
title MT5 Trading Journal Connector
echo ============================================================
echo   MT5 Trading Journal -- Local Connector Launcher
echo ============================================================
echo.

set PY_CMD=

:: Probe Python candidates in priority order
for %%P in ("py -3.11" "py -3.12" "py -3.10" "py -3" "py" "python") do (
    if not defined PY_CMD (
        %%~P -c "import sys" >nul 2>&1
        if not errorlevel 1 (
            set PY_CMD=%%~P
        )
    )
)

:: Check known AppData and ProgramFiles Python paths if not found
if not defined PY_CMD (
    for %%D in (
        "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
        "%LOCALAPPDATA%\Python\bin\python.exe"
        "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
        "%ProgramFiles%\Python311\python.exe"
        "%ProgramFiles%\Python312\python.exe"
        "%ProgramFiles%\Python310\python.exe"
        "C:\Python311\python.exe"
        "C:\Python312\python.exe"
    ) do (
        if not defined PY_CMD if exist "%%~D" (
            set PY_CMD="%%~D"
        )
    )
)

if not defined PY_CMD (
    echo [ERROR] Python 3.11+ is not found in your PATH!
    echo Please install Python from https://www.python.org/
    echo IMPORTANT: Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [1/2] Using Python: %PY_CMD%
echo Installing / verifying required packages...
%PY_CMD% -m pip install MetaTrader5 httpx websockets python-dotenv >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Package install output:
    %PY_CMD% -m pip install MetaTrader5 httpx websockets python-dotenv
)

echo.
echo [2/2] Starting MT5 Sync Agent...
echo.
if exist "backend\local_sync_agent.py" (
    %PY_CMD% backend\local_sync_agent.py
) else if exist "local_sync_agent.py" (
    %PY_CMD% local_sync_agent.py
) else (
    echo [ERROR] Cannot find local_sync_agent.py!
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] MT5 Sync Agent stopped with an error.
    pause
)

