@echo off
title Trade.journal Launcher
echo ============================================================
echo   Trade.journal -- Local Full-Stack Launcher
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
    echo [ERROR] Compatible Python (3.10 - 3.14) was not found!
    echo MetaTrader 5 requires Python 3.10 - 3.14. Python 3.15+ is not yet supported by MT5.
    pause
    exit /b 1
)

:: Free ports 8000 and 5173 if already held by stale background sessions
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Check Node.js
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / npm is not found in your PATH!
    echo Please install Node.js (v18 or higher) from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Using Python: %PY_CMD%
echo Checking backend dependencies...
%PY_CMD% -m pip install -r backend\requirements.txt >nul 2>&1

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
start "Trade.journal Backend" cmd /k "title TJ Backend && cd /d "%~dp0backend" && %PY_CMD% -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

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
