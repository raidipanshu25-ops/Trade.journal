@echo off
title MT5 Trading Journal Connector
echo ============================================================
echo   MT5 Trading Journal -- Local Connector Launcher
echo ============================================================
echo.

set PY_CMD=

:: Probe direct Python 3.12 first, then other versions and py launcher
for %%P in ("%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" "%ProgramFiles%\Python312\python.exe" "%ProgramFiles%\Python311\python.exe" "py -3.12" "py -3.11" "py -3.10" "py -3.13" "py" "python") do (
    if not defined PY_CMD (
        if exist %%P (
            %%P -c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)" >nul 2>&1
            if not errorlevel 1 (
                set PY_CMD=%%P
                goto :found_py
            )
        ) else (
            %%~P -c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)" >nul 2>&1
            if not errorlevel 1 (
                set PY_CMD=%%~P
                goto :found_py
            )
        )
    )
)

:found_py
if not defined PY_CMD (
    echo [ERROR] Compatible Python (3.10 - 3.14) was not found in your PATH!
    echo MetaTrader 5 requires Python 3.10 - 3.14. Python 3.15+ is not yet supported by MT5.
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

