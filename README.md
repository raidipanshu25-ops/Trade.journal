# 📈 AI Powered Trading Journal

> *"I knew I shouldn't take that trade. I took it anyway. I lost."*
> — Every trader, at least once a week.

---

## 💡 What If You Literally Couldn't Take That Trade?

Not a popup saying "are you sure?" — you'd click yes anyway.

Not a journal reminding you after the fact — the damage is already done.

**What if MetaTrader 5 physically shut down on your PC the moment you broke a rule?**

That's what this does.

---

## 🔒 The MT5 Access Controller — Your Trading Bodyguard

Think of it like a bouncer at a club. You can show up, but if your name isn't on the list — the door stays locked.

Every 30 seconds, the system checks:
- ✅ Are you inside a trading session?
- ✅ How many trades have you taken?
- ✅ What's your P&L today?
- ✅ Are you following your own rules?

**If any answer is wrong → MT5 gets force-closed.** You can try reopening it. It'll close again in 30 seconds. Every. Single. Time.

---

### ⏳ The 48-Hour Rule Locker (No More Changing Rules Mid-Session)

Every trader knows the feeling: you hit your max loss, you get tilted, and you go into your settings to "allow one more trade." **Not anymore.**

The system has a built-in psychological defense mechanism:
- 📉 **Tightening Risk:** Want to decrease your daily loss limit? Happens instantly.
- 📈 **Loosening Risk:** Want to increase your daily loss limit or add more trades? **You are locked out for 48 Hours.** 

If you try to loosen your rules to take a revenge trade, the system puts those new rules into a pending queue with a giant 48-hour countdown timer. You physically cannot overtrade or destroy your risk management while you are emotional.

---

### 📅 Your Custom Sessions & Limits

No more sitting in front of charts for 14 hours. You set **specific windows** to trade, with **strict limits** on each. You define the rules; the controller just enforces them.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   🌏 ASIA        Your Time → Your Time      Your Max Trades  │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─          │
│   🇬🇧 LONDON      Your Time → Your Time      Your Max Trades  │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─          │
│   🇺🇸 NEW YORK    Your Time → Your Time      Your Max Trades  │
│                                                              │
│   ⛔ Between sessions → MT5 is CLOSED. No exceptions.        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Once you hit your max trades for that session, you're done.** No overtrading. No "just one more."

---

### 🛑 The 5 Rules That Cannot Be Broken

| # | Rule | What Happens When Broken |
|---|------|--------------------------|
| 1 | **Session Limits** | MT5 force-closes and stays locked until next session |
| 2 | **0.8% Daily Loss** | New York session permanently blocked for the day |
| 3 | **Out-of-Session Trade** | Flagged as **COMPLETE VIOLATION** — discipline score drops by 40 points instantly |
| 4 | **15-Min Gap Between Trades** | Flagged as revenge trading — you're trading on emotion, not analysis |
| 5 | **Lot Size Exceeded** | Critical alert fires immediately — you're overleveraged |

**No warnings. No second chances. The system acts.**

---

### ⚡ The Override — Yes, It Exists. No, It Won't Save You.

There's a Force Open button for emergencies. But here's the catch:

- 🔸 Only works during the Asia session
- 🔸 Gives you a maximum of 2 extra trades, then locks itself
- 🔸 **Every single override is permanently logged with a timestamp**

```
[08:39:23] 🚨 EMERGENCY OVERRIDE: Force Open (Asian session)
[08:46:16] ⚡ Manual override cleared — automatic mode
[08:46:16] 🔴 MT5 CLOSED — Asia trades completed (2/2) — locked until London
```

At the end of the week, you'll see exactly how many times you fought your own system. That number? **That's your real discipline score.**

---

## 📊 Live Discipline Score — Your Daily Report Card

Every violation is tracked and scored in real-time:

```
    100/100 — Perfect day. Clean trades, within rules.
     75/100 — Minor warning (traded too fast, small gap violation)
     50/100 — Critical violation (exceeded session limit)
     10/100 — Complete violation (traded outside sessions)
      0/100 — Multiple violations. You need to stop and review.
```

| Violation | Point Penalty |
|-----------|--------------|
| Out-of-session trade | **-40 points** |
| Session limit exceeded | **-25 points** |
| Daily loss breached | **-25 points** |
| Lot size exceeded | **-25 points** |
| Revenge trade (< 15 min gap) | **-10 points** |

> 🎯 **The goal is simple: End every day at 100.** Not 99. Not "close enough." A perfect 100 means you followed every rule. Do that for 30 days straight and discipline is no longer something you practice — it's who you are.

---

## 🧠 How This Changes Your Brain

This isn't just software. It's a **habit machine.**

### Week 1-2: You'll Hate It
MT5 closes after your first trade. You want to take another. You can't. You feel frustrated. That frustration? That's the old pattern dying.

### Week 3-4: You'll Accept It
You stop planning the "extra trade" because you know the system won't allow it. Instead, you spend more time on your one setup. Your entries get better.

### Week 5-8: You Won't Need It
Taking one trade per session feels normal. The urge to overtrade is gone. You've done it so many times that discipline is no longer effort — it's your default.

> **The magic:** You don't build discipline by trying harder. You build it by making the wrong action impossible, over and over, until the right action becomes automatic.

---

## 🤖 AI That Actually Helps You Trade Better

- **Trade Coach:** Analyzes your last 50+ trades and tells you patterns you can't see yourself. *"You lose 73% of trades taken after 15:30 IST. Consider avoiding late London entries."*
- **Chart Vision:** Upload a screenshot of any chart. The AI breaks down the market structure, marks key levels, and tells you if your setup is valid or if you're seeing what you want to see.
- **Performance Insights:** Win rate by session, by day, by lot size. Profit factor trends. Expectancy calculations. Everything you need, nothing you don't.

---

## 🌐 Trade From Anywhere — Web Terminal + Cloud Sync

- Connect MT5 accounts through **MetaAPI Cloud** — no local MT5 installation needed
- Execute trades directly from the journal's **Web Terminal**
- Monitor multiple accounts with real-time position streaming over WebSockets
- Access the dashboard from your phone on the same WiFi network

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 5, Recharts, WebSockets, Google OAuth 2.0 |
| **Backend** | FastAPI (Python), async/await, APScheduler |
| **MT5** | Native MT5 API + MetaAPI Cloud SDK |
| **Database** | SQLite via aiosqlite (zero-config, local-first) |
| **Security** | JWT, PBKDF2, pyOTP (2FA), Google SSO |
| **Process Control** | psutil + Windows taskkill |

---

## 🚀 Setup Instructions (Step-by-Step)

You can run Trade.journal completely locally on your machine, or deploy the web dashboard to the cloud and just run the MT5 connector locally. 

### Prerequisites & Automatic Dependency Installer
Trade.journal automatically detects and installs missing dependencies for you!
If you are setting up on a new PC:
- **Automatic Setup**: Simply double-click **`install_dependencies.bat`** (or run `run_connector.bat --install`). It checks for Python (3.10-3.14), pip, required packages (`MetaTrader5`, `httpx`, `websockets`, `python-dotenv`, `psutil`), Node.js, and npm, and automatically installs anything missing.
- **Manual requirements** (if you prefer manual installation):
  1. **Python 3.11 or 3.12** (with "Add Python to PATH" enabled)
  2. **Node.js v18+** (with npm)
  3. **MetaTrader 5** (Windows Desktop)

---

### Option 1: One-Click Local Setup (Recommended)
If you want to run everything (Frontend, Backend, and MT5 Connector) on your own Windows PC:

1. **Download / Clone** this repository to your PC.
2. Double-click the **`start_app.bat`** file in the root directory.
   - *This will automatically detect Python, install all backend and frontend dependencies, and launch both servers.*
3. A browser window will automatically open to `http://localhost:5173`.
4. Go through the initial Onboarding Wizard to set up your account and sessions.
5. In the wizard, select **"Local App"** mode. Your MT5 terminal will be automatically detected and monitored.

---

### Option 2: Cloud Deployment + Local Connector (Recommended for Cloud)
If you deploy the backend to a cloud provider (like Render, Railway, or Heroku), your cloud server cannot directly access your desktop's MetaTrader 5 terminal. You need to run a lightweight local connector script on your PC:

1. Open your deployed Trade.journal web dashboard.
2. Complete the initial Onboarding Wizard and select **"Cloud Hosted"** mode, or navigate to **Settings -> MT5 Connector**.
3. Click **"Download Connector (.zip)"**.
4. Right-click the downloaded `.zip` file and select **Extract All...** to a permanent folder on your Windows PC (e.g., your Desktop or Documents folder).
5. Open the extracted folder and double-click **`run_connector.bat`**. 
   - *Alternatively, right-click `run_connector.ps1` and select "Run with PowerShell".*
   - *If Windows SmartScreen/Defender shows a warning, click "More info" then "Run anyway".*
   - *The script will automatically detect your Python installation, install required packages, and launch the MT5 Sync Agent.*
6. Keep the black terminal window open in the background while you trade. It will securely stream live data and positions directly to your cloud dashboard!

### Option 3: Manual Command Line Setup
If you prefer running the commands yourself:

**1. Start the Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

**2. Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**3. Start the MT5 Local Sync Agent (If running backend in cloud):**
```bash
# Get your Sync Token from the dashboard settings first
cd backend
pip install -r requirements_local.txt
python local_sync_agent.py
```

<div align="center">

### The Question Isn't Whether You Have a Good Strategy.

### The Question Is Whether You Can Stop Yourself From Destroying It.

**This system makes sure you can.**

---

*Every override is logged. Every clean day is progress. Every habit starts with a constraint.*

⭐ **Star this repo if you've ever taken a revenge trade you knew you shouldn't have.**

</div>
