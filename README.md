# 📈 MT5 Trading Journal & AI Assistant

A powerful, fully-automated trading dashboard connecting MetaTrader 5 (MT5) with intelligent risk management, real-time analytics, and AI-powered performance coaching. 

Built to help professional traders visualize their edge, track behavioral discipline, and optimize their strategy without emotional bias.

## ✨ Features

- **⚡ Real-Time Live Sync:** Connects directly to any MT5 instance to stream open positions, account equity, and trade execution within milliseconds over WebSockets.
- **🛡️ Live Discipline & Risk Manager:** Set daily drawdown limits, max trades, and session-specific rules. The system automatically tags "revenge trades" and monitors hold times to enforce behavioral discipline in real time.
- **📊 Advanced Analytics:** Comprehensive dashboard rendering Risk/Reward metrics, Profit Factor, Expectancy, and psychological profilers indicating your patience vs. hope ratios.
- **🤖 AI-Powered Trade Coach:** Integrates with NVIDIA NIM (Kimi 2.5) to deliver personalized NLP-based insights on your historical performance.
- **🖼️ Chart Vision:** Upload or screenshot chart setups directly into the app for automatic AI analysis using vision models to review market structure and support/resistance invalidation.
- **🔒 Multi-User Secure Auth:** Robust JWT-based backend with support for local Admin credentials and Google Single Sign-On (SSO) bridging securely to the local dev server.
- **💻 Responsive Premium UI:** Modern glassmorphism dynamic UI built with React + Vite, designed exactly like institutional trading terminal tiers.

## 🛠️ Tech Stack

### Frontend
- **React.js (Vite)** for lightning-fast HMR and build performance.
- **WebSockets** for zero-latency bidirectional data streaming.
- **Google OAuth 2.0** for seamless user authentication.
- Pure customizable CSS styling (no heavy CSS frameworks) featuring dynamic mesh gradients and dark mode support.

### Backend
- **FastAPI (Python)** handling asynchronous network routing and REST architecture.
- **MetaTrader 5 Python API** pulling native market and account state.
- **SQLite** database for lightning-fast local journaling and rule configuration.
- **PBKDF2 Password Hashing** and JWT for highly secure backend verification.

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MetaTrader 5 Terminal installed and logged into a broker.

### Running the Backend

```bash
cd backend
pip install -r requirements.txt
# Duplicate .env.example to .env and configure secrets
python main.py
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The application will perfectly bridge to your MT5 terminal automatically while broadcasting securely on your local IPv4 network for remote mobile access!

---
*Discipline is the edge. Every violation erodes your consistency. Protect your capital.*
