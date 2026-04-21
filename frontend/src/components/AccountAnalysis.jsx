/**
 * AccountAnalysis — GFT-style comprehensive trade analytics dashboard.
 * Mirrors the Goat Funded Trader layout: Overview Stats, Calendar, Performance,
 * Distributions, Session/Symbol tables, Long/Short split, and deep metrics.
 */
import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, ReferenceLine, CartesianGrid,
  Legend,
} from 'recharts';

// ── Helpers ──
const fmt = (v, prefix = '$') => {
  if (v == null || v === undefined) return '—';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  const sign = n >= 0 ? '' : '-';
  return `${sign}${prefix}${Math.abs(n).toFixed(2)}`;
};

const pnlClass = (v) => (v > 0 ? 'gft-green' : v < 0 ? 'gft-red' : 'gft-neutral');
const pctBar = (wins, total) => total > 0 ? (wins / total * 100) : 50;

const COLORS = { green: '#10b981', red: '#ef4444', blue: '#3b82f6', cyan: '#22d3ee', grey: '#4b5563' };
const PAIR_COLORS = ['#22d3ee', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#06b6d4', '#a3e635'];

export function AccountAnalysis({ analytics, account }) {
  const [dirTab, setDirTab] = useState('all'); // all | long | short
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  if (!analytics || !analytics.advanced_metrics) {
    return (
      <div className="gft-loading">
        <div className="loading-spinner" />
        <p>Waiting for analytics data...</p>
      </div>
    );
  }

  const m = analytics.advanced_metrics;
  const ts = analytics.trade_summary || {};
  const dir = analytics.long_vs_short?.[dirTab] || {};

  // Calendar logic
  const calYear = parseInt(calMonth.split('-')[0]);
  const calMon = parseInt(calMonth.split('-')[1]);
  const calLabel = new Date(calYear, calMon - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  
  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMon - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMon, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday start
    const grid = [];
    // Previous month padding
    for (let i = 0; i < offset; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const data = analytics.calendar?.[dateStr];
      grid.push({day: d, date: dateStr, ...data});
    }
    return grid;
  }, [calMonth, analytics.calendar]);

  // Calendar month stats
  const calStats = useMemo(() => {
    const trades = Object.entries(analytics.calendar || {})
      .filter(([d]) => d.startsWith(calMonth))
      .map(([d, v]) => ({date: d, ...v}));
    const totalTrades = trades.reduce((s, t) => s + t.trades, 0);
    const pnl = trades.reduce((s, t) => s + t.pnl, 0);
    const wins = trades.reduce((s, t) => s + t.wins, 0);
    const wr = totalTrades > 0 ? (wins / totalTrades * 100).toFixed(2) : 0;
    const best = trades.length ? trades.reduce((a, b) => a.pnl > b.pnl ? a : b) : null;
    const worst = trades.length ? trades.reduce((a, b) => a.pnl < b.pnl ? a : b) : null;
    return { totalTrades, pnl, wr, best, worst };
  }, [calMonth, analytics.calendar]);

  const prevMonth = () => {
    const d = new Date(calYear, calMon - 2);
    setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(calYear, calMon);
    setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Cumulative PnL for chart
  const cumData = analytics.cumulative_pnl || [];

  // Pair daily distribution
  const pairSymbols = Object.keys(analytics.pair_daily_distribution || {});
  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pairDailyData = dayOrder.map(day => {
    const entry = { day: day.slice(0, 3) };
    pairSymbols.forEach(sym => {
      entry[sym] = analytics.pair_daily_distribution[sym]?.[day] || 0;
    });
    return entry;
  });

  return (
    <div className="gft-page">
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: Overview Stats (like GFT Trading Stats)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <h3 className="gft-section-title">Trading Stats</h3>
        <div className="gft-stats-row">
          <div className="gft-stat-box">
            <span className="gft-stat-label">Trades</span>
            <span className="gft-stat-value gft-white">{m.total_trades}</span>
          </div>
          <div className="gft-stat-box">
            <span className="gft-stat-label">Lots</span>
            <span className="gft-stat-value gft-white">{m.total_lots}</span>
          </div>
          <div className="gft-stat-box">
            <span className="gft-stat-label">Average RRR</span>
            <span className="gft-stat-value gft-cyan">{m.rr_ratio}</span>
          </div>
          <div className="gft-stat-box">
            <span className="gft-stat-label">Win Rate</span>
            <span className="gft-stat-value gft-amber">{m.win_rate}</span>
          </div>
        </div>
        <div className="gft-stats-row">
          <div className="gft-stat-box">
            <span className="gft-stat-label">Trading Days</span>
            <span className="gft-stat-value gft-white">{m.winning_days} / {m.total_trading_days}</span>
          </div>
          <div className="gft-stat-box">
            <span className="gft-stat-label">Most Traded Asset</span>
            <span className="gft-stat-value gft-white">
              {analytics.symbol_performance?.[0]?.symbol || '—'}
            </span>
          </div>
          <div className="gft-stat-box">
            <span className="gft-stat-label">Avg Winning Trade</span>
            <span className="gft-stat-value gft-green">{fmt(m.avg_winning_trade)}</span>
          </div>
          <div className="gft-stat-box">
            <span className="gft-stat-label">Avg Losing Trade</span>
            <span className="gft-stat-value gft-red">{fmt(m.avg_losing_trade)}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: Balance Equity Chart
          ═══════════════════════════════════════════════════════════════ */}
      {cumData.length > 0 && (
        <div className="gft-section">
          <h3 className="gft-section-title">Daily Net Cumulative P&L</h3>
          <div className="gft-chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={cumData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cumRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#111318', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`$${v.toFixed(2)}`, 'Cumulative P&L']}
                  labelFormatter={(l) => `Date: ${l}`}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke={cumData[cumData.length - 1]?.pnl >= 0 ? COLORS.green : COLORS.red}
                  fill={cumData[cumData.length - 1]?.pnl >= 0 ? 'url(#cumGreen)' : 'url(#cumRed)'}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick stat boxes below chart */}
          <div className="gft-chart-stats">
            <div className="gft-chart-stat green">
              <span>Total P&L</span><strong>{fmt(m.total_pnl)}</strong>
            </div>
            <div className="gft-chart-stat green">
              <span>Winning Trades</span><strong>{m.winning_trades}</strong>
            </div>
            <div className="gft-chart-stat red">
              <span>Losing Trades</span><strong>{m.losing_trades}</strong>
            </div>
            <div className="gft-chart-stat">
              <span>Trade Expectancy</span><strong>{fmt(m.trade_expectancy)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: Daily Net P&L Stats Grid
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <h3 className="gft-section-title">Daily Net P&L Stats</h3>
        <div className="gft-metrics-cards">
          <div className="gft-metric-card"><span>Total P&L</span><strong className={pnlClass(m.total_pnl)}>{fmt(m.total_pnl)}</strong></div>
          <div className="gft-metric-card"><span>Avg Trade P&L</span><strong className={pnlClass(m.avg_trade_pnl)}>{fmt(m.avg_trade_pnl)}</strong></div>
          <div className="gft-metric-card"><span>Avg Daily P&L</span><strong className={pnlClass(m.avg_daily_pnl)}>{fmt(m.avg_daily_pnl)}</strong></div>
          <div className="gft-metric-card"><span>Largest Profit</span><strong className="gft-green">{fmt(m.largest_profit)}</strong></div>
          <div className="gft-metric-card"><span>Largest Loss</span><strong className="gft-red">{fmt(m.largest_loss)}</strong></div>
          <div className="gft-metric-card"><span>Total Trades</span><strong className="gft-white">{m.total_trades}</strong></div>
          <div className="gft-metric-card"><span>Winning Trades</span><strong className="gft-green">{m.winning_trades}</strong></div>
          <div className="gft-metric-card"><span>Losing Trades</span><strong className="gft-red">{m.losing_trades}</strong></div>
        </div>
        <div className="gft-metrics-table">
          <div className="gft-mt-row">
            <span>Avg Winning Trade</span><strong className="gft-green">{fmt(m.avg_winning_trade)}</strong>
            <span>Avg Losing Trade</span><strong className="gft-red">{fmt(m.avg_losing_trade)}</strong>
            <span>Avg Daily Volume</span><strong>{m.avg_daily_volume}</strong>
            <span>Trade Expectancy</span><strong className={pnlClass(m.trade_expectancy)}>{fmt(m.trade_expectancy)}</strong>
          </div>
          <div className="gft-mt-row">
            <span>Avg Winning Day P&L</span><strong className="gft-green">{fmt(m.avg_winning_day_pnl)}</strong>
            <span>Avg Losing Day P&L</span><strong className="gft-red">{fmt(m.avg_losing_day_pnl)}</strong>
            <span>Total Commissions</span><strong>{fmt(m.total_commissions)}</strong>
            <span>Total Fees</span><strong>{m.total_fees ? fmt(m.total_fees) : '—'}</strong>
          </div>
          <div className="gft-mt-row">
            <span>Max Consecutive Wins</span><strong className="gft-green">{m.max_consecutive_wins}</strong>
            <span>Max Consecutive Losses</span><strong className="gft-red">{m.max_consecutive_losses}</strong>
            <span>Total Swap</span><strong>{fmt(m.total_swap)}</strong>
            <span>Profit Factor</span><strong className="gft-amber">{m.profit_factor}</strong>
          </div>
          <div className="gft-mt-row">
            <span>Largest Profitable Day</span><strong className="gft-green">{fmt(m.largest_profitable_day)}</strong>
            <span>Largest Losing Day</span><strong className="gft-red">{fmt(m.largest_losing_day)}</strong>
            <span>Largest Win</span><strong className="gft-green">{fmt(m.largest_profit)}</strong>
            <span>Largest Loss</span><strong className="gft-red">{fmt(m.largest_loss)}</strong>
          </div>
          <div className="gft-mt-row">
            <span>Max Consecutive Winning Days</span><strong className="gft-green">{m.max_consecutive_winning_days}</strong>
            <span>Max Consecutive Losing Days</span><strong className="gft-red">{m.max_consecutive_losing_days}</strong>
            <span>Logged Days</span><strong>{m.logged_days}</strong>
            <span>Open Trades</span><strong>{m.open_trades}</strong>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: Trade Performance (Doughnut + Win/Loss split)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <h3 className="gft-section-title">Trade Performance</h3>
        <div className="gft-perf-split">
          <div className="gft-perf-donut">
            <PieChart width={160} height={160}>
              <Pie
                data={[
                  { name: 'Wins', value: ts.wins || 0 },
                  { name: 'Losses', value: ts.losses || 0 },
                  { name: 'BE', value: ts.breakeven || 0 },
                ]}
                cx={80} cy={80} innerRadius={50} outerRadius={72}
                paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}
              >
                <Cell fill={COLORS.green} />
                <Cell fill={COLORS.red} />
                <Cell fill={COLORS.blue} />
              </Pie>
            </PieChart>
            <div className="gft-donut-center">
              <strong>{m.total_trades}</strong>
              <span>Trades</span>
            </div>
          </div>

          <div className="gft-perf-cols">
            <div className="gft-perf-col win">
              <div className="gft-perf-col-header"><span className="gft-dot green" /> Wins</div>
              <div className="gft-perf-row"><span>Total Wins</span><strong>{dir.total_winners}</strong></div>
              <div className="gft-perf-row"><span>Best Win</span><strong>{fmt(dir.best_win)}</strong></div>
              <div className="gft-perf-row"><span>Average Win</span><strong>{fmt(dir.avg_win)}</strong></div>
              <div className="gft-perf-row"><span>Average Win Streak</span><strong>{dir.avg_win_streak}</strong></div>
              <div className="gft-perf-row"><span>Max Win Streak</span><strong>{dir.max_win_streak}</strong></div>
              <div className="gft-perf-row"><span>Average Win Duration</span><strong>{dir.avg_win_duration}</strong></div>
            </div>
            <div className="gft-perf-col loss">
              <div className="gft-perf-col-header"><span className="gft-dot red" /> Losses</div>
              <div className="gft-perf-row"><span>Total Losses</span><strong>{dir.total_losers}</strong></div>
              <div className="gft-perf-row"><span>Worst Loss</span><strong>{fmt(dir.worst_loss)}</strong></div>
              <div className="gft-perf-row"><span>Average Loss</span><strong>{fmt(dir.avg_loss)}</strong></div>
              <div className="gft-perf-row"><span>Average Loss Streak</span><strong>{dir.avg_loss_streak}</strong></div>
              <div className="gft-perf-row"><span>Max Loss Streak</span><strong>{dir.max_loss_streak}</strong></div>
              <div className="gft-perf-row"><span>Average Loss Duration</span><strong>{dir.avg_loss_duration}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: Long/Short Trades (Tabbed)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <div className="gft-section-header-row">
          <h3 className="gft-section-title" style={{marginBottom: 0}}>Long/Short Trades</h3>
          <div className="gft-tab-group">
            {['all', 'long', 'short'].map(t => (
              <button key={t} className={`gft-tab ${dirTab === t ? 'active' : ''}`} onClick={() => setDirTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <p className="gft-section-desc">
          Filter by "LONG", "SHORT" or look at "ALL" your trades.
        </p>
        <div className="gft-perf-split compact">
          <div className="gft-perf-donut">
            <PieChart width={140} height={140}>
              <Pie
                data={[
                  { name: 'Wins', value: dir.total_winners || 0 },
                  { name: 'Losses', value: dir.total_losers || 0 },
                ]}
                cx={70} cy={70} innerRadius={42} outerRadius={62}
                paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}
              >
                <Cell fill={COLORS.green} />
                <Cell fill={COLORS.red} />
              </Pie>
            </PieChart>
            <div className="gft-donut-center sm">
              <strong>{dir.total_trades}</strong>
              <span>Total</span>
            </div>
          </div>
          <div className="gft-perf-cols">
            <div className="gft-perf-col win">
              <div className="gft-perf-col-header"><span className="gft-dot green" /> Winners</div>
              <div className="gft-perf-row"><span>Total Winners</span><strong>{dir.total_winners}</strong></div>
              <div className="gft-perf-row"><span>Best Win</span><strong>{fmt(dir.best_win)}</strong></div>
              <div className="gft-perf-row"><span>Average Win</span><strong>{fmt(dir.avg_win)}</strong></div>
              <div className="gft-perf-row"><span>Avg Win Duration</span><strong>{dir.avg_win_duration}</strong></div>
              <div className="gft-perf-row"><span>Max Win Streak</span><strong>{dir.max_win_streak}</strong></div>
            </div>
            <div className="gft-perf-col loss">
              <div className="gft-perf-col-header"><span className="gft-dot red" /> Losers</div>
              <div className="gft-perf-row"><span>Total Losers</span><strong>{dir.total_losers}</strong></div>
              <div className="gft-perf-row"><span>Worst Loss</span><strong>{fmt(dir.worst_loss)}</strong></div>
              <div className="gft-perf-row"><span>Average Loss</span><strong>{fmt(dir.avg_loss)}</strong></div>
              <div className="gft-perf-row"><span>Avg Loss Duration</span><strong>{dir.avg_loss_duration}</strong></div>
              <div className="gft-perf-row"><span>Max Loss Streak</span><strong>{dir.max_loss_streak}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6: Total Trades + Day of Week Distribution Bar Chart
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <div className="gft-two-col">
          <div className="gft-col-left">
            <h4>Total Trades</h4>
            <div className="gft-trade-bars">
              <div className="gft-trade-bar-row"><div className="gft-bar-label loss">Loss</div><div className="gft-bar-fill red" style={{width: `${ts.losses ? (ts.losses / m.total_trades * 100) : 0}%`}} /><strong className="gft-red">{ts.losses}</strong></div>
              <div className="gft-trade-bar-row"><div className="gft-bar-label win">Win</div><div className="gft-bar-fill green" style={{width: `${ts.wins ? (ts.wins / m.total_trades * 100) : 0}%`}} /><strong className="gft-green">{ts.wins}</strong></div>
              <div className="gft-trade-bar-row"><div className="gft-bar-label be">Breakeven</div><div className="gft-bar-fill blue" style={{width: `${ts.breakeven ? (ts.breakeven / m.total_trades * 100) : 0}%`}} /><strong className="gft-cyan">{ts.breakeven}</strong></div>
            </div>
          </div>
          <div className="gft-col-right">
            <h4>Trade Distribution by Day of Week</h4>
            <div className="gft-chart-container" style={{height: 200}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.weekday_distribution?.filter(d => d.count > 0) || []} margin={{top: 5, right: 10, left: -10, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{fill: '#6b7280', fontSize: 10}} tickFormatter={d => d.slice(0,3)} />
                  <YAxis tick={{fill: '#6b7280', fontSize: 10}} allowDecimals={false} />
                  <Tooltip contentStyle={{background: '#111318', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12}} />
                  <Bar dataKey="losses" stackId="a" fill={COLORS.red} name="Losses" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="wins" stackId="b" fill={COLORS.green} name="Wins" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 7: Weekday Summary Table
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <h3 className="gft-section-title">Weekday</h3>
        <table className="gft-table">
          <thead>
            <tr>
              <th>Day</th><th>Trades</th><th>Win Rate</th><th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {(analytics.summary_week || []).map(s => (
              <tr key={s.day}>
                <td className="gft-cyan">{s.day}</td>
                <td>{s.total_trades}</td>
                <td>
                  <div className="gft-wr-bar">
                    <div className="gft-wr-fill red" style={{width: `${100 - s.win_rate}%`}} />
                    <div className="gft-wr-fill green" style={{width: `${s.win_rate}%`}} />
                  </div>
                </td>
                <td>{s.net_profit > 0 ? `${s.net_profit.toFixed(2)}%` : `${s.net_profit.toFixed(2)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 8: Calendar View
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <div className="gft-cal-header">
          <button className="gft-cal-nav" onClick={prevMonth}>‹</button>
          <span className="gft-cal-title">{calLabel}</span>
          <button className="gft-cal-nav" onClick={nextMonth}>›</button>
          <div className="gft-cal-stats">
            <div><span>Total Trades</span><strong>{calStats.totalTrades}</strong></div>
            <div><span>P&L</span><strong className={pnlClass(calStats.pnl)}>{fmt(calStats.pnl)}</strong></div>
            <div><span>Best Day</span><strong className="gft-green">{calStats.best ? fmt(calStats.best.pnl) : '—'}</strong></div>
            <div><span>Worst Day</span><strong className="gft-red">{calStats.worst ? fmt(calStats.worst.pnl) : '—'}</strong></div>
            <div><span>Win Rate</span><strong className="gft-amber">{calStats.wr}%</strong></div>
          </div>
        </div>
        <div className="gft-cal-grid">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="gft-cal-day-header">{d}</div>
          ))}
          {calDays.map((d, i) => (
            <div key={i} className={`gft-cal-cell ${d && d.pnl != null ? (d.pnl > 0 ? 'win' : d.pnl < 0 ? 'loss' : '') : ''}`}>
              {d && (
                <>
                  <span className="gft-cal-date">{d.day}</span>
                  {d.pnl != null && (
                    <>
                      <span className={`gft-cal-pnl ${pnlClass(d.pnl)}`}>{fmt(d.pnl)}</span>
                      <span className="gft-cal-count">{d.trades} Trade{d.trades !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 9: Summary Pairs
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <h3 className="gft-section-title">Summary Pairs</h3>
        <table className="gft-table">
          <thead><tr><th>Pair</th><th>Net Profit</th><th>Winning %</th><th>Total Profit</th><th>Total Loss</th><th>Total Trades</th></tr></thead>
          <tbody>
            {(analytics.symbol_performance || []).map(s => (
              <tr key={s.symbol}>
                <td>{s.symbol}</td>
                <td className={pnlClass(s.net_profit)}>{fmt(s.net_profit)}</td>
                <td>
                  <div className="gft-wr-bar">
                    <div className="gft-wr-fill red" style={{width: `${100 - s.win_rate}%`}} />
                    <div className="gft-wr-fill green" style={{width: `${s.win_rate}%`}} />
                  </div>
                </td>
                <td className="gft-green">{fmt(s.total_profit)}</td>
                <td className="gft-red">{fmt(s.total_loss)}</td>
                <td>{s.total_trades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 10: Summary Session
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <h3 className="gft-section-title">Summary Session</h3>
        <table className="gft-table">
          <thead><tr><th>Session</th><th>Net Profit</th><th>Win Rate</th><th>Total Profit</th><th>Total Loss</th><th>Win Rate %</th><th>Total Trades</th></tr></thead>
          <tbody>
            {(analytics.session_performance || []).map(s => (
              <tr key={s.session}>
                <td style={{textTransform: 'capitalize'}}>{s.session}</td>
                <td className={pnlClass(s.net_profit)}>{fmt(s.net_profit)}</td>
                <td>
                  <div className="gft-wr-bar">
                    <div className="gft-wr-fill red" style={{width: `${100 - s.win_rate}%`}} />
                    <div className="gft-wr-fill green" style={{width: `${s.win_rate}%`}} />
                  </div>
                </td>
                <td className="gft-green">{fmt(s.total_profit)}</td>
                <td className="gft-red">{fmt(s.total_loss)}</td>
                <td>{s.win_rate}%</td>
                <td>{s.total_trades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 11: Distribution Charts (Hour / Day / Month / Symbol)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <div className="gft-two-col">
          <div>
            <h4 className="gft-chart-title">Trade Distribution by Hour (IST)</h4>
            <div className="gft-h-bars">
              {(analytics.hourly_distribution || []).map(h => (
                <div key={h.hour} className="gft-h-bar-row">
                  <span className="gft-h-label">{h.hour}</span>
                  <div className="gft-h-bar"><div className="gft-h-fill blue" style={{width: `${Math.max(3, (h.count / Math.max(...analytics.hourly_distribution.map(x => x.count), 1)) * 100)}%`}} /></div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="gft-chart-title">Performance by Hour (IST)</h4>
            <div className="gft-h-bars">
              {(analytics.hourly_distribution || []).map(h => {
                const maxAbs = Math.max(...analytics.hourly_distribution.map(x => Math.abs(x.pnl)), 1);
                return (
                  <div key={h.hour} className="gft-h-bar-row perf">
                    <span className="gft-h-label">{h.hour}</span>
                    <div className="gft-h-bar split">
                      <div className="gft-h-center" />
                      {h.pnl < 0 && <div className="gft-h-fill-left red" style={{width: `${(Math.abs(h.pnl) / maxAbs) * 50}%`}} />}
                      {h.pnl > 0 && <div className="gft-h-fill-right green" style={{width: `${(h.pnl / maxAbs) * 50}%`}} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Day + Month distributions */}
      <div className="gft-section">
        <div className="gft-two-col">
          <div>
            <h4 className="gft-chart-title">Trade Distribution by Day</h4>
            <div className="gft-h-bars">
              {(analytics.weekday_distribution || []).map(d => (
                <div key={d.day} className="gft-h-bar-row">
                  <span className="gft-h-label">{d.day}</span>
                  <div className="gft-h-bar"><div className="gft-h-fill blue" style={{width: `${d.count > 0 ? Math.max(3, (d.count / Math.max(...analytics.weekday_distribution.map(x => x.count), 1)) * 100) : 0}%`}} /></div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="gft-chart-title">Performance by Day</h4>
            <div className="gft-h-bars">
              {(analytics.weekday_distribution || []).map(d => {
                const maxAbs = Math.max(...analytics.weekday_distribution.map(x => Math.abs(x.pnl)), 1);
                return (
                  <div key={d.day} className="gft-h-bar-row perf">
                    <span className="gft-h-label">{d.day}</span>
                    <div className="gft-h-bar split">
                      <div className="gft-h-center" />
                      {d.pnl < 0 && <div className="gft-h-fill-left red" style={{width: `${(Math.abs(d.pnl) / maxAbs) * 50}%`}} />}
                      {d.pnl > 0 && <div className="gft-h-fill-right green" style={{width: `${(d.pnl / maxAbs) * 50}%`}} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Symbol distributions */}
      <div className="gft-section">
        <div className="gft-two-col">
          <div>
            <h4 className="gft-chart-title">Top 10 Symbol</h4>
            <div className="gft-h-bars">
              {(analytics.symbol_performance || []).slice(0, 10).map(s => (
                <div key={s.symbol} className="gft-h-bar-row">
                  <span className="gft-h-label">{s.symbol}</span>
                  <div className="gft-h-bar"><div className="gft-h-fill blue" style={{width: `${Math.max(3, (s.total_trades / Math.max(...analytics.symbol_performance.map(x => x.total_trades), 1)) * 100)}%`}} /></div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="gft-chart-title">Performance by Symbol</h4>
            <div className="gft-h-bars">
              {(analytics.symbol_performance || []).slice(0, 10).map(s => {
                const maxAbs = Math.max(...analytics.symbol_performance.map(x => Math.abs(x.net_profit)), 1);
                return (
                  <div key={s.symbol} className="gft-h-bar-row perf">
                    <span className="gft-h-label">{s.symbol}</span>
                    <div className="gft-h-bar split">
                      <div className="gft-h-center" />
                      {s.net_profit < 0 && <div className="gft-h-fill-left red" style={{width: `${(Math.abs(s.net_profit) / maxAbs) * 50}%`}} />}
                      {s.net_profit > 0 && <div className="gft-h-fill-right green" style={{width: `${(s.net_profit / maxAbs) * 50}%`}} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly distributions */}
      <div className="gft-section">
        <div className="gft-two-col">
          <div>
            <h4 className="gft-chart-title">Trade Distribution by Month</h4>
            <div className="gft-h-bars">
              {(analytics.monthly_distribution || []).map(m => (
                <div key={m.month} className="gft-h-bar-row">
                  <span className="gft-h-label">{m.month}</span>
                  <div className="gft-h-bar"><div className="gft-h-fill blue" style={{width: `${m.count > 0 ? Math.max(3, (m.count / Math.max(...analytics.monthly_distribution.map(x => x.count), 1)) * 100) : 0}%`}} /></div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="gft-chart-title">Performance by Month</h4>
            <div className="gft-h-bars">
              {(analytics.monthly_distribution || []).map(m => {
                const maxAbs = Math.max(...analytics.monthly_distribution.filter(x => x.pnl !== 0).map(x => Math.abs(x.pnl)), 1);
                return (
                  <div key={m.month} className="gft-h-bar-row perf">
                    <span className="gft-h-label">{m.month}</span>
                    <div className="gft-h-bar split">
                      <div className="gft-h-center" />
                      {m.pnl < 0 && <div className="gft-h-fill-left red" style={{width: `${(Math.abs(m.pnl) / maxAbs) * 50}%`}} />}
                      {m.pnl > 0 && <div className="gft-h-fill-right green" style={{width: `${(m.pnl / maxAbs) * 50}%`}} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 12: Pair Daily Distribution (stacked bar chart)
          ═══════════════════════════════════════════════════════════════ */}
      {pairSymbols.length > 0 && (
        <div className="gft-section">
          <div className="gft-two-col">
            <div>
              <h4>Total Pairs</h4>
              <div className="gft-pair-legend">
                {pairSymbols.map((sym, i) => (
                  <div key={sym} className="gft-pair-pill" style={{background: PAIR_COLORS[i % PAIR_COLORS.length] + '33', borderColor: PAIR_COLORS[i % PAIR_COLORS.length], color: PAIR_COLORS[i % PAIR_COLORS.length]}}>
                    {sym}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4>Pair Daily Distribution</h4>
              <div className="gft-chart-container" style={{height: 220}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pairDailyData} margin={{top: 5, right: 10, left: -10, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" tick={{fill: '#6b7280', fontSize: 10}} />
                    <YAxis tick={{fill: '#6b7280', fontSize: 10}} tickFormatter={v => `$${v}`} />
                    <Tooltip contentStyle={{background: '#111318', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12}} formatter={(v) => `$${v.toFixed(2)}`} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                    {pairSymbols.map((sym, i) => (
                      <Bar key={sym} dataKey={sym} fill={PAIR_COLORS[i % PAIR_COLORS.length]} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 13: Summary Week Table
          ═══════════════════════════════════════════════════════════════ */}
      <div className="gft-section">
        <h3 className="gft-section-title">Summary Week</h3>
        <table className="gft-table">
          <thead><tr><th>Day</th><th>Net Profit</th><th>Winning %</th><th>Total Profit</th><th>Total Loss</th><th>Total Trades</th></tr></thead>
          <tbody>
            {(analytics.summary_week || []).map(s => (
              <tr key={s.day}>
                <td className="gft-cyan">{s.day}</td>
                <td className={pnlClass(s.net_profit)}>{fmt(s.net_profit)}</td>
                <td>
                  <div className="gft-wr-bar">
                    <div className="gft-wr-fill red" style={{width: `${100 - s.win_rate}%`}} />
                    <div className="gft-wr-fill green" style={{width: `${s.win_rate}%`}} />
                  </div>
                </td>
                <td className="gft-green">{fmt(s.total_profit)}</td>
                <td className="gft-red">{fmt(s.total_loss)}</td>
                <td>{s.total_trades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
