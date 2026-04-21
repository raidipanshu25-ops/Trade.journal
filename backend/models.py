"""
Pydantic models for API request/response schemas.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TradeInfo(BaseModel):
    ticket: int
    symbol: str
    type: str          # "BUY" or "SELL"
    volume: float
    open_price: float
    current_price: float
    open_time: str
    duration_minutes: float
    profit: float
    sl: float
    tp: float
    comment: str = ""


class AccountInfo(BaseModel):
    balance: float
    equity: float
    margin: float
    free_margin: float
    profit: float
    leverage: int
    currency: str
    server: str
    name: str


class DailyStats(BaseModel):
    date: str
    total_trades: int
    winning_trades: int
    losing_trades: int
    total_profit: float
    total_loss: float
    net_pnl: float
    win_rate: float
    avg_duration_minutes: float
    largest_win: float
    largest_loss: float
    symbols_traded: list[str]


class SessionStats(BaseModel):
    session_name: str
    trade_count: int
    net_pnl: float
    within_limit: bool


class AlertItem(BaseModel):
    id: Optional[int] = None
    timestamp: str
    rule: str
    severity: str       # "warning", "critical"
    message: str
    details: str = ""
    acknowledged: bool = False


class DisciplineReport(BaseModel):
    date: str
    total_violations: int
    alerts: list[AlertItem]
    session_stats: list[SessionStats]
    overall_score: int     # 0-100
    ai_analysis: Optional[str] = None


class RulesConfig(BaseModel):
    max_trades_per_day: int = 3
    max_trades_per_session: int = 2
    max_lot_size: float = 1.0
    max_daily_loss_pct: float = 3.0
    max_session_loss_pct: float = 2.0
    sessions: dict = {}
    allowed_trading_window: dict = {}
    allowed_symbols: list[str] = []


class AIAnalysisRequest(BaseModel):
    date: Optional[str] = None    # defaults to today
    custom_prompt: Optional[str] = None
