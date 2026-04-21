import { useState, useEffect } from 'react';
import { useDashboard, useLiveData } from './hooks';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { ScoreGauge } from './components/ScoreGauge';
import { AlertFeed } from './components/AlertFeed';
import { TradesTable } from './components/TradesTable';
import { AIPanel } from './components/AIPanel';
import { SettingsPage, applyBgPreset, applyAccentPreset, applyTextPreset } from './components/SettingsPage';
import { HistoryPage } from './components/HistoryPage';
import { ChartVisionPage } from './components/ChartVisionPage';
import { AccountAnalysis } from './components/AccountAnalysis';
import { LoginPage } from './components/LoginPage';
import { api } from './api';

function App() {
  const [page, setPage] = useState('dashboard');
  const dash = useDashboard();  // lightweight: health + loading status only
  const live = useLiveData();   // WebSocket: positions, account, discipline, stats — everything

  // ── Theme (dark/light) ──
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('tj-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tj-theme', theme);
    // Re-apply presets for the new theme (gradients are theme-aware)
    applyBgPreset(localStorage.getItem('tj-bg') || 'solid', theme);
    applyTextPreset(localStorage.getItem('tj-text') || 'default', theme);
  }, [theme]);

  // Apply saved appearance preferences on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('tj-theme') || 'dark';
    applyBgPreset(localStorage.getItem('tj-bg') || 'solid', savedTheme);
    applyAccentPreset(localStorage.getItem('tj-accent') || 'cyan');
    applyTextPreset(localStorage.getItem('tj-text') || 'default', savedTheme);
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // ── Authentication ──
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // If no ADMIN_PASSWORD is set, backend will return a token "no-auth-required", 
    // but initially we assume auth unless there's an error. We'll start by assuming 
    // we need a token if it's stored, or let the first /health call decide.
    // To cleanly bootstrap, we assume authenticated until API throws 401.
    return !!localStorage.getItem('tj-auth-token');
  });

  useEffect(() => {
    const handleAuthExpired = () => setIsAuthenticated(false);
    window.addEventListener('auth-expired', handleAuthExpired);
    
    // Always check health on mount to see if auth is disabled or we are valid
    api.health().then(() => {
       setIsAuthenticated(true);
    }).catch(err => {
       if (err.message.includes('401')) setIsAuthenticated(false);
    });

    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  // All data now flows through the WebSocket
  const positions = live.positions;
  const account = live.account;
  const mt5Connected = live.connected || dash.mt5Connected;

  const alertCount = live.discipline?.alerts?.length || 0;
  const score = live.discipline?.score ?? 100;
  const stats = live.dailyStats || {};
  const journalStats = live.journalStats || null;
  const violationsPopup = live.discipline?.violations_popup || [];
  const analytics = live.analytics;

  // Track dismissed popup so it doesn't spam (reset if violations change)
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [lastViolationKey, setLastViolationKey] = useState('');

  useEffect(() => {
    const key = violationsPopup.map(v => v.rule).sort().join(',');
    if (key !== lastViolationKey) {
      setPopupDismissed(false);
      setLastViolationKey(key);
    }
  }, [violationsPopup]);

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
        mt5Connected={mt5Connected}
        aiAvailable={dash.aiAvailable}
        alertCount={alertCount}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="main-content">
        {/* ===== Violations Popup Modal ===== */}
        {page === 'dashboard' && violationsPopup.length > 0 && !popupDismissed && (
          <div className="violation-overlay" onClick={() => setPopupDismissed(true)}>
            <div className="violation-modal" onClick={(e) => e.stopPropagation()}>
              <div className="violation-modal-header">
                <div className="violation-modal-icon">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <h2>⚠️ Rule Violation{violationsPopup.length > 1 ? 's' : ''} Detected</h2>
                <button className="violation-close" onClick={() => setPopupDismissed(true)}>✕</button>
              </div>
              <div className="violation-modal-body">
                {violationsPopup.map((v, i) => (
                  <div key={i} className={`violation-item violation-${v.severity}`}>
                    <div className="violation-item-title">{v.title}</div>
                    <div className="violation-item-detail">{v.detail}</div>
                    <div className="violation-item-action">{v.action}</div>
                  </div>
                ))}
              </div>
              <div className="violation-modal-footer">
                <div className="violation-reminder">
                  <strong>Remember:</strong> Discipline is the edge. Every violation erodes your consistency.
                  Protect your capital — trade only within your rules.
                </div>
                <button className="violation-dismiss-btn" onClick={() => setPopupDismissed(true)}>
                  I Understand — Close
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ----------------------------- Dashboard ----------------------------- */}
        {page === 'dashboard' && (
          <div>
            <div className="page-header">
              <h2>Dashboard</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <p>Real-time overview of your MT5 trading activity and discipline.</p>
                <div className={`ws-indicator ${live.wsStatus}`} title={`WebSocket: ${live.wsStatus}`}>
                  <span className="ws-dot" />
                  <span className="ws-label">{live.wsStatus === 'open' ? 'LIVE' : live.wsStatus === 'fallback' ? 'POLL' : 'SYNC'}</span>
                </div>
              </div>
            </div>

            {!mt5Connected && !dash.loading && (
              <div className="connection-banner">
                <div className="connection-banner-icon">
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.36 5.64a9 9 0 0 1 0 12.73"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                </div>
                <div className="connection-banner-text">
                  <h3>MT5 Not Connected</h3>
                  <p>Make sure MetaTrader 5 is running and click reconnect.</p>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto' }}
                  onClick={async () => {
                    await api.reconnect();
                    dash.refresh();
                  }}
                  id="reconnect-btn"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Reconnect
                </button>
              </div>
            )}

            {/* Stats Grid */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <StatCard
                title="Total Trades"
                value={stats.total_trades ?? '—'}
                subtitle={`${stats.open_position_count ?? positions.length} open now`}
                type="neutral"
              />
              <StatCard
                title="Net P&L"
                value={stats.net_pnl != null ? `${stats.net_pnl >= 0 ? '+' : ''}${stats.net_pnl.toFixed(2)}` : '—'}
                subtitle={`Win: ${stats.total_profit?.toFixed(2) ?? '0'} | Loss: ${stats.total_loss?.toFixed(2) ?? '0'}`}
                type={stats.net_pnl >= 0 ? 'profit' : stats.net_pnl < 0 ? 'loss' : 'neutral'}
              />
              <StatCard
                title="Win Rate"
                value={stats.win_rate != null ? `${stats.win_rate}%` : '—'}
                subtitle={journalStats?.weekly?.win_rate != null
                  ? `W: ${journalStats.weekly.win_rate}% | All: ${journalStats.overall?.win_rate ?? '—'}%`
                  : `${stats.winning_trades ?? 0}W / ${stats.losing_trades ?? 0}L`}
                type={stats.win_rate >= 50 ? 'profit' : stats.win_rate > 0 ? 'loss' : 'neutral'}
              />
              <StatCard
                title="Risk / Reward"
                value={(() => {
                  const d = journalStats?.daily;
                  if (!d || d.trades === 0) return '—';
                  return d.rr_ratio != null ? d.rr_ratio : '—';
                })()}
                subtitle={journalStats?.weekly?.rr_ratio != null
                  ? `W: ${journalStats.weekly.rr_ratio} | All: ${journalStats.overall?.rr_ratio ?? '—'}`
                  : 'Avg Win / Loss ratio'}
                type={(() => {
                  const rr = journalStats?.daily?.rr_ratio;
                  const hasTrades = (journalStats?.daily?.trades ?? 0) > 0;
                  if (!hasTrades) return 'neutral';
                  if (typeof rr === 'number') return rr >= 1.0 ? 'profit' : 'loss';
                  return rr === '∞' ? 'profit' : 'neutral';
                })()}
              />
              <StatCard
                title="Expectancy"
                value={(() => {
                  const d = journalStats?.daily;
                  if (!d || d.trades === 0) return '—';
                  return d.expectancy != null ? `$${d.expectancy}` : '—';
                })()}
                subtitle={journalStats?.weekly?.expectancy != null
                  ? `W: $${journalStats.weekly.expectancy} | All: $${journalStats.overall?.expectancy ?? '—'}`
                  : 'Expected $ per trade'}
                type={(() => {
                  const e = journalStats?.daily?.expectancy;
                  const hasTrades = (journalStats?.daily?.trades ?? 0) > 0;
                  if (!hasTrades) return 'neutral';
                  if (typeof e === 'number') return e > 0 ? 'profit' : e < 0 ? 'loss' : 'neutral';
                  return 'neutral';
                })()}
              />
              <StatCard
                title="Profit Factor"
                value={(() => {
                  const d = journalStats?.daily;
                  if (!d || d.trades === 0) return '—';
                  return d.profit_factor != null ? d.profit_factor : '—';
                })()}
                subtitle={journalStats?.weekly?.profit_factor != null
                  ? `W: ${journalStats.weekly.profit_factor} | All: ${journalStats.overall?.profit_factor ?? '—'}`
                  : 'Gross Profit / Loss'}
                type={(() => {
                  const pf = journalStats?.daily?.profit_factor;
                  const hasTrades = (journalStats?.daily?.trades ?? 0) > 0;
                  if (!hasTrades) return 'neutral';
                  if (typeof pf === 'number') return pf >= 1.5 ? 'profit' : pf > 0 ? 'loss' : 'neutral';
                  return pf === '∞' ? 'profit' : 'neutral';
                })()}
              />
              <StatCard
                title="Account Equity"
                value={account ? `$${account.equity.toLocaleString()}` : '—'}
                subtitle={account ? `Balance: $${account.balance.toLocaleString()} | P&L: ${account.profit >= 0 ? '+' : ''}${account.profit?.toFixed(2) ?? '0'}` : ''}
                type={account?.profit >= 0 ? 'profit' : account?.profit < 0 ? 'loss' : 'neutral'}
              />
            </div>

            {/* Two column: Score + Alerts */}
            <div className="content-grid">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Discipline Score</span>
                </div>
                <ScoreGauge score={score} />
                {/* Session pills */}
                {live.discipline?.session_stats && (
                  <div className="session-pills" style={{ justifyContent: 'center', marginTop: 'var(--space-md)', flexWrap: 'wrap', gap: '8px' }}>
                    {live.discipline.session_stats.map(s => {
                      const sessionNameLower = s.session_name.toLowerCase();
                      const wr = journalStats?.session_win_rates?.[sessionNameLower]?.win_rate;
                      const maxT = s.max_trades || s.trade_count;
                      const bonusLabel = s.bonus > 0 ? ` (+${s.bonus})` : '';
                      return (
                        <div key={s.session_name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span className={`session-pill ${s.within_limit ? 'ok' : 'breach'}`}>
                            {s.session_name}: {s.trade_count}/{maxT}{bonusLabel}
                          </span>
                          {wr !== undefined && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '4px' }}>
                              WR: {wr}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Alert Feed</span>
                </div>
                <AlertFeed alerts={live.discipline?.alerts || []} />
              </div>
              
              {/* Psychology Profile Card */}
              <div className="card content-grid-full">
                <div className="card-header">
                  <span className="card-title">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'text-bottom'}}>
                      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                      <path d="M12 14c-2.3 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4Z" />
                      <path d="M12 14v7" />
                    </svg>
                    Psychology Profile
                  </span>
                </div>
                <div className="stats-grid" style={{ marginBottom: 0 }}>
                    <StatCard
                      title="Patience Ratio"
                      value={
                        (stats.avg_loss_duration_minutes || 0) > 0
                          ? ((stats.avg_win_duration_minutes || 0) / stats.avg_loss_duration_minutes).toFixed(2)
                          : (stats.avg_win_duration_minutes || 0) > 0 ? "Infinite" : "—"
                      }
                      subtitle={`Avg Win Hold: ${stats.avg_win_duration_minutes ?? 0}m | Loss Hold: ${stats.avg_loss_duration_minutes ?? 0}m`}
                      type={(stats.avg_loss_duration_minutes || 0) > 0 && ((stats.avg_win_duration_minutes || 0) / stats.avg_loss_duration_minutes) > 1 ? 'profit' : 'loss'}
                    />
                    <StatCard
                      title="Revenge Trades"
                      value={stats.revenge_trades_count ?? '—'}
                      subtitle="Trades < 5m after a loss"
                      type={(stats.revenge_trades_count || 0) > 0 ? 'loss' : 'profit'}
                    />
                    <StatCard
                      title="Avg Win Hold"
                      value={`${stats.avg_win_duration_minutes ?? 0}m`}
                      subtitle="Patience with winners"
                      type="neutral"
                    />
                    <StatCard
                      title="Avg Loss Hold"
                      value={`${stats.avg_loss_duration_minutes ?? 0}m`}
                      subtitle="Hope with losers"
                      type="neutral"
                    />
                </div>
              </div>
            </div>

            {/* Open positions preview — REAL-TIME via WebSocket */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Open Positions</span>
                <div className={`ws-indicator ${live.wsStatus}`} style={{ marginLeft: 'auto' }}>
                  <span className="ws-dot" />
                  <span className="ws-label">{live.wsStatus === 'open' ? '1s LIVE' : '2s POLL'}</span>
                </div>
              </div>
              <TradesTable positions={positions} />
            </div>
          </div>
        )}

        {/* ----------------------------- Trades ----------------------------- */}
        {page === 'trades' && (
          <div>
            <div className="page-header">
              <h2>Active Trades</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <p>All currently open positions in your MT5 account.</p>
                <div className={`ws-indicator ${live.wsStatus}`}>
                  <span className="ws-dot" />
                  <span className="ws-label">{live.wsStatus === 'open' ? '1s LIVE' : '2s POLL'}</span>
                </div>
              </div>
            </div>
            <div className="card">
              <TradesTable positions={positions} />
            </div>
            {account && (
              <div className="stats-grid" style={{ marginTop: 'var(--space-xl)' }}>
                <StatCard title="Balance" value={`$${account.balance.toLocaleString()}`} type="neutral" />
                <StatCard title="Equity" value={`$${account.equity.toLocaleString()}`} type={account.profit >= 0 ? 'profit' : 'loss'} />
                <StatCard title="Margin" value={`$${account.margin.toLocaleString()}`} type="neutral" />
                <StatCard title="Free Margin" value={`$${account.free_margin.toLocaleString()}`} type="neutral" />
                <StatCard title="Leverage" value={`1:${account.leverage}`} type="neutral" />
                <StatCard title="Floating P&L" value={`${account.profit >= 0 ? '+' : ''}${account.profit?.toFixed(2)}`} type={account.profit >= 0 ? 'profit' : 'loss'} />
              </div>
            )}
          </div>
        )}

        {/* ----------------------------- History ----------------------------- */}
        {page === 'history' && (
          <HistoryPage mt5Connected={mt5Connected} historyUpdatedCounter={live.historyUpdatedCounter} />
        )}

        {/* ----------------------------- Account Analysis ----------------------------- */}
        {page === 'accountAnalysis' && (
          <div>
            <div className="page-header">
              <h2>Account Analysis</h2>
              <p>Comprehensive GFT-style analytics: Performance, Calendar, Distributions, and Advanced Metrics.</p>
            </div>
            <AccountAnalysis analytics={analytics} account={account} />
          </div>
        )}

        {/* ----------------------------- Discipline ----------------------------- */}
        {page === 'discipline' && (
          <div>
            <div className="page-header">
              <h2>Discipline Monitor</h2>
              <p>Track your rule compliance and receive alerts for violations.</p>
            </div>

            <div className="content-grid">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Today's Score</span>
                </div>
                <ScoreGauge score={score} />
                <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                    {live.discipline?.total_violations || 0} violations detected
                  </span>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Session Breakdown</span>
                </div>
                {live.discipline?.session_stats?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {live.discipline.session_stats.map(s => (
                      <div
                        key={s.session_name}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-m)',
                          background: s.within_limit ? 'var(--green-dim)' : 'var(--red-dim)',
                          border: `1px solid ${s.within_limit ? 'var(--green-border)' : 'var(--red-border)'}`,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-0)', textTransform: 'capitalize' }}>{s.session_name}</span>
                        <span style={{
                          fontWeight: 700,
                          fontFamily: 'var(--mono)',
                          color: s.within_limit ? 'var(--green)' : 'var(--red)',
                        }}>
                          {s.trade_count} trades
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>Session data will appear once you connect to MT5.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
              <div className="card-header">
                <span className="card-title">All Alerts</span>
                <button className="btn btn-secondary" onClick={dash.refresh} id="refresh-alerts-btn">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Refresh
                </button>
              </div>
              <AlertFeed alerts={live.discipline?.alerts || []} />
            </div>
          </div>
        )}

        {/* ----------------------------- AI Analysis ----------------------------- */}
        {page === 'analysis' && (
          <div>
            <div className="page-header">
              <h2>AI Trading Coach</h2>
              <p>Professional analysis powered by Kimi 2.5 via NVIDIA NIM — your personal hedge-fund risk manager.</p>
            </div>
            <AIPanel aiAvailable={dash.aiAvailable} />
          </div>
        )}

        {/* ----------------------------- Chart Vision ----------------------------- */}
        {page === 'chartvision' && <ChartVisionPage />}

        {/* ----------------------------- Settings ----------------------------- */}
        {page === 'settings' && <SettingsPage theme={theme} onToggleTheme={toggleTheme} />}

        {/* ----------------------------- MT5 Terminal (New Tab Launcher) ----------------------------- */}
        {page === 'exness' && (
          <div>
            <div className="page-header">
              <h2>MT5 Web Terminal</h2>
              <p>Trade directly from your account using the universal MT5 WebTerminal. Connect any broker.</p>
            </div>

            <div className="terminal-launcher">
              <div className="terminal-launcher-hero">
                <div className="terminal-launcher-icon">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </div>
                <h3>Launch Web Trading Terminal</h3>
                <p>Opens the official MT5 WebTerminal in a new browser tab for the best trading experience.</p>
                
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    window.open('https://trade.mql5.com/trade', '_blank', 'noopener,noreferrer');
                  }}
                  id="launch-terminal-btn"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Open MT5 WebTerminal
                </button>
              </div>

              <div className="terminal-tips">
                <div className="terminal-tip-card">
                  <div className="terminal-tip-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                  </div>
                  <h4>Why a New Tab?</h4>
                  <p>Most brokers block embedded iframes for security. Opening in a new tab gives you the full MT5 native experience with better performance.</p>
                </div>
                <div className="terminal-tip-card">
                  <div className="terminal-tip-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </div>
                  <h4>Slow Internet Tips</h4>
                  <p>Chrome handles the connection natively with caching & service workers. Bookmark the terminal tab for instant access next time.</p>
                </div>
                <div className="terminal-tip-card">
                  <div className="terminal-tip-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <h4>Stay Synced</h4>
                  <p>Trades you make in the MT5 terminal appear here in real-time. Keep both tabs open for the best workflow.</p>
                </div>
              </div>

              {/* Quick Account Info */}
              {account && (
                <div className="terminal-account-summary">
                  <div className="card-header">
                    <span className="card-title">Quick Account Reference</span>
                  </div>
                  <div className="stats-grid" style={{ marginTop: 'var(--space-md)' }}>
                    <StatCard title="Balance" value={`$${account.balance.toLocaleString()}`} type="neutral" />
                    <StatCard title="Equity" value={`$${account.equity.toLocaleString()}`} type={account.profit >= 0 ? 'profit' : 'loss'} />
                    <StatCard title="Free Margin" value={`$${account.free_margin.toLocaleString()}`} type="neutral" />
                    <StatCard title="Open Positions" value={positions.length} type="neutral" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {dash.loading && (
          <div className="loading-overlay">
            <div className="loading-overlay-content">
              <div className="loading-overlay-spinner" />
              <p style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>Connecting to MT5...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
