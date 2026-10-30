@echo off
setlocal
cd /d "%~dp0"
title Trade.journal -- Dependency Installer
echo ============================================================
echo   Trade.journal -- Automated Dependency Installer
echo   Installs and verifies all Python and Node.js dependencies
echo ============================================================
echo.

set PY_CMD=

:: 1. Search for compatible Python 3.10-3.14
echo [1/5] Detecting Python (requires Python 3.10 to 3.14)...
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

:try_install_py
echo [WARNING] Python 3.10 to 3.14 was not found on this PC.
echo [INFO] Installing Python 3.12 automatically...
where winget >nul 2>&1
if not errorlevel 1 goto :install_py_winget
goto :install_py_ps

:install_py_winget
echo Installing Python 3.12 via winget...
winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
goto :verify_py

:install_py_ps
echo Downloading and installing Python 3.12 from python.org...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe'; $dest = Join-Path $env:TEMP 'python-3.12.8-amd64.exe'; (New-Object System.Net.WebClient).DownloadFile($url, $dest); Start-Process -FilePath $dest -ArgumentList '/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1' -Wait; Remove-Item $dest -Force -ErrorAction SilentlyContinue"

:verify_py
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :found_py
)
if exist "%ProgramFiles%\Python312\python.exe" (
    set "PY_CMD=%ProgramFiles%\Python312\python.exe"
    goto :found_py
)
echo [ERROR] Failed to auto-install Python. Please install from https://www.python.org/
pause
exit /b 1

:found_py
echo [OK] Using Python: %PY_CMD%
echo.

:: 2. Upgrade pip and install connector dependencies
echo [2/5] Installing Connector dependencies (MetaTrader5, httpx, websockets, python-dotenv, psutil)...
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
echo [OK] Connector dependencies installed.
echo.

:: 3. Install backend requirements
echo [3/5] Installing Backend dependencies (FastAPI, SQLAlchemy, etc.)...
if exist "backend\requirements.txt" (
    if "%PY_CMD:~0,3%"=="py " (
        %PY_CMD% -m pip install -r backend\requirements.txt
    ) else if "%PY_CMD%"=="python" (
        python -m pip install -r backend\requirements.txt
    ) else (
        "%PY_CMD%" -m pip install -r backend\requirements.txt
    )
    echo [OK] Backend dependencies installed.
) else (
    echo [INFO] backend\requirements.txt not found in current folder, skipping.
)
echo.

:: 4. Check / install Node.js and frontend packages
echo [4/5] Checking Node.js and npm...
where npm >nul 2>&1
if not errorlevel 1 goto :found_npm

echo [WARNING] Node.js / npm was not found on this PC.
echo [INFO] Attempting automatic installation of Node.js LTS...
where winget >nul 2>&1
if not errorlevel 1 goto :install_node_winget
goto :install_node_msi

:install_node_winget
echo Installing Node.js LTS via winget...
winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
goto :verify_node

:install_node_msi
echo Downloading and installing Node.js LTS...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $dest = Join-Path $env:TEMP 'node-v20.msi'; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi', $dest); Start-Process msiexec.exe -ArgumentList '/i', $dest, '/qn' -Wait; Remove-Item $dest -Force -ErrorAction SilentlyContinue"

:verify_node
where npm >nul 2>&1
if errorlevel 1 (
    echo [INFO] Node.js was installed. A terminal restart might be required to use npm.
)

:found_npm
if exist "frontend\package.json" (
    echo Installing Frontend npm dependencies...
    cd frontend
    call npm install
    cd ..
    echo [OK] Frontend dependencies installed.
)
echo.

:: 5. Check MetaTrader 5 Terminal
echo [5/5] Checking MetaTrader 5 Terminal installation...
set "MT5_FOUND=0"
if exist "%ProgramFiles%\MetaTrader 5\terminal64.exe" set "MT5_FOUND=1"
if exist "%ProgramFiles(x86)%\MetaTrader 5\terminal64.exe" set "MT5_FOUND=1"
if "%MT5_FOUND%"=="1" (
    echo [OK] MetaTrader 5 terminal detected on this PC.
) else (
    echo [INFO] MetaTrader 5 terminal not found in default Program Files path.
    echo If MT5 is installed elsewhere, connector will auto-detect it or use custom path in settings.
)

echo.
echo ============================================================
echo   [SUCCESS] ALL DEPENDENCIES HAVE BEEN VERIFIED / INSTALLED!
echo ============================================================
echo.
echo You can now run:
echo   - run_connector.bat    (to start the MT5 sync connector)
echo   - start_app.bat        (to start the full-stack web application)
echo.
pause

