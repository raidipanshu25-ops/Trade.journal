# Trade.journal PowerShell Full-Stack Launcher
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Trade.journal -- Local Full-Stack Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$pythonExe = $null

# 1. Check known direct install locations first
$knownPaths = @(
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
    "$env:ProgramFiles\Python312\python.exe",
    "$env:ProgramFiles\Python311\python.exe",
    "$env:ProgramFiles\Python313\python.exe",
    "$env:ProgramFiles\Python310\python.exe"
)

foreach ($p in $knownPaths) {
    if (Test-Path $p) {
        $pInfo = Start-Process -FilePath $p -ArgumentList '-c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)"' -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
        if ($pInfo -and $pInfo.ExitCode -eq 0) {
            $pythonExe = $p
            break
        }
    }
}

# 2. Check py launcher versions
if (-not $pythonExe) {
    foreach ($ver in @("-3.12", "-3.11", "-3.10", "-3.13", "-3.14")) {
        $pInfo = Start-Process -FilePath "py" -ArgumentList "$ver -c `"import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)`"" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
        if ($pInfo -and $pInfo.ExitCode -eq 0) {
            $pythonExe = "py $ver"
            break
        }
    }
}

# 3. Check default python on PATH
if (-not $pythonExe) {
    $pInfo = Start-Process -FilePath "python" -ArgumentList '-c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)"' -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
    if ($pInfo -and $pInfo.ExitCode -eq 0) {
        $pythonExe = "python"
    }
}

if (-not $pythonExe) {
    Write-Host "[ERROR] Compatible Python (3.10 - 3.14) was not found!" -ForegroundColor Red
    Write-Host "MetaTrader 5 requires Python 3.10 - 3.14. Python 3.15+ is not yet supported by MT5."
    Read-Host "Press Enter to exit..."
    exit 1
}

# Free ports 8000 and 5173 if held by stale/previous sessions
foreach ($port in @(8000, 5173)) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                if ($c.OwningProcess -and $c.OwningProcess -ne $PID) {
                    Write-Host "Releasing port $port (closing previous process PID $($c.OwningProcess))..." -ForegroundColor Yellow
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {}
}

# Check npm
$npmTest = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmTest) {
    Write-Host "[ERROR] Node.js / npm is not found in your PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "[1/4] Checking backend dependencies with $pythonExe..." -ForegroundColor Green
if ($pythonExe.StartsWith("py ")) {
    Invoke-Expression "$pythonExe -m pip install -r backend\requirements.txt"
} else {
    & $pythonExe -m pip install -r backend\requirements.txt
}

Write-Host ""
Write-Host "[2/4] Checking frontend dependencies..." -ForegroundColor Green
if (-not (Test-Path "frontend\node_modules")) {
    Push-Location "frontend"
    npm install
    Pop-Location
}

$rootPath = (Get-Location).Path
$cmdPy = if ($pythonExe.StartsWith("py ")) { $pythonExe } else { "`"$pythonExe`"" }

# Launch MetaTrader 5 Desktop Terminal GUI if not already open
$mt5Exe = "C:\Program Files\MetaTrader 5\terminal64.exe"
$mt5Proc = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
if (-not $mt5Proc -and (Test-Path $mt5Exe)) {
    Write-Host "Opening MetaTrader 5 Desktop GUI..." -ForegroundColor Green
    Start-Process -FilePath $mt5Exe -WorkingDirectory "C:\Program Files\MetaTrader 5"
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "[3/4] Starting FastAPI Backend (http://localhost:8000)..." -ForegroundColor Green
Start-Process "cmd.exe" -ArgumentList "/k title TJ Backend && cd /d `"$rootPath\\backend`" && $cmdPy -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

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
