@echo off
title Trade.journal Launcher
echo ============================================================
echo   Trade.journal -- Local Full-Stack Launcher
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
        "C:\Python311\python.exe"
        "C:\Python312\python.exe"
    ) do (
        if not defined PY_CMD if exist "%%~D" (
            set PY_CMD="%%~D"
        )
    )
)

if not defined PY_CMD (
    echo [ERROR] Python 3.11+ is not found!
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

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
echo [3/4] Starting FastAPI Backend (http://localhost:8000)...
start "Trade.journal Backend" cmd /k "title TJ Backend && cd /d "%~dp0" && %PY_CMD% -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

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
