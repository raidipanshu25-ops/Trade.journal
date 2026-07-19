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

### 📅 Your Day, Divided Into 3 Sessions

No more sitting in front of charts for 14 hours. You get **specific windows** to trade, with **strict limits** on each:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   🌏 ASIA        05:30 → 12:00 IST      1 Trade allowed     │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │
│   🇬🇧 LONDON      13:00 → 16:30 IST      1 Trade allowed     │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │
│   🇺🇸 NEW YORK    19:00 → 22:00 IST      1 Trade allowed     │
│                                                              │
│   ⛔ Between sessions → MT5 is CLOSED. No exceptions.        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Maximum 3 trades per day.** That's it. No overtrading. No "just one more."

---

### 🏆 Want More Trades? Earn Them.

Extra trades aren't given — they're **unlocked through consistent performance:**

| Bonus | How You Earn It |
|-------|----------------|
| **+1 Asia trade** | Your last 2 days of Asia trades must both be profitable |
| **+1 London trade** | Asia trade today was green ✅ AND London trade 1 was green ✅ |
| **NY session access** | Only if your daily loss is under 0.8%. Lose more → NY is locked for the day |

> 💡 **Simple idea:** The system rewards you for being consistent, not for trading more. If you're winning with quality setups, you earn the right to take more. If you're losing, it protects you from yourself.

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

## 🚀 Setup (5 Minutes)

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

MT5 is auto-detected. The Access Controller starts enforcing immediately. No configuration needed.

---

<div align="center">

### The Question Isn't Whether You Have a Good Strategy.

### The Question Is Whether You Can Stop Yourself From Destroying It.

**This system makes sure you can.**

---

*Every override is logged. Every clean day is progress. Every habit starts with a constraint.*

⭐ **Star this repo if you've ever taken a revenge trade you knew you shouldn't have.**

</div>
