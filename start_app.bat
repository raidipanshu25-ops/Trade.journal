@echo off
cd /d "%~dp0"
title Trade.journal Launcher
echo ============================================================
echo   Trade.journal -- Local Full-Stack Launcher
echo ============================================================
echo.

set PY_CMD=

:: Check known direct Python installations first
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
echo [INFO] Attempting to install Python 3.12 automatically...
where winget >nul 2>&1
if not errorlevel 1 (
    winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe'; $dest = Join-Path $env:TEMP 'python-3.12.8-amd64.exe'; (New-Object System.Net.WebClient).DownloadFile($url, $dest); Start-Process -FilePath $dest -ArgumentList '/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1' -Wait; Remove-Item $dest -Force -ErrorAction SilentlyContinue"
)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :found_py
)
if exist "%ProgramFiles%\Python312\python.exe" (
    set "PY_CMD=%ProgramFiles%\Python312\python.exe"
    goto :found_py
)

echo [ERROR] Compatible Python 3.10 to 3.14 was not found!
echo MetaTrader 5 requires Python 3.10 to 3.14.
pause
exit /b 1

:found_py
:: Free ports 8000 and 5173 if already held by stale background sessions
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Check Node.js / npm
where npm >nul 2>&1
if not errorlevel 1 goto :found_npm

echo [WARNING] Node.js / npm is not found in your PATH.
echo [INFO] Attempting to install Node.js LTS automatically...
where winget >nul 2>&1
if not errorlevel 1 (
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $dest = Join-Path $env:TEMP 'node-v20.msi'; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi', $dest); Start-Process msiexec.exe -ArgumentList '/i', $dest, '/qn' -Wait; Remove-Item $dest -Force -ErrorAction SilentlyContinue"
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js / npm is not found in your PATH!
    echo Please install Node.js (v18 or higher) from https://nodejs.org/
    pause
    exit /b 1
)

:found_npm
echo [1/4] Using Python: %PY_CMD%
echo Checking backend dependencies...
if "%PY_CMD:~0,3%"=="py " (
    %PY_CMD% -m pip install -r backend\requirements.txt >nul 2>&1
) else if "%PY_CMD%"=="python" (
    python -m pip install -r backend\requirements.txt >nul 2>&1
) else (
    "%PY_CMD%" -m pip install -r backend\requirements.txt >nul 2>&1
)

echo.
echo [2/4] Checking frontend dependencies...
if not exist "frontend\node_modules" (
    echo Installing frontend npm packages...
    cd frontend
    call npm install
    cd ..
)

echo.
echo Launching MetaTrader 5 Desktop Terminal GUI...
tasklist /fi "imagename eq terminal64.exe" 2>nul | find /i "terminal64.exe" >nul
if errorlevel 1 (
    if exist "%ProgramFiles%\MetaTrader 5\terminal64.exe" (
        start "" /d "%ProgramFiles%\MetaTrader 5" "%ProgramFiles%\MetaTrader 5\terminal64.exe"
        timeout /t 2 /nobreak >nul
    )
)

echo.
echo [3/4] Starting FastAPI Backend (http://localhost:8000)...
if "%PY_CMD:~0,3%"=="py " (
    start "Trade.journal Backend" cmd /k "title TJ Backend && cd /d "%~dp0backend" && %PY_CMD% -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else if "%PY_CMD%"=="python" (
    start "Trade.journal Backend" cmd /k "title TJ Backend && cd /d "%~dp0backend" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    start "Trade.journal Backend" cmd /k "title TJ Backend && cd /d "%~dp0backend" && "%PY_CMD%" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
)

echo.
echo [4/4] Starting Frontend Dev Server (http://localhost:5173)...
start "Trade.journal Frontend" cmd /k "title TJ Frontend && cd /d "%~dp0frontend" && npm run dev"

echo.
echo ============================================================
echo   Trade.journal is starting up!
echo   Dashboard: http://localhost:5173
echo   API Docs:  http://localhost:8000/docs
echo ============================================================
echo.

:: Wait 3 seconds and open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo Servers are running in separate terminal windows.
echo You can minimize this launcher window.
pause
