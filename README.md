# AlgoRoom — Algorithmic Trading Platform

AlgoRoom is a full-stack algorithmic trading platform that lets you build, backtest, and monitor trading strategies. It features a visual strategy builder, a Python-powered backtesting engine, live trading dashboards, and portfolio tracking.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [Architecture](#architecture)
- [API Routes](#api-routes)
- [Python Engine](#python-engine)
- [Contributing](#contributing)

---

## Features

- **Strategy Builder** — Create multi-leg options strategies with configurable indicators, order types, risk management, and advanced features (trailing stops, re-entry, move SL to cost, etc.)
- **Backtesting** — Run strategies against historical OHLC candle data via a FastAPI Python engine. Supports RSI-based signals with plans for Bollinger Bands, MACD, EMA crossovers, and more.
- **Live Trading Dashboard** — Monitor open positions and real-time P&L.
- **Strategies Library** — Save, manage, and reuse your custom strategies.
- **Portfolio & Trade History** — View completed trades with entry/exit times and detailed metrics.
- **Authentication** — Secure sign-up/sign-in powered by [Clerk](https://clerk.com/).

---

## Tech Stack

| Layer           | Technology                                     |
| --------------- | ---------------------------------------------- |
| Frontend        | React 18, Vite, Tailwind CSS, Recharts         |
| Backend         | Node.js, Express, Mongoose (MongoDB)           |
| Auth            | Clerk (`@clerk/clerk-react`, `@clerk/express`) |
| Backtest Engine | Python, FastAPI, Uvicorn, Pandas, NumPy        |

---

## Project Structure

```
AlgoRoom/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/           # Dashboard, StrategyBuilder, Strategies, Backtesting, LiveTrading
│       ├── components/      # Navbar, Sidebar, StrategyModal, EquityCurve, etc.
│       ├── context/         # AuthContext (Clerk + Axios)
│       ├── hooks/
│       ├── services/        # Axios API client
│       └── utils/
│
├── server/                  # Node.js/Express backend
│   ├── config/              # MongoDB connection
│   ├── controllers/         # Route handlers
│   ├── middleware/          # Auth & validation middleware
│   ├── models/              # Mongoose models (User, Strategy, Backtest, Trade, Position)
│   ├── routes/              # /api/auth, /api/strategies, /api/backtest, /api/trades
│   ├── services/
│   ├── utils/
│   └── python-engine/       # FastAPI Python backtest engine
│       ├── main.py
│       ├── requirements.txt
│       └── app/
│           ├── engines/     # Backtest, strike selection, position manager, risk engine
│           ├── indicators/  # RSI, MACD, Bollinger Bands, EMA, etc.
│           ├── routers/     # /backtest, /health
│           └── schemas/     # Pydantic request/response models
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **Python** 3.9+
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- A [Clerk](https://clerk.com/) account (for authentication keys)

### Environment Variables

**`server/.env`**

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/algoroom
CLERK_SECRET_KEY=your_clerk_secret_key
```

**`client/.env`**

```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_URL=http://localhost:5000/api
```

### Installation

```bash
# 1. Install root dependencies (if any)
npm install

# 2. Install backend dependencies
cd server
npm install

# 3. Install frontend dependencies
cd ../client
npm install

# 4. Install Python engine dependencies
cd ../server/python-engine
pip install -r requirements.txt
```

### Running the App

Open three terminal windows:

```bash
# Terminal 1 — Node.js backend (http://localhost:5000)
cd server
npm run dev

# Terminal 2 — React frontend (http://localhost:5173)
cd client
npm run dev

# Terminal 3 — Python backtest engine (http://localhost:8001)
cd server/python-engine
python main.py
```

### Reliable Windows Startup

Use these scripts from the repository root to always run the correct Python interpreter:

```powershell
# Start only Python engine (forces .venv312 interpreter on port 8001)
powershell -ExecutionPolicy Bypass -File .\scripts\start-python-engine.ps1 -ForceRestart

# Start backend + frontend + python engine in separate terminals
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev-stack.ps1
```

If you manually start backend, use the correct command in [server/package.json](server/package.json):

```bash
cd server
npm run dev
```

---

## Architecture

```
Browser (React)
     │
     ├──► Express API (Node.js :5000)
     │         ├── MongoDB (Mongoose)
     │         └── Clerk Auth
     │
     └──► Python Engine (FastAPI :8000)
               └── Backtest / Signal Processing
```

- The React frontend communicates with the Express backend for user data, strategies, and trade history.
- When the user triggers a backtest, the Express backend (or frontend directly) forwards the request to the FastAPI Python engine, which processes candle data, runs signal generation, and returns P&L metrics.

---

## API Routes

### Express Backend (`/api`)

| Method         | Route                 | Description                |
| -------------- | --------------------- | -------------------------- |
| GET            | `/api/auth/me`        | Sync Clerk user to MongoDB |
| GET/POST       | `/api/strategies`     | List / create strategies   |
| GET/PUT/DELETE | `/api/strategies/:id` | Manage a strategy          |
| POST           | `/api/backtest`       | Run a backtest             |
| GET            | `/api/trades`         | Get trade history          |

### Python Engine

| Method | Route       | Description                 |
| ------ | ----------- | --------------------------- |
| GET    | `/health`   | Health check                |
| POST   | `/backtest` | Run backtest on candle data |

**Backtest request body:**

```json
{
  "candles": [
    {
      "timestamp": "2025-03-30 09:16:00",
      "open": 24500,
      "high": 24520,
      "low": 24480,
      "close": 24505,
      "volume": 100000
    }
  ],
  "strategy": {
    "strategyType": "INDICATOR_BASED",
    "instruments": ["NIFTY"],
    "legs": [
      {
        "qty": 50,
        "position": "BUY",
        "optionType": "CALL",
        "strikeType": "ATM",
        "slType": "SL%",
        "sl": 5,
        "tpType": "TP%",
        "tp": 10
      }
    ],
    "orderConfig": {
      "type": "MIS",
      "startTime": "09:16",
      "squareOff": "15:15",
      "activeDays": ["MON", "TUE", "WED", "THU", "FRI"]
    },
    "riskManagement": {
      "exitOnProfit": 1000,
      "exitOnLoss": -500,
      "profitTrailing": "TRAIL_PROFIT"
    }
  }
}
```

---

## Python Engine

The Python engine is built with [FastAPI](https://fastapi.tiangolo.com/) and handles all heavy backtesting computation.
Run using this locally : py -V:Astral\CPython3.12.13 main.py
**Currently supported:**

- RSI indicator calculation
- Long-only trade simulation on OHLC candle data
- P&L, win rate, and trade result reporting

**Planned (see `PYTHON_ENGINE_SPEC.md`):**

- Multi-leg options strategies (BUY/SELL CALL/PUT)
- Strike selection (ATM, OTM, ITM)
- Additional indicators: Bollinger Bands, MACD, EMA Crossover, Stochastic
- Time-based trading rules and active day filtering
- Stop-loss / take-profit (% and points), trailing stops
- Global profit/loss limits and re-entry logic

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request
