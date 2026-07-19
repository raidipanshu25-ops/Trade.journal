# 📈 AI Powered Trading Journal & Analytics

> *"You don't lose money because you don't know what to do. You lose money because you can't stop yourself from doing what you know you shouldn't."*

---

## The Problem Every Trader Knows

You've blown accounts before. Not because your strategy was bad — but because after two losses in a row, something snapped. You took a third trade. Then a fourth. Then you doubled the lot size. By the time the session ended, a 0.5% drawdown turned into a 4% crater.

You've set rules for yourself a hundred times. *"Only 1 trade per session."* *"Stop after 0.8% daily loss."* And every time, in the heat of the moment, you broke them.

**Willpower doesn't scale. Systems do.**

This journal doesn't just *track* your discipline — it **enforces** it at the operating system level.

---

## 🔒 The MT5 Access Controller

This is not a dashboard widget. This is a **state machine that physically controls whether MetaTrader 5 can run on your computer.**

### How It Works

The controller runs a background tick every 30 seconds. It evaluates your current session, trade count, P&L, and rule compliance — then either **launches** or **force-kills** the MT5 terminal process (`terminal64.exe`). 

You cannot override it by reopening MT5 manually. The next tick will kill it again within 30 seconds.

### The Session Rules

Your trading day is divided into three strict session windows (IST):

| Session | Window | Base Trades | Bonus Trade Condition |
|---------|--------|-------------|----------------------|
| 🌏 **Asia** | 05:30 → 12:00 | 1 | +1 if net Asia P&L over last 2 days is profitable |
| 🇬🇧 **London** | 13:00 → 16:30 | 1 | +1 only if **both** Asia AND London trade 1 were profitable |
| 🇺🇸 **New York** | 19:00 → 22:00 | 1 | Blocked entirely if daily loss > 0.8% |

**Between sessions, MT5 is killed.** There is no trading during gaps. The terminal is physically closed.

### What Gets Enforced

- **Trade Count Locks:** Hit your session limit → MT5 is killed → locked until the next session window opens. No amount of clicking will bring it back.
- **Daily Loss Circuit Breaker:** If your daily drawdown exceeds 0.8% of account balance, the New York session is **permanently blocked** for the day. The controller won't open MT5 regardless of session time.
- **Out-of-Session Detection:** Any trade opened outside a defined session window is flagged as a `COMPLETE VIOLATION` with a severity score of -40 points. Your discipline score craters immediately.
- **Revenge Trade Prevention:** The 15-minute minimum gap between trades catches rapid-fire emotional re-entries. If you close a loss and immediately re-enter, the system flags it.
- **Lot Size Enforcement:** Positions exceeding your configured max lot size trigger instant critical alerts.
- **Bonus Trade Merit System:** You don't *get* extra trades — you **earn** them. A second Asia trade requires 2 consecutive profitable Asia sessions. A second London trade requires *every prior trade that day* to be green. This rewards patience and consistency, not volume.

### The Override System (Intentionally Difficult)

There is a Force Open button — but it's designed to make you *think*:

1. **Normal Override:** Only available during the Asia session. Grants a maximum of 2 additional trades, then auto-revokes.
2. **Emergency Override:** Requires explicit confirmation through a warning dialog. Every use is logged with a timestamp in the event log — creating a permanent record of every time you broke your own rules.
3. **Force Close:** Always available. Because the hardest discipline is knowing when to walk away, and sometimes you need a button for that.

Every override action is logged. Over time, your override frequency becomes a mirror — showing you exactly how often your emotions override your system.

---

## 🧠 Why This Turns Into Habits

Traditional trading psychology advice says *"be disciplined."* That's like telling an insomniac to *"just sleep."* It doesn't work because discipline is a finite resource that depletes under stress — exactly when you need it most.

The Access Controller works differently:

**Phase 1 — External Force (Weeks 1-4):**
You'll fight it. You'll hit the override button. You'll feel frustrated when MT5 closes after your first Asia trade. But you physically *cannot* take that revenge trade. The damage is contained.

**Phase 2 — Reduced Friction (Weeks 4-8):**
Your brain stops planning the "just one more" trade because it knows the system won't allow it. The mental energy you used to spend fighting urges gets freed up. You start analyzing setups more carefully because each trade *matters* — you only get one.

**Phase 3 — Internalized Habits (Weeks 8+):**
The constraint becomes your identity. *"I'm the trader who takes one trade per session."* You stop needing the controller to enforce limits because the limits are now your default mode of operation. The system trained your subconscious.

**The key insight:** You don't build habits by deciding to be better. You build habits by making the wrong action impossible, repeatedly, until the right action becomes automatic.

---

## ✨ Everything Else

Beyond the Access Controller, this is a full-featured trading infrastructure:

- **📊 Advanced Analytics:** Risk/Reward ratios, Profit Factor, Expectancy, win rates by session, and psychological profilers tracking patience vs. hope ratios.
- **🤖 AI Trade Coach:** Integrates with OpenAI / NVIDIA NIM models to deliver NLP-based performance insights from your trade history.
- **🖼️ Chart Vision Analysis:** Upload chart screenshots for automatic AI analysis — market structure, support/resistance validation, and setup quality scoring.
- **🌐 Web Terminal:** Execute trades directly from the journal interface via MetaAPI Cloud. No local MT5 installation required for trade execution.
- **☁️ MetaAPI Cloud Sync:** Connect MT5 accounts through the cloud. Monitor multiple accounts, stream positions in real-time over WebSockets.
- **⚡ Live Discipline Scoring:** A real-time score (0-100) calculated from active violations. Critical infractions (-25 each), out-of-session trades (-40 each), and warnings (-10 each) instantly reflect your compliance.
- **👑 Admin Panel:** Multi-user management with role-based access (Admin / User / Viewer), 2FA (TOTP), and Google SSO.
- **💻 Premium Terminal UI:** Glassmorphism dark-mode interface built with React + Vite. Designed to feel like institutional-grade software, not a side project.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 5, Recharts, WebSockets, Google OAuth 2.0 |
| **Backend** | FastAPI (Python), async/await architecture, APScheduler |
| **MT5 Integration** | Native MT5 Python API + MetaAPI Cloud SDK |
| **Database** | SQLite via aiosqlite (zero-config, local-first) |
| **Security** | JWT, PBKDF2 hashing, pyOTP (2FA), Google Auth |
| **Process Control** | psutil + Windows taskkill (MT5 Access Controller) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MetaTrader 5 Terminal (for local access control) or MetaAPI account (for cloud)

### Backend

```bash
cd backend
pip install -r requirements.txt
# Create .env with your API keys (OpenAI, MetaAPI token, Google OAuth, etc.)
python main.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The backend auto-detects your MT5 installation. The Access Controller begins enforcing session rules immediately.

The application broadcasts on your local network — access the dashboard from your phone on the same WiFi to monitor your session state remotely.

---

<div align="center">

*Every time you override the system, it's logged. Every time you don't, it's a habit forming.*

*Discipline is the edge. Protect your capital.*

</div>
