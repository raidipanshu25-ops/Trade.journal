# MT5 Trading Journal - PowerShell Launcher
param (
    [switch]$Install
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MT5 Trading Journal -- Local Connector Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$pythonCmd = $null

# 1. Check known direct install locations first (preferring ones with pip and working modules)
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
                $pythonCmd = "`"$p`""
                break
            }
        }
    }
}

# 2. Check py launcher versions
if (-not $pythonCmd) {
    foreach ($ver in @("-3.12", "-3.11", "-3.14", "-3.10", "-3", "")) {
        $arg = if ($ver) { "$ver " } else { "" }
        $pInfo = Start-Process -FilePath "py" -ArgumentList "$($arg)-c `"import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)`"" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
        if ($pInfo -and $pInfo.ExitCode -eq 0) {
            $pipCheck = Start-Process -FilePath "py" -ArgumentList "$($arg)-m pip --version" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
            if ($pipCheck -and $pipCheck.ExitCode -eq 0) {
                $pythonCmd = if ($ver) { "py $ver" } else { "py" }
                break
            }
        }
    }
}

# 3. Check default python on PATH
if (-not $pythonCmd) {
    $pInfo = Start-Process -FilePath "python" -ArgumentList '-c "import sys; sys.exit(0 if 10 <= sys.version_info[1] <= 14 else 1)"' -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
    if ($pInfo -and $pInfo.ExitCode -eq 0) {
        $pipCheck = Start-Process -FilePath "python" -ArgumentList '-m pip --version' -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
        if ($pipCheck -and $pipCheck.ExitCode -eq 0) {
            $pythonCmd = "python"
        }
    }
}

# 4. If Python is not found, automatically install Python 3.12
if (-not $pythonCmd) {
    Write-Host "[WARNING] Compatible Python (3.10 - 3.14) was not found on this PC." -ForegroundColor Yellow
    Write-Host "[INFO] Attempting automatic installation of Python 3.12..." -ForegroundColor Cyan

    $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Installing Python 3.12 via Windows Package Manager..." -ForegroundColor Green
        Start-Process winget -ArgumentList "install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements" -Wait
    } else {
        Write-Host "Downloading official Python 3.12 installer from python.org..." -ForegroundColor Green
        $installer = Join-Path $env:TEMP "python-3.12.8-amd64.exe"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe" -OutFile $installer
        Write-Host "Installing Python 3.12 silently..." -ForegroundColor Green
        Start-Process -FilePath $installer -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1" -Wait
        Remove-Item $installer -Force -ErrorAction SilentlyContinue
    }

    $localPy = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    if (Test-Path $localPy) {
        $pythonCmd = "`"$localPy`""
        Write-Host "[SUCCESS] Python 3.12 was installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Compatible Python (3.10 - 3.14) could not be automatically installed!" -ForegroundColor Red
        Write-Host "Please install Python 3.11 or 3.12 manually from https://www.python.org/"
        Read-Host "Press Enter to exit..."
        exit 1
    }
}

Write-Host "[1/2] Using Python: $pythonCmd" -ForegroundColor Green
Write-Host "Checking required dependencies..." -ForegroundColor Green

$needsInstall = $Install.IsPresent
if (-not $needsInstall) {
    $rawPy = $pythonCmd -replace '^"|"$', ''
    $testScript = "import MetaTrader5, httpx, websockets, dotenv, psutil"
    $check = if ($pythonCmd.StartsWith("py ")) {
        $ver = $pythonCmd.Substring(3)
        Start-Process -FilePath "py" -ArgumentList "$ver -c `"$testScript`"" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
    } else {
        Start-Process -FilePath $rawPy -ArgumentList "-c `"$testScript`"" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
    }
    if (-not $check -or $check.ExitCode -ne 0) {
        $needsInstall = $true
    }
}

if ($needsInstall) {
    Write-Host "[INFO] Missing dependencies detected. Installing required packages..." -ForegroundColor Yellow
    Write-Host "Packages: MetaTrader5, httpx, websockets, python-dotenv, psutil" -ForegroundColor Yellow
    Invoke-Expression "$pythonCmd -m ensurepip --default-pip"
    Invoke-Expression "$pythonCmd -m pip install --upgrade pip"
    Invoke-Expression "$pythonCmd -m pip install MetaTrader5 httpx websockets python-dotenv psutil"
    Write-Host "[OK] All dependencies successfully installed and verified!" -ForegroundColor Green
} else {
    Write-Host "[OK] All connector dependencies are installed and verified." -ForegroundColor Green
}

if ($Install) {
    Write-Host ""
    Write-Host "[SUCCESS] Dependency setup complete!" -ForegroundColor Green
    Read-Host "Press Enter to exit..."
    exit 0
}

Write-Host ""
Write-Host "[2/2] Starting MT5 Sync Agent..." -ForegroundColor Green
$targetScript = $null
if (Test-Path "backend\local_sync_agent.py") {
    $targetScript = "backend\local_sync_agent.py"
} elseif (Test-Path "local_sync_agent.py") {
    $targetScript = "local_sync_agent.py"
} elseif (Test-Path "$PSScriptRoot\backend\local_sync_agent.py") {
    $targetScript = "$PSScriptRoot\backend\local_sync_agent.py"
} elseif (Test-Path "$PSScriptRoot\local_sync_agent.py") {
    $targetScript = "$PSScriptRoot\local_sync_agent.py"
}

if ($targetScript) {
    Invoke-Expression "$pythonCmd `"$targetScript`""
} else {
    Write-Host "[ERROR] local_sync_agent.py not found!" -ForegroundColor Red
}

Read-Host "Press Enter to exit..."
