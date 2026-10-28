@echo off
setlocal
cd /d "%~dp0"
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
            echo cd /d "%~dp0"
            echo title MT5 Trading Journal Connector
            echo call "%~f0"
        ) > "%USERPROFILE%\Desktop\Start MT5 Connector.bat" 2>nul
    )
)

set PY_CMD=

:: Check python directly in PATH
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if not errorlevel 1 (
    set PY_CMD=python
    goto :found_py
)

:: Check py launcher
py -3.12 -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set PY_CMD=py -3.12
    goto :found_py
)

py -3.11 -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set PY_CMD=py -3.11
    goto :found_py
)

py -3.10 -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set PY_CMD=py -3.10
    goto :found_py
)

py -3 -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set PY_CMD=py -3
    goto :found_py
)

py -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set PY_CMD=py
    goto :found_py
)

:: Check standard local appdata paths
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :found_py
)
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    goto :found_py
)
if exist "%ProgramFiles%\Python312\python.exe" (
    set "PY_CMD=%ProgramFiles%\Python312\python.exe"
    goto :found_py
)
if exist "%ProgramFiles%\Python311\python.exe" (
    set "PY_CMD=%ProgramFiles%\Python311\python.exe"
    goto :found_py
)

:found_py
if not defined PY_CMD (
    echo [ERROR] Compatible Python 3.10 to 3.14 was not found in your PATH!
    echo MetaTrader 5 requires Python 3.10 to 3.14.
    echo Please install Python 3.11 or 3.12 from https://www.python.org/
    echo IMPORTANT: Make sure to check the box "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [1/2] Using Python: %PY_CMD%
echo Installing / verifying required packages...
%PY_CMD% -m pip install MetaTrader5 httpx websockets python-dotenv psutil >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Running package installation:
    %PY_CMD% -m pip install MetaTrader5 httpx websockets python-dotenv psutil
)

echo.
echo [2/2] Starting MT5 Sync Agent...
echo.

:agent_loop
if exist "local_sync_agent.py" (
    %PY_CMD% local_sync_agent.py %*
) else if exist "backend\local_sync_agent.py" (
    %PY_CMD% backend\local_sync_agent.py %*
) else if exist "%~dp0local_sync_agent.py" (
    %PY_CMD% "%~dp0local_sync_agent.py" %*
) else if exist "%~dp0backend\local_sync_agent.py" (
    %PY_CMD% "%~dp0backend\local_sync_agent.py" %*
) else (
    echo [ERROR] Cannot find local_sync_agent.py!
    echo Looked in:
    echo   - local_sync_agent.py
    echo   - backend\local_sync_agent.py
    echo   - %~dp0local_sync_agent.py
    echo   - %~dp0backend\local_sync_agent.py
    echo Current folder: %CD%
    pause
    exit /b 1
)

echo.
echo ============================================================
echo [NOTICE] Connector stopped. Press any key to restart or close this window.
echo ============================================================
pause
goto :agent_loop
