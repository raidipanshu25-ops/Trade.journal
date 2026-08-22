# Trade.journal PowerShell Full-Stack Launcher
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Trade.journal -- Local Full-Stack Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$pythonCmd = $null
$candidates = @("py -3.11", "py -3.12", "py -3.10", "py -3", "py", "python")

foreach ($c in $candidates) {
    try {
        $parts = $c -split " "
        $exe = $parts[0]
        $args = $parts[1..($parts.Length-1)]
        $res = Start-Process -FilePath $exe -ArgumentList ($args + @("-c", "import sys")) -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
        if ($res -and $res.ExitCode -eq 0) {
            $pythonCmd = $c
            break
        }
    } catch {}
}

if (-not $pythonCmd) {
    $commonPaths = @(
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
        "$env:LOCALAPPDATA\Python\bin\python.exe",
        "$env:ProgramFiles\Python311\python.exe",
        "$env:ProgramFiles\Python312\python.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $pythonCmd = "`"$p`""
            break
        }
    }
}

if (-not $pythonCmd) {
    Write-Host "[ERROR] Python 3.11+ is not found!" -ForegroundColor Red
    Write-Host "Please install Python from https://www.python.org/"
    Read-Host "Press Enter to exit..."
    exit 1
}

# Check npm
$npmTest = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmTest) {
    Write-Host "[ERROR] Node.js / npm is not found in your PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "[1/4] Checking backend dependencies with $pythonCmd..." -ForegroundColor Green
Invoke-Expression "$pythonCmd -m pip install -r backend\requirements.txt"

Write-Host ""
Write-Host "[2/4] Checking frontend dependencies..." -ForegroundColor Green
if (-not (Test-Path "frontend\node_modules")) {
    Push-Location "frontend"
    npm install
    Pop-Location
}

$rootPath = (Get-Location).Path

Write-Host ""
Write-Host "[3/4] Starting FastAPI Backend (http://localhost:8000)..." -ForegroundColor Green
Start-Process "cmd.exe" -ArgumentList "/k title TJ Backend && cd /d `"$rootPath`" && $pythonCmd -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

Write-Host ""
Write-Host "[4/4] Starting Frontend Dev Server (http://localhost:5173)..." -ForegroundColor Green
Start-Process "cmd.exe" -ArgumentList "/k title TJ Frontend && cd /d `"$rootPath\\frontend`" && npm run dev"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Trade.journal is starting up!" -ForegroundColor Cyan
Write-Host "  Dashboard: http://localhost:5173" -ForegroundColor Green
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Read-Host "Press Enter to exit this launcher..."
