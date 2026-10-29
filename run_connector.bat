@echo off
setlocal
cd /d "%~dp0"
title MT5 Trading Journal Connector
echo ============================================================
echo   MT5 Trading Journal -- Local Connector Launcher
echo ============================================================
echo.

:: Check for explicit install flag
set "FORCE_INSTALL=0"
if /i "%~1"=="--install" set "FORCE_INSTALL=1"
if /i "%~1"=="-install" set "FORCE_INSTALL=1"
if /i "%~1"=="/install" set "FORCE_INSTALL=1"
if /i "%~1"=="install" set "FORCE_INSTALL=1"

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

:: Check known direct Python installations first (most reliable on Windows)
for %%P in (
    "%LOCALAPPDATA%\Python\bin\python.exe"
    "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
    "%LOCALAPPDATA%\Python\pythoncore-3.12-64\python.exe"
    "%LOCALAPPDATA%\Python\pythoncore-3.11-64\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "%ProgramFiles%\Python312\python.exe"
    "%ProgramFiles%\Python311\python.exe"
    "%ProgramFiles%\Python314\python.exe"
    "%ProgramFiles%\Python310\python.exe"
) do (
    if not defined PY_CMD (
        if exist %%P (
            %%P -c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)" >nul 2>&1
            if not errorlevel 1 (
                %%P -m pip --version >nul 2>&1
                if not errorlevel 1 (
                    set "PY_CMD=%%~P"
                    goto :found_py
                )
            )
        )
    )
)

:: Check py launcher
if not defined PY_CMD (
    for %%V in (-3.12 -3.11 -3.14 -3.10 -3 py) do (
        if not defined PY_CMD (
            py %%V -c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)" >nul 2>&1
            if not errorlevel 1 (
                py %%V -m pip --version >nul 2>&1
                if not errorlevel 1 (
                    set "PY_CMD=py %%V"
                    goto :found_py
                )
            )
        )
    )
)

:: Check python directly in PATH
if not defined PY_CMD (
    python -c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)" >nul 2>&1
    if not errorlevel 1 (
        python -m pip --version >nul 2>&1
        if not errorlevel 1 (
            set "PY_CMD=python"
            goto :found_py
        )
    )
)

:try_install_python
if defined PY_CMD goto :found_py

echo [WARNING] Compatible Python 3.10 to 3.14 was not found on this PC.
echo [INFO] MetaTrader 5 connector requires Python.
echo [INFO] Attempting to install Python 3.12 automatically...
echo.

where winget >nul 2>&1
if not errorlevel 1 goto :install_winget
goto :install_powershell

:install_winget
echo Installing Python 3.12 via Windows Package Manager...
winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
goto :verify_py_installed

:install_powershell
echo Downloading official Python 3.12 installer from python.org...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe'; $dest = Join-Path $env:TEMP 'python-3.12.8-amd64.exe'; Write-Host 'Downloading Python 3.12 installer...'; (New-Object System.Net.WebClient).DownloadFile($url, $dest); Write-Host 'Installing Python 3.12 silently...'; Start-Process -FilePath $dest -ArgumentList '/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1' -Wait; Remove-Item $dest -Force -ErrorAction SilentlyContinue"

:verify_py_installed
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    echo [SUCCESS] Python 3.12 was installed successfully!
    echo.
    goto :found_py
)
if exist "%ProgramFiles%\Python312\python.exe" (
    set "PY_CMD=%ProgramFiles%\Python312\python.exe"
    echo [SUCCESS] Python 3.12 was installed successfully!
    echo.
    goto :found_py
)

echo [ERROR] Automatic Python installation could not be completed.
echo Please install Python 3.11 or 3.12 manually from https://www.python.org/
echo IMPORTANT: Check the box "Add Python to PATH" during installation.
echo.
pause
exit /b 1

:found_py
echo [1/2] Using Python: %PY_CMD%
echo Checking required dependencies...

set "NEEDS_INSTALL=0"
if "%FORCE_INSTALL%"=="1" (
    set "NEEDS_INSTALL=1"
    echo [INFO] Re-installation of dependencies requested via --install.
    goto :do_install_deps
)

if "%PY_CMD:~0,3%"=="py " (
    %PY_CMD% -c "import MetaTrader5, httpx, websockets, dotenv, psutil" >nul 2>&1
) else if "%PY_CMD%"=="python" (
    python -c "import MetaTrader5, httpx, websockets, dotenv, psutil" >nul 2>&1
) else (
    "%PY_CMD%" -c "import MetaTrader5, httpx, websockets, dotenv, psutil" >nul 2>&1
)
if errorlevel 1 (
    set "NEEDS_INSTALL=1"
    goto :do_install_deps
)

echo [OK] All connector dependencies are installed and verified.
goto :after_deps

:do_install_deps
echo [INFO] Installing or verifying dependencies: MetaTrader5, httpx, websockets, python-dotenv, psutil...
echo.
if "%PY_CMD:~0,3%"=="py " (
    %PY_CMD% -m ensurepip --default-pip >nul 2>&1
    %PY_CMD% -m pip install --upgrade pip >nul 2>&1
    %PY_CMD% -m pip install MetaTrader5 httpx websockets python-dotenv psutil
    if errorlevel 1 %PY_CMD% -m pip install --user MetaTrader5 httpx websockets python-dotenv psutil
) else if "%PY_CMD%"=="python" (
    python -m ensurepip --default-pip >nul 2>&1
    python -m pip install --upgrade pip >nul 2>&1
    python -m pip install MetaTrader5 httpx websockets python-dotenv psutil
    if errorlevel 1 python -m pip install --user MetaTrader5 httpx websockets python-dotenv psutil
) else (
    "%PY_CMD%" -m ensurepip --default-pip >nul 2>&1
    "%PY_CMD%" -m pip install --upgrade pip >nul 2>&1
    "%PY_CMD%" -m pip install MetaTrader5 httpx websockets python-dotenv psutil
    if errorlevel 1 "%PY_CMD%" -m pip install --user MetaTrader5 httpx websockets python-dotenv psutil
)

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install one or more required dependencies!
    echo Please check your internet connection and try running:
    echo   pip install MetaTrader5 httpx websockets python-dotenv psutil
    echo.
    pause
    exit /b 1
)
echo [OK] All dependencies successfully installed and verified!

:after_deps
if "%FORCE_INSTALL%"=="1" (
    echo.
    echo ============================================================
    echo [SUCCESS] Dependency setup complete!
    echo ============================================================
    pause
    exit /b 0
)

echo.
echo [2/2] Starting MT5 Sync Agent...
echo.

:agent_loop
set "TARGET_SCRIPT="
if exist "local_sync_agent.py" (
    set "TARGET_SCRIPT=local_sync_agent.py"
) else if exist "backend\local_sync_agent.py" (
    set "TARGET_SCRIPT=backend\local_sync_agent.py"
) else if exist "%~dp0local_sync_agent.py" (
    set "TARGET_SCRIPT=%~dp0local_sync_agent.py"
) else if exist "%~dp0backend\local_sync_agent.py" (
    set "TARGET_SCRIPT=%~dp0backend\local_sync_agent.py"
)

if not defined TARGET_SCRIPT (
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

if "%PY_CMD:~0,3%"=="py " (
    %PY_CMD% "%TARGET_SCRIPT%" %*
) else if "%PY_CMD%"=="python" (
    python "%TARGET_SCRIPT%" %*
) else (
    "%PY_CMD%" "%TARGET_SCRIPT%" %*
)

echo.
echo ============================================================
echo [NOTICE] Connector stopped. Press any key to restart or close this window.
echo ============================================================
pause
goto :agent_loop
