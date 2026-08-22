# MT5 Trading Journal - PowerShell Launcher
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MT5 Trading Journal -- Local Connector Launcher" -ForegroundColor Cyan
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
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe",
        "$env:LOCALAPPDATA\Python\bin\python.exe",
        "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe",
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
    Write-Host "Please install Python from https://www.python.org/ (Check 'Add Python to PATH')"
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
