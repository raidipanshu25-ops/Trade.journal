import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useDashboard, useLiveData } from './hooks';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { ScoreGauge } from './components/ScoreGauge';
import { AlertFeed } from './components/AlertFeed';
import { TradesTable } from './components/TradesTable';
import { AIPanel } from './components/AIPanel';
import { LoginPage } from './components/LoginPage';
import { MorningRitual } from './components/MorningRitual';
import { PreTradeGate } from './components/PreTradeGate';
import { PostTradeReflection } from './components/PostTradeReflection';
import { ConnectorStatus } from './components/ConnectorStatus';

// applyThemePreset is a pure function (no JSX) — import it directly
// so SettingsPage.jsx can remain fully lazy-loaded.
// We re-export applyThemePreset from a tiny shim to avoid the mixed
// static+dynamic import Vite warning.
import { applyThemePreset, applyBgPreset, applyAccentPreset, applyTextPreset } from './components/SettingsPage';
import { api, authApi } from './api';

// ── Lazy-load heavy page components ──────────────────────────────────
// These are only fetched from the server when the user first navigates
// to that page, keeping the initial JS bundle lean.
const SettingsPage    = lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const HistoryPage     = lazy(() => import('./components/HistoryPage').then(m => ({ default: m.HistoryPage })));
const ChartVisionPage = lazy(() => import('./components/ChartVisionPage').then(m => ({ default: m.ChartVisionPage })));
const AccountAnalysis = lazy(() => import('./components/AccountAnalysis').then(m => ({ default: m.AccountAnalysis })));
const MT5AccountsPage = lazy(() => import('./components/MT5AccountsPage').then(m => ({ default: m.MT5AccountsPage })));
const AdminPage       = lazy(() => import('./components/AdminPage').then(m => ({ default: m.AdminPage })));
const MT5AccessPanel  = lazy(() => import('./components/MT5AccessPanel').then(m => ({ default: m.MT5AccessPanel })));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));

// Fallback shown while a lazy chunk is loading
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--text-2)', fontFamily: 'var(--mono)',
      fontSize: '0.82rem', gap: '10px',
    }}>
      <div className="loading-overlay-spinner" style={{ width: 20, height: 20 }} />
      Loading…
    </div>
  );
}

function App() {
  const [page, setPage] = useState('dashboard');
  const dash = useDashboard();  // lightweight: health + loading status only
  const live = useLiveData();   // WebSocket: positions, account, discipline, stats — everything

  // ── Theme (preset-based) ──────────────────────────────────────────
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('tj-preset') || localStorage.getItem('tj-theme') || 'terminal-teal'
  );

  // Apply theme once on mount and whenever it changes (single effect, no duplicate)
  useEffect(() => {
    applyThemePreset(theme);
    localStorage.setItem('tj-preset', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(prev => {
    if (prev === 'light') return 'dark';
    if (prev === 'dark') return 'light';
    return 'light';
  }), []);

  // ── Authentication ────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('tj-auth-token')
  );

  useEffect(() => {
    const handleAuthExpired = () => setIsAuthenticated(false);
    window.addEventListener('auth-expired', handleAuthExpired);

    api.health().then(health => {
      if (!health.auth_required) {
        setIsAuthenticated(true);
      } else if (localStorage.getItem('tj-auth-token')) {
        api.getSettings()
          .then(() => setIsAuthenticated(true))
          .catch(() => {
            localStorage.removeItem('tj-auth-token');
            setIsAuthenticated(false);
          });
      } else {
        setIsAuthenticated(false);
      }
    }).catch(() => { /* Backend unreachable — keep current auth state */ });

    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  // ── Current user ──────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);

  const fetchCurrentUser = useCallback(() => {
    if (localStorage.getItem('tj-auth-token')) {
      authApi.getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchCurrentUser();
  }, [isAuthenticated, fetchCurrentUser]);

  const handleLogout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('tj-auth-token');
    setIsAuthenticated(false);
    setCurrentUser(null);
  }, []);

  // ── Morning Ritual gate ──────────────────────────────────────────
  const [ritualRequired, setRitualRequired] = useState(false);
  const [ritualSettings, setRitualSettings] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getRitual().then(r => {
      if (!r.completed) setRitualRequired(true);
    }).catch(() => {});
    api.getSettings().then(s => setRitualSettings(s)).catch(() => {});
  }, [isAuthenticated]);

  // ── Onboarding / MT5 Connector state ──────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('tj-onboarding-dismissed') === 'true'
  );
  const [syncToken, setSyncToken] = useState('');
  const [syncStatus, setSyncStatus] = useState({ connected: false, last_sync: null });
  const [appConfig, setAppConfig] = useState({});

  useEffect(() => {
    if (!isAuthenticated) return;
    // Fetch config, sync token, and sync status
    api.getConfig().then(setAppConfig).catch(() => {});
    api.getSyncToken().then(data => {
      setSyncToken(data.sync_token || '');
      // If no sync token and no trades, show onboarding
      if (!data.has_token && !onboardingDismissed) {
        setShowOnboarding(true);
      }
    }).catch(() => {});
    api.getSyncStatus().then(data => {
      setSyncStatus(data);
    }).catch(() => {});
  }, [isAuthenticated, onboardingDismissed]);

  // ── Pre-Trade Gate ────────────────────────────────────────────────
  const [preTradeGateOpen, setPreTradeGateOpen] = useState(false);
  const preTradeCallbackRef = useRef(null);

  // Expose a global hook for the MT5 access panel to trigger the gate
  useEffect(() => {
    window.__openPreTradeGate = (callback) => {
      preTradeCallbackRef.current = callback;
      setPreTradeGateOpen(true);
    };
    return () => { window.__openPreTradeGate = null; };
  }, []);

  // ── Post-Trade Reflection ────────────────────────────────────────
  const [reflectionTrade, setReflectionTrade] = useState(null);
  const prevClosedTicketsRef = useRef(new Set());

  // Detect newly closed trades via position count drop + historyUpdatedCounter
  useEffect(() => {
    if (!isAuthenticated) return;
    // Check recent closed positions from history
    api.todayDeals().then(deals => {
      if (!Array.isArray(deals)) return;
      // Find the most recent closed deal that hasn't been reflected on
      const reflected = JSON.parse(localStorage.getItem('tj-reflected-tickets') || '[]');
      const pending = deals.find(d => d.entry === 1 && !reflected.includes(String(d.ticket)));
      if (pending) {
        setReflectionTrade(pending);
      }
    }).catch(() => {});
  }, [live.historyUpdatedCounter, isAuthenticated]);

  const handleReflectionDone = useCallback((ticket) => {
    const reflected = JSON.parse(localStorage.getItem('tj-reflected-tickets') || '[]');
    reflected.push(String(ticket));
    localStorage.setItem('tj-reflected-tickets', JSON.stringify(reflected.slice(-100)));
    setReflectionTrade(null);
  }, []);

  // ── Derived data (memoised — recalculates only when source changes) ─
  const positions     = live.positions;
  const account       = live.account;
  const mt5Connected  = live.connected || dash.mt5Connected;
  const stats         = live.dailyStats  || {};
  const journalStats  = live.journalStats || null;

  const alertCount = useMemo(
    () => live.discipline?.alerts?.length || 0,
    [live.discipline?.alerts]
  );

  const score = useMemo(
    () => live.discipline?.score ?? 100,
    [live.discipline?.score]
  );

  const violationsPopup = useMemo(
    () => live.discipline?.violations_popup || [],
    [live.discipline?.violations_popup]
  );

  // ── Violation popup dismissal ────────────────────────────────────
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [lastViolationKey, setLastViolationKey] = useState('');

  const violationKey = useMemo(
    () => violationsPopup.map(v => v.rule).sort().join(','),
    [violationsPopup]
  );

  useEffect(() => {
    if (violationKey !== lastViolationKey) {
      setPopupDismissed(false);
      setLastViolationKey(violationKey);
    }
  }, [violationKey, lastViolationKey]);

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  if (ritualRequired) {
    return <MorningRitual settings={ritualSettings} onComplete={() => setRitualRequired(false)} />;
  }

  if (showOnboarding && !onboardingDismissed && appConfig.mt5_mode === 'sync') {
    return (
      <Suspense fallback={<PageLoader />}>
        <OnboardingWizard
          syncToken={syncToken}
          isConnected={syncStatus.connected}
          onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem('tj-onboarding-dismissed', 'true');
            setOnboardingDismissed(true);
          }}
          onSkip={() => {
            setShowOnboarding(false);
            localStorage.setItem('tj-onboarding-dismissed', 'true');
            setOnboardingDismissed(true);
          }}
        />
      </Suspense>
    );
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
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {/* ===== Pre-Trade Gate Modal ===== */}
        {preTradeGateOpen && (
          <PreTradeGate
            onSubmit={(entry, moodFlagged) => {
              setPreTradeGateOpen(false);
              if (preTradeCallbackRef.current) {
                preTradeCallbackRef.current(true, moodFlagged);
                preTradeCallbackRef.current = null;
              }
            }}
            onCancel={() => {
              setPreTradeGateOpen(false);
              if (preTradeCallbackRef.current) {
                preTradeCallbackRef.current(false, false);
                preTradeCallbackRef.current = null;
              }
            }}
          />
        )}

        {/* ===== Post-Trade Reflection Modal ===== */}
        {reflectionTrade && (
          <PostTradeReflection
            trade={reflectionTrade}
            onSubmit={() => handleReflectionDone(reflectionTrade?.ticket)}
            onSkip={() => handleReflectionDone(reflectionTrade?.ticket)}
          />
        )}

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
                {appConfig.mt5_mode === 'sync' && (
                  <ConnectorStatus
                    connected={syncStatus.connected}
                    lastSync={syncStatus.last_sync}
                    onSetupClick={() => {
                      setOnboardingDismissed(false);
                      localStorage.removeItem('tj-onboarding-dismissed');
                      setShowOnboarding(true);
                    }}
                  />
                )}
                <p>Live MT5 positions and trading performance.</p>
                <div className={`ws-indicator ${live.wsStatus}`} title={`WebSocket: ${live.wsStatus}`}>
                  <span className="ws-dot" />
                  <span className="ws-label">{live.wsStatus === 'open' ? 'LIVE' : live.wsStatus === 'fallback' ? 'POLL' : 'SYNC'}</span>
                </div>
              </div>
            </div>

            {!mt5Connected && !dash.loading && appConfig.mt5_mode !== 'sync' && (
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
                  onClick={async () => { await api.reconnect(); dash.refresh(); }}
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
            {!syncStatus.connected && !dash.loading && appConfig.mt5_mode === 'sync' && (
              <div className="connection-banner">
                <div className="connection-banner-icon">
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.36 5.64a9 9 0 0 1 0 12.73"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                </div>
                <div className="connection-banner-text">
                  <h3>MT5 Connector Not Running</h3>
                  <p>Start the local MT5 connector script on your PC to sync trades.</p>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    setOnboardingDismissed(false);
                    localStorage.removeItem('tj-onboarding-dismissed');
                    setShowOnboarding(true);
                  }}
                  id="setup-connector-btn"
                >
                  Setup Guide
                </button>
              </div>
            )}

            {/* MT5 Access Controller — Prop Firm Safe Gatekeeper */}
            <Suspense fallback={null}>
              <MT5AccessPanel wsStatus={live.mt5Access} />
            </Suspense>

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
          <Suspense fallback={<PageLoader />}>
            <HistoryPage mt5Connected={mt5Connected} historyUpdatedCounter={live.historyUpdatedCounter} />
          </Suspense>
        )}

        {/* ----------------------------- Account Analysis ----------------------------- */}
        {page === 'accountAnalysis' && (
          <div>
            <div className="page-header">
              <h2>Account Analysis</h2>
              <p>Comprehensive GFT-style analytics: Performance, Calendar, Distributions, and Advanced Metrics.</p>
            </div>
            <Suspense fallback={<PageLoader />}>
              <AccountAnalysis analytics={live.analytics} account={account} />
            </Suspense>
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
              <p>Professional analysis powered by Z.ai (GLM 5.2) — your personal hedge-fund risk manager.</p>
            </div>
            <AIPanel aiAvailable={dash.aiAvailable} />
          </div>
        )}

        {/* ----------------------------- Chart Vision ----------------------------- */}
        {page === 'chartvision' && (
          <Suspense fallback={<PageLoader />}>
            <ChartVisionPage />
          </Suspense>
        )}

        {/* ----------------------------- Settings ----------------------------- */}
        {page === 'settings' && (
          <Suspense fallback={<PageLoader />}>
            <SettingsPage theme={theme} onToggleTheme={toggleTheme} currentUser={currentUser} onLogout={handleLogout} onUserUpdate={fetchCurrentUser} />
          </Suspense>
        )}

        {/* ----------------------------- MT5 Accounts ----------------------------- */}
        {page === 'mt5accounts' && (
          <Suspense fallback={<PageLoader />}>
            <MT5AccountsPage />
          </Suspense>
        )}

        {/* ----------------------------- Admin Panel ----------------------------- */}
        {page === 'admin' && currentUser?.role === 'admin' && (
          <Suspense fallback={<PageLoader />}>
            <AdminPage />
          </Suspense>
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
