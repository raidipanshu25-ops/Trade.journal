@echo off
title MT5 Trading Journal Connector
echo ============================================================
echo   MT5 Trading Journal -- Local Connector Launcher
echo ============================================================
echo.

:: 1. Register custom URL protocol (tjconnector://) in HKCU (no admin privileges needed)
reg add "HKCU\Software\Classes\tjconnector" /ve /t REG_SZ /d "URL:Trade Journal Connector" /f >nul 2>&1
reg add "HKCU\Software\Classes\tjconnector" /v "URL Protocol" /t REG_SZ /d "" /f >nul 2>&1
reg add "HKCU\Software\Classes\tjconnector\shell\open\command" /ve /t REG_SZ /d "\"%~f0\" \"%%1\"" /f >nul 2>&1

:: 2. Create Desktop Shortcut for returning traders
if exist "%USERPROFILE%\Desktop" (
    if not exist "%USERPROFILE%\Desktop\Start MT5 Connector.bat" (
        (
            echo @echo off
            echo title MT5 Trading Journal Connector
            echo call "%~f0"
        ) > "%USERPROFILE%\Desktop\Start MT5 Connector.bat" 2>nul
    )
)

set PY_CMD=

:: Probe direct Python installs first, then other versions and py launcher
for %%P in ("%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" "%ProgramFiles%\Python312\python.exe" "%ProgramFiles%\Python311\python.exe" "py -3.12" "py -3.11" "py -3.10" "py -3.13" "py -3.14" "py" "python") do (
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
%PY_CMD% -m pip install MetaTrader5 httpx websockets python-dotenv psutil >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Package install output:
    %PY_CMD% -m pip install MetaTrader5 httpx websockets python-dotenv psutil
)

echo.
echo [2/2] Starting MT5 Sync Agent...
echo.

:agent_loop
if exist "local_sync_agent.py" (
    %PY_CMD% local_sync_agent.py
) else if exist "backend\local_sync_agent.py" (
    %PY_CMD% backend\local_sync_agent.py
) else (
    echo [ERROR] Cannot find local_sync_agent.py!
)

if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Connector process stopped. Auto-restarting in 5 seconds...
    echo Press Ctrl+C if you want to exit.
    timeout /t 5 >nul
    goto :agent_loop
)
