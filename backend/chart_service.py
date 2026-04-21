"""
Chart screenshot service.
Captures MT5 chart images for AI vision analysis.

Strategy:
1. Try MQL5 ChartScreenShot via a helper script placed in MT5's Scripts folder.
2. Fallback to pyautogui screen capture of the MT5 window.
3. Fallback to a placeholder message if neither works.
"""
import base64
import logging
import os
import time
import glob
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# We'll look for screenshots in MT5's MQL5/Files directory
MT5_DATA_PATHS = [
    Path(os.path.expanduser("~")) / "AppData" / "Roaming" / "MetaQuotes" / "Terminal",
]


def find_mt5_files_dir() -> Path | None:
    """Find the MQL5/Files directory in any MT5 terminal installation."""
    for base in MT5_DATA_PATHS:
        if not base.exists():
            continue
        # Each terminal instance has a hash-named folder
        for terminal_dir in base.iterdir():
            if terminal_dir.is_dir():
                files_dir = terminal_dir / "MQL5" / "Files"
                if files_dir.exists():
                    return files_dir
    return None


def create_mql5_screenshot_script():
    """
    Create (or update) a helper MQL5 script in all MT5 terminal Script folders.
    This script captures the chart and saves it to the Files folder.
    """
    script_code = '''//+------------------------------------------------------------------+
//|                                          ChartCapture.mq5        |
//|                         Trading Journal — Auto Chart Capture     |
//+------------------------------------------------------------------+
#property script_show_inputs
input string FileName = "tj_chart_capture";
input int    Width    = 1920;
input int    Height   = 1080;

void OnStart()
{
   string fname = FileName + ".png";
   if(ChartScreenShot(0, fname, Width, Height, ALIGN_RIGHT))
   {
      Print("Chart screenshot saved: ", fname);
   }
   else
   {
      Print("Failed to save screenshot. Error: ", GetLastError());
   }
}
'''
    placed = False
    for base in MT5_DATA_PATHS:
        if not base.exists():
            continue
        for terminal_dir in base.iterdir():
            if terminal_dir.is_dir():
                scripts_dir = terminal_dir / "MQL5" / "Scripts"
                if scripts_dir.exists():
                    script_path = scripts_dir / "ChartCapture.mq5"
                    try:
                        with open(script_path, "w", encoding="utf-8") as f:
                            f.write(script_code)
                        logger.info(f"MQL5 screenshot script placed at: {script_path}")
                        placed = True
                    except Exception as e:
                        logger.warning(f"Could not write script to {script_path}: {e}")
    return placed


def capture_chart_pyautogui() -> str | None:
    """
    Fallback: Use pyautogui to capture the MT5 window.
    Returns base64-encoded PNG or None.
    """
    try:
        import pyautogui
        import subprocess

        # Find MT5 window using PowerShell
        result = subprocess.run(
            ['powershell', '-Command',
             'Add-Type -AssemblyName System.Windows.Forms;'
             '$proc = Get-Process | Where-Object {$_.MainWindowTitle -like "*MetaTrader*"} | Select-Object -First 1;'
             'if($proc) { $proc.MainWindowHandle } else { "0" }'],
            capture_output=True, text=True, timeout=5
        )
        hwnd = result.stdout.strip()

        if hwnd and hwnd != "0":
            # Take a full screenshot and crop to the MT5 window area
            # Since we can't easily get window bounds without win32gui,
            # we'll just take a screenshot of the primary monitor
            screenshot = pyautogui.screenshot()
            # Save temporarily
            tmp_path = Path(__file__).parent / "chart_capture.png"
            screenshot.save(str(tmp_path))
            with open(tmp_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            tmp_path.unlink(missing_ok=True)
            return b64
        else:
            logger.info("MT5 window not found for screenshot")
            return None
    except ImportError:
        logger.info("pyautogui not installed, skipping screen capture")
        return None
    except Exception as e:
        logger.warning(f"pyautogui capture failed: {e}")
        return None


def get_chart_screenshot_from_files() -> str | None:
    """
    Look for a chart screenshot in the MT5 MQL5/Files directory.
    Returns base64-encoded PNG or None.
    """
    files_dir = find_mt5_files_dir()
    if not files_dir:
        return None

    # Look for our specific file or any recent PNG
    target = files_dir / "tj_chart_capture.png"
    if target.exists():
        # Check if it's recent (less than 60 seconds old)
        age = time.time() - target.stat().st_mtime
        if age < 120:
            with open(target, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")

    # Also look for any recent chart screenshots
    pngs = sorted(glob.glob(str(files_dir / "*.png")), key=os.path.getmtime, reverse=True)
    for png in pngs[:3]:
        age = time.time() - os.path.getmtime(png)
        if age < 120:
            with open(png, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")

    return None


def capture_chart(symbol: str = None) -> str | None:
    """
    Main entry: try to get a chart screenshot.
    Returns base64-encoded PNG string, or None if unavailable.
    
    Priority:
    1. Check MQL5/Files for a recent screenshot (from the helper script)
    2. Use pyautogui to capture the screen
    """
    # 1. Check if MQL5 script produced a recent file
    b64 = get_chart_screenshot_from_files()
    if b64:
        logger.info("Got chart screenshot from MQL5/Files")
        return b64

    # 2. Fallback: pyautogui screen capture
    b64 = capture_chart_pyautogui()
    if b64:
        logger.info("Got chart screenshot via pyautogui")
        return b64

    logger.info("No chart screenshot available")
    return None


def handle_uploaded_chart(file_bytes: bytes) -> str:
    """Convert uploaded file bytes to base64."""
    return base64.b64encode(file_bytes).decode("utf-8")


# On module load, try to place the MQL5 script
try:
    create_mql5_screenshot_script()
except Exception as e:
    logger.warning(f"Could not place MQL5 screenshot script: {e}")
