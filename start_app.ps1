# Trade.journal PowerShell Full-Stack Launcher
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Trade.journal -- Local Full-Stack Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$pythonExe = $null

# 1. Check known direct install locations first
$knownPaths = @(
    "$env:LOCALAPPDATA\Python\bin\python.exe",
    "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe",
    "$env:LOCALAPPDATA\Python\pythoncore-3.12-64\python.exe",
    "$env:LOCALAPPDATA\Python\pythoncore-3.11-64\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
    "$env:ProgramFiles\Python312\python.exe",
    "$env:ProgramFiles\Python311\python.exe",
    "$env:ProgramFiles\Python314\python.exe",
    "$env:ProgramFiles\Python310\python.exe"
)

foreach ($p in $knownPaths) {
    if (Test-Path $p) {
        $pInfo = Start-Process -FilePath $p -ArgumentList '-c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)"' -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
        if ($pInfo -and $pInfo.ExitCode -eq 0) {
            $pipCheck = Start-Process -FilePath $p -ArgumentList '-m pip --version' -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
            if ($pipCheck -and $pipCheck.ExitCode -eq 0) {
                $pythonExe = $p
                break
            }
        }
    }
}

# 2. Check py launcher versions
if (-not $pythonExe) {
    foreach ($ver in @("-3.12", "-3.11", "-3.14", "-3.10", "-3", "")) {
        $arg = if ($ver) { "$ver " } else { "" }
        $pInfo = Start-Process -FilePath "py" -ArgumentList "$($arg)-c `"import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)`"" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
        if ($pInfo -and $pInfo.ExitCode -eq 0) {
            $pythonExe = if ($ver) { "py $ver" } else { "py" }
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

# 4. Auto-install Python 3.12 if not found
if (-not $pythonExe) {
    Write-Host "[WARNING] Compatible Python (3.10 - 3.14) was not found on this PC." -ForegroundColor Yellow
    Write-Host "[INFO] Attempting automatic installation of Python 3.12..." -ForegroundColor Cyan

    $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Installing Python 3.12 via winget..." -ForegroundColor Green
        Start-Process winget -ArgumentList "install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements" -Wait
    } else {
        $installer = Join-Path $env:TEMP "python-3.12.8-amd64.exe"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe" -OutFile $installer
        Start-Process -FilePath $installer -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1" -Wait
        Remove-Item $installer -Force -ErrorAction SilentlyContinue
    }

    $localPy = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    if (Test-Path $localPy) {
        $pythonExe = $localPy
    } else {
        Write-Host "[ERROR] Compatible Python (3.10 - 3.14) was not found!" -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
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
    Write-Host "[WARNING] Node.js / npm not found. Attempting automatic installation..." -ForegroundColor Yellow
    $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($winget) {
        Start-Process winget -ArgumentList "install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements" -Wait
    } else {
        $dest = Join-Path $env:TEMP "node-v20.msi"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $dest
        Start-Process msiexec.exe -ArgumentList "/i", $dest, "/qn" -Wait
        Remove-Item $dest -Force -ErrorAction SilentlyContinue
    }
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
if (Test-Path $mt5Exe) {
    $proc = Get-Process terminal64 -ErrorAction SilentlyContinue
    if (-not $proc) {
        Write-Host "Starting MetaTrader 5 Terminal GUI..." -ForegroundColor Green
        Start-Process -FilePath $mt5Exe
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "[3/4] Starting FastAPI Backend..." -ForegroundColor Green
$backendCmd = "title TJ Backend && cd /d `"$rootPath\backend`" && $cmdPy -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process cmd.exe -ArgumentList "/k `"$backendCmd`""

Write-Host ""
Write-Host "[4/4] Starting Frontend Dev Server..." -ForegroundColor Green
$frontendCmd = "title TJ Frontend && cd /d `"$rootPath\frontend`" && npm run dev"
Start-Process cmd.exe -ArgumentList "/k `"$frontendCmd`""

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Trade.journal is starting up!" -ForegroundColor Cyan
Write-Host "  Dashboard: http://localhost:5173" -ForegroundColor Green
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host "Servers are running in separate terminal windows."
Write-Host "You can minimize this launcher window."
Read-Host "Press Enter to close this launcher..."
