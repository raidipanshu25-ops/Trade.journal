# 📈 AI Powered Trading Journal & Analytics

<div align="center">
  <p><strong>A powerful, fully-automated trading dashboard connecting MetaTrader 5 (MT5) with intelligent risk management, real-time analytics, and AI-powered performance coaching.</strong></p>
</div>

Built to help professional traders visualize their edge, track behavioral discipline, and optimize their strategy without emotional bias. Now supercharged with **MetaAPI Cloud Integration** and an **Embedded Web Terminal**.

---

## ✨ Key Features

- **☁️ Cloud MT5 Integration (MetaAPI):** Connect to your MT5 accounts entirely through the cloud using MetaAPI. No local MT5 terminal required! 
- **🌐 Embedded Web Terminal:** Execute trades directly from the journal's interface. Seamlessly switch between accounts and monitor active positions.
- **🛡️ Live Discipline & Risk Manager:** Set daily drawdown limits, max trades, and session-specific rules. The system automatically tags "revenge trades" and monitors hold times to enforce behavioral discipline in real time.
- **⚡ Real-Time Live Sync:** Streams open positions, account equity, and trade execution within milliseconds over WebSockets.
- **📊 Advanced Analytics:** Comprehensive dashboard rendering Risk/Reward metrics, Profit Factor, Expectancy, and psychological profilers indicating your patience vs. hope ratios.
- **🤖 AI-Powered Trade Coach:** Integrates with leading AI models (OpenAI/NVIDIA) to deliver personalized NLP-based insights on your historical performance.
- **🖼️ Chart Vision:** Upload or screenshot chart setups directly into the app for automatic AI analysis using vision models to review market structure and support/resistance invalidation.
- **👑 Admin & Access Controls:** Robust dashboard for administrators to manage MT5 connections, user access, and API configurations securely.
- **🔒 Multi-User Secure Auth:** Robust JWT-based backend with support for local Admin credentials, 2FA (OTP), and Google Single Sign-On (SSO).
- **💻 Responsive Premium UI:** Modern glassmorphism dynamic UI built with React + Vite, designed exactly like institutional trading terminal tiers.

---

## 🧠 Forced Discipline & Habit Building

The **MT5 Access Controller** is the core psychological edge of this journal. Human willpower is finite; when in a drawdown, emotions take over and trading rules are broken. This system creates a mechanical barrier to bad habits:

- **Hard Stops (No Overtrading):** The controller acts as a strict admin over your MT5 accounts. If you hit your daily max drawdown or max trade count, it automatically revokes your trading access. You literally *cannot* place another revenge trade.
- **Forced Pauses & Circuit Breakers:** By implementing automatic cooldown periods after consecutive losses, the system forces you to step away from the terminal. This stops the "tilt" spiral before it destroys your capital.
- **Rewiring Habits:** Over time, the knowledge that you *cannot* break your rules—even if you try—removes the anxiety of self-control. This forced, mechanical discipline rewires your brain, gradually turning strict risk management into an effortless, subconscious habit.

---

## 🛠️ Tech Stack

### Frontend
- **React.js (Vite)** for lightning-fast HMR and build performance.
- **Recharts** for beautiful, responsive data visualization.
- **WebSockets** for zero-latency bidirectional data streaming.
- **Google OAuth 2.0** for seamless user authentication.
- Pure customizable CSS styling (no heavy CSS frameworks) featuring dynamic mesh gradients and dark mode support.

### Backend
- **FastAPI (Python)** handling asynchronous network routing and REST architecture.
- **MetaAPI Cloud SDK & Native MT5 API** pulling market and account state across local or cloud environments.
- **SQLite / aiosqlite** database for lightning-fast local journaling and rule configuration.
- **PBKDF2 Password Hashing, pyOTP, and JWT** for highly secure backend verification and 2FA.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MetaTrader 5 Terminal (Optional if using MetaAPI Cloud)
- MetaAPI Cloud Account (Optional for cloud execution)

### 1️⃣ Running the Backend

```bash
cd backend
pip install -r requirements.txt
# Duplicate .env.example to .env and configure secrets (OpenAI API Key, MetaAPI Token, etc.)
python main.py
```

### 2️⃣ Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The application will perfectly bridge to your MT5 terminal (or cloud accounts) automatically while broadcasting securely on your local IPv4 network for remote mobile access!

---

<div align="center">
  <p><em>"Discipline is the edge. Every violation erodes your consistency. Protect your capital."</em></p>
</div>
