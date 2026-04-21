# TradeJournal — MT5 Live Trading Dashboard

> A professional-grade, real-time trading journal and discipline monitoring system for MetaTrader 5, built with a Python FastAPI backend and a React + Vite frontend styled after [io.net](https://io.net)'s design language.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Real-Time Sync** | WebSocket stream from MT5 — positions, account equity, P&L update every 1s |
| **Discipline Monitor** | Session-aware rule engine that tracks trade limits, daily loss caps, and revenge-trade patterns |
| **AI Trading Coach** | Powered by Kimi 2.5 (NVIDIA NIM) — professional post-session analysis with SMC-based feedback |
| **Chart Vision** | Upload chart screenshots → Llama 3.2 Vision reads patterns → Kimi generates structured entry coaching |
| **Psychology Profile** | Patience ratio, revenge trade count, avg win/loss hold duration |
| **Trade History** | Paginated closed-trade journal synced from MT5, with P&L stats and performance metrics |
| **Violation Alerts** | Real-time popup when rules are broken — with severity, detail, and corrective action |
| **Exness Launcher** | One-click launch of the Exness WebTerminal tab alongside the journal |

---

## 🖥️ Tech Stack

**Backend**
- Python 3.11 + FastAPI + WebSockets
- MetaTrader5 Python API (`mt5`)
- SQLite via `aiosqlite`
- NVIDIA NIM API (Kimi 2.5 + Llama 3.2 Vision)

**Frontend**
- React 18 + Vite
- Vanilla CSS (io.net design system)
- Fonts: Outfit (display) · Inter (body) · JetBrains Mono (data)
- No UI framework, no Tailwind — pure CSS custom properties

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MetaTrader 5 desktop app (Windows)
- NVIDIA NIM API key (optional — for AI analysis)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env
echo "NVIDIA_API_KEY=nvapi-YOUR-KEY-HERE" > .env

# Start server
python main.py
# Server runs at http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:5173
```

### 3. Connect MT5
- Open MetaTrader 5 on Windows
- The backend auto-connects on startup via the MT5 Python API
- Dashboard shows **MT5 Online** in the sidebar when connected

---

## 📁 Project Structure

```
TradingJournal/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket broadcast
│   ├── mt5_service.py       # MT5 connection, position/account sync
│   ├── discipline_checker.py # Rule engine — session limits, loss caps
│   ├── ai_analyzer.py       # Kimi 2.5 post-session analysis
│   ├── vision_analyzer.py   # Llama 3.2 Vision chart reading pipeline
│   ├── database.py          # SQLite trade journal
│   ├── config.py            # Settings loader
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── App.jsx          # Routing + all page layouts
        ├── hooks.js         # useDashboard + useLiveData (WebSocket)
        ├── api.js           # REST client
        ├── index.css        # io.net design system (2000+ lines)
        └── components/
            ├── Sidebar.jsx
            ├── StatCard.jsx
            ├── TradesTable.jsx
            ├── ScoreGauge.jsx
            ├── AlertFeed.jsx
            ├── AIPanel.jsx
            ├── ChartVisionPage.jsx
            ├── HistoryPage.jsx
            └── SettingsPage.jsx
```

---

## ⚙️ Discipline Rules (Configurable)

All rules are saved in `backend/settings.json` and editable via the Settings page:

- Max trades per day / per session
- Max lot size
- Max daily loss % (of account balance)
- Max session loss %
- Session windows (London, New York, Asia) with individual trade limits
- Global trading time window restriction

---

## 🤖 AI Analysis

The AI Coach uses a two-model pipeline:

1. **Llama 3.2 Vision** (NVIDIA NIM) — reads uploaded chart screenshots and extracts SMC patterns, S/R levels, trend direction
2. **Kimi 2.5** (NVIDIA NIM) — receives screened data + journal stats and generates structured coaching: what to wait for, perfect entry description, SL/TP levels, confluence checklist

Set `NVIDIA_API_KEY` in `backend/.env` to enable.

---

## 📊 Dashboard Metrics

| Metric | Source |
|---|---|
| Net P&L, Win Rate | Daily trade stats via MT5 |
| Risk/Reward Ratio | Journal stats (closed trades) |
| Expectancy / Profit Factor | Rolling daily + weekly + all-time |
| Discipline Score (0-100) | Violation deductions from rule engine |
| Patience Ratio | Avg win hold / avg loss hold |
| Revenge Trades | Trades opened < 5 min after a loss |

---

## 🔐 Security

- API keys never exposed to frontend
- MT5 connection is local-only (Python ↔ MT5 desktop)
- No cloud accounts or data transmission (except NVIDIA NIM API calls for AI)

---

## 📝 License

MIT — free to use, modify, and distribute.

---

*Built to eliminate emotional trading, enforce discipline, and systematically improve edge.*
