# MT5 Trading Journal - PowerShell Launcher
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MT5 Trading Journal -- Local Connector Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$pythonCmd = $null
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
            $pythonCmd = "`"$p`""
            break
        }
    }
}

# 2. Check py launcher versions
if (-not $pythonCmd) {
    foreach ($ver in @("-3.12", "-3.11", "-3.10", "-3.13", "-3.14")) {
        $pInfo = Start-Process -FilePath "py" -ArgumentList "$ver -c `"import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)`"" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
        if ($pInfo -and $pInfo.ExitCode -eq 0) {
            $pythonCmd = "py $ver"
            break
        }
    }
}

# 3. Check default python on PATH
if (-not $pythonCmd) {
    $pInfo = Start-Process -FilePath "python" -ArgumentList '-c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)"' -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
    if ($pInfo -and $pInfo.ExitCode -eq 0) {
        $pythonCmd = "python"
    }
}

if (-not $pythonCmd) {
    Write-Host "[ERROR] Compatible Python (3.10 - 3.14) was not found!" -ForegroundColor Red
    Write-Host "MetaTrader 5 requires Python 3.10 - 3.14. Python 3.15+ is not yet supported by MT5."
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "[1/2] Installing / verifying dependencies with $pythonCmd..." -ForegroundColor Green
$installArgs = "-m pip install MetaTrader5 httpx websockets python-dotenv"
Invoke-Expression "$pythonCmd $installArgs"

Write-Host ""
Write-Host "[2/2] Starting MT5 Sync Agent..." -ForegroundColor Green
if (Test-Path "backend\local_sync_agent.py") {
    Invoke-Expression "$pythonCmd backend\local_sync_agent.py"
} elseif (Test-Path "local_sync_agent.py") {
    Invoke-Expression "$pythonCmd local_sync_agent.py"
} else {
    Write-Host "[ERROR] local_sync_agent.py not found!" -ForegroundColor Red
}

Read-Host "Press Enter to exit..."
