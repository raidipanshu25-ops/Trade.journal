/**
 * MT5 Access Controller Panel — Prop Firm Safe Gatekeeper
 * Clean professional design — no emojis, no glow, no animations.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const SESSION_META = {
  asia:    { label: 'Asia',     time: '05:30 – 12:00' },
  london:  { label: 'London',   time: '13:00 – 16:30' },
  newyork: { label: 'New York', time: '19:00 – 22:00' },
};

function SessionCard({ name, data }) {
  const meta = SESSION_META[name] || {};
  const trades   = data?.trades_taken ?? 0;
  const baseMax  = 1; // Always show base max as 1
  const blocked  = data?.blocked_by_loss;
  const profit   = data?.profitable ?? data?.trade1_profitable;

  let floatingText = '';
  if (trades > 1) {
    floatingText = ` + ${trades - 1} (floating trade utilized)`;
  }

  let statusLabel = `${Math.min(trades, baseMax)}/${baseMax}${floatingText}`;
  let statusColor = 'var(--text-2)';
  if (blocked)              { statusLabel = 'Blocked';   statusColor = 'var(--red)'; }
  else if (profit === true) { statusColor = 'var(--green)'; }
  else if (profit === false){ statusColor = 'var(--red)'; }

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'rgba(255, 255, 255, 0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    }}>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-0)', letterSpacing: '0.3px' }}>
        {meta.label}
      </div>
      <div style={{ fontSize: '0.80rem', color: 'var(--text-1)', fontFamily: 'var(--mono)', fontWeight: 500 }}>
        {meta.time}
      </div>
      <div style={{ fontSize: '0.86rem', color: statusColor, fontWeight: 700, marginTop: '2px', fontFamily: 'var(--mono)' }}>
        {statusLabel}
      </div>
    </div>
  );
}

export function MT5AccessPanel({ wsStatus: wsMt5Access }) {
  const [status, setStatus]               = useState(null);
  const [loading, setLoading]             = useState(false);
  const [overrideLoading, setOverrideLoading] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.mt5AccessStatus();
      setStatus(data);
    } catch (err) {
      console.error('MT5 Access status error:', err);
    }
  }, []);

  useEffect(() => {
    if (wsMt5Access) {
      setStatus(wsMt5Access);
      return;
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus, wsMt5Access]);

  const handleOverride = async (action) => {
    setOverrideLoading(action);
    try {
      const data = await api.mt5AccessOverride(action);
      setStatus(data.state);
    } catch (err) {
      console.error('Override error:', err);
    } finally {
      setOverrideLoading('');
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all daily trade counts and state? This is for testing only.')) return;
    setLoading(true);
    try {
      const data = await api.mt5AccessReset();
      setStatus(data.state);
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceOpen = async () => {
    if (!confirm('⚠️ EMERGENCY OVERRIDE\n\nThis will open MT5 for a maximum of 2 extra trades in the current session.\nYou can only use this ONCE per session.\n\nAre you sure?')) return;
    setOverrideLoading('force_open');
    try {
      const data = await api.mt5AccessForceOpen();
      setStatus(data.state);
    } catch (err) {
      console.error('Force open error:', err);
      // Try to extract updated state from the error response
      try {
        const errData = err?.response?.data?.detail;
        if (errData?.state) setStatus(errData.state);
      } catch (_) {}
    } finally {
      setOverrideLoading('');
    }
  };

  if (!status) {
    return (
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="skeleton skeleton-card" />
      </div>
    );
  }

  const isOpen     = status.mt5_process_running;
  const hasOverride = status.manual_override;
  const pnl        = status.daily_pnl ?? 0;
  const pnlPositive = pnl >= 0;

  return (
    <div className="card" id="mt5-access-panel" style={{ marginBottom: '16px' }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Status icon */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '6px',
            background: isOpen ? 'var(--green-dim)' : 'var(--red-dim)',
            border: `1px solid ${isOpen ? 'var(--green-border)' : 'var(--red-border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
              stroke={isOpen ? 'var(--green)' : 'var(--red)'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isOpen
                ? <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
                : <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>
              }
            </svg>
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              MT5 Access
              {hasOverride && (
                <span style={{
                  fontSize: '0.55rem', padding: '1px 5px', borderRadius: '3px',
                  background: 'var(--amber-dim)', color: 'var(--amber)',
                  border: '1px solid var(--amber-border)', fontWeight: 700,
                  letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: 'var(--mono)',
                }}>Override</span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontFamily: 'var(--mono)', marginTop: '2px', fontWeight: 500 }}>
              {status.current_time}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', borderRadius: '6px',
          background: isOpen ? 'var(--green-dim)' : 'var(--amber-dim)',
          border: `1px solid ${isOpen ? 'var(--green-border)' : 'var(--amber-border)'}`,
        }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: isOpen ? 'var(--green-bright)' : 'var(--amber)',
          }} />
          <span style={{
            fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--mono)',
            color: isOpen ? 'var(--green-bright)' : 'var(--amber)',
            textTransform: 'uppercase', letterSpacing: '0.8px',
          }}>
            {isOpen ? 'MT5 Open' : 'MT5 Closed'}
          </span>
        </div>
      </div>

      {/* Reason line */}
      <div style={{
        fontSize: '0.84rem', color: 'var(--text-0)', marginBottom: '14px',
        padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
        borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
        lineHeight: 1.5, fontWeight: 500,
      }}>
        <div>{status.reason || '—'}</div>
        {!isOpen && (
          <div style={{ fontSize: '0.74rem', color: 'var(--cyan)', marginTop: '4px', fontFamily: 'var(--mono)' }}>
            🟢 Dashboard connection remains established. MT5 closed to enforce rules.
          </div>
        )}
      </div>

      {/* Session cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
        <SessionCard name="asia"    data={status.sessions?.asia} />
        <SessionCard name="london"  data={status.sessions?.london} />
        <SessionCard name="newyork" data={status.sessions?.newyork} />
      </div>

      {/* Daily P&L + Next session row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-2)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Daily P&L</div>
            <div style={{
              fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--mono)',
              color: pnlPositive ? 'var(--green-bright)' : 'var(--red-bright)',
              marginTop: '2px',
            }}>
              {pnlPositive ? '+' : ''}{pnl.toFixed(2)}
              {status.daily_loss_pct > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--red-bright)', marginLeft: '6px', fontWeight: 600 }}>
                  ({status.daily_loss_pct.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        </div>
        {!isOpen && status.next_session_open && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-1)', fontFamily: 'var(--mono)', fontWeight: 500 }}>
            Next: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{status.next_session_open}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {isOpen && (
          <button
            className="btn btn-secondary"
            onClick={() => handleOverride('close')}
            disabled={overrideLoading === 'close'}
            style={{
              fontSize: '0.78rem', padding: '6px 14px', fontWeight: 600,
              background: 'var(--red-dim)', color: 'var(--red-bright)',
              borderColor: 'var(--red-border)',
            }}
            id="mt5-force-close"
          >
            {overrideLoading === 'close' ? 'Closing…' : 'Force Close'}
          </button>
        )}
        {!isOpen && (
          <button
            className="btn btn-secondary"
            onClick={() => handleOverride('open')}
            disabled={overrideLoading === 'open' || status.force_open_disabled}
            style={{
              fontSize: '0.78rem', padding: '6px 14px', fontWeight: 600,
              background: status.force_open_disabled ? 'var(--bg-3)' : 'var(--green-dim)',
              color: status.force_open_disabled ? 'var(--text-3)' : 'var(--green-bright)',
              borderColor: status.force_open_disabled ? 'var(--border)' : 'var(--green-border)',
              cursor: status.force_open_disabled ? 'not-allowed' : 'pointer',
            }}
            title={status.force_open_disabled ? 'Disabled — already used in this session or outside trading hours' : 'Override: open MT5 (max 2 extra trades, once per session)'}
            id="mt5-force-open"
          >
            {overrideLoading === 'open' ? 'Opening…' : 'Force Open'}
          </button>
        )}
        {!isOpen && status.force_open_disabled && (
          <button
            className="btn btn-secondary"
            onClick={handleForceOpen}
            disabled={true}
            style={{
              fontSize: '0.78rem', padding: '6px 14px', fontWeight: 600,
              background: 'var(--bg-3)', color: 'var(--text-3)',
              borderColor: 'var(--border)', cursor: 'not-allowed',
              opacity: 0.6,
            }}
            title="Force Open already used in this session"
            id="mt5-emergency-override"
          >
            ⚠ Force Open Used
          </button>
        )}
        {/* Show remaining extra trades when force-open is active */}
        {isOpen && status.force_open_active_session && status.force_open_extra_remaining > 0 && (
          <div style={{
            fontSize: '0.74rem', padding: '5px 12px', borderRadius: '5px',
            background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
            color: 'var(--amber)', fontFamily: 'var(--mono)', fontWeight: 700,
          }}>
            🚨 {status.force_open_extra_remaining} extra trade(s) remaining
          </div>
        )}
        {hasOverride && (
          <button
            className="btn btn-secondary"
            onClick={() => handleOverride('clear')}
            style={{ fontSize: '0.78rem', padding: '6px 14px', fontWeight: 600 }}
            id="mt5-clear-override"
          >
            Auto Mode
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={loading}
          style={{ fontSize: '0.74rem', padding: '5px 12px', opacity: 0.85, fontWeight: 500 }}
          title="Reset daily state (testing)"
          id="mt5-reset-day"
        >
          Reset
        </button>
      </div>

      {/* MT5 exe warning */}
      {!status.mt5_exe_found && (
        <div style={{
          marginTop: '12px', padding: '8px 12px', borderRadius: '6px',
          background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
          fontSize: '0.76rem', color: 'var(--amber)', lineHeight: 1.5,
        }}>
          MT5 executable not found. Set <code style={{ fontFamily: 'var(--mono)', fontSize: '0.74rem' }}>MT5_PATH</code> in backend <code style={{ fontFamily: 'var(--mono)', fontSize: '0.74rem' }}>.env</code>.
        </div>
      )}

      {/* Event Log */}
      {status.log && status.log.length > 0 && (
        <details style={{ marginTop: '12px' }}>
          <summary style={{ fontSize: '0.78rem', color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none', fontFamily: 'var(--mono)', fontWeight: 600 }}>
            Event Log ({status.log.length})
          </summary>
          <div style={{
            marginTop: '6px', maxHeight: '120px', overflowY: 'auto',
            background: 'var(--bg-3)', borderRadius: '6px', padding: '8px 10px',
            border: '1px solid var(--border)',
          }}>
            {[...status.log].reverse().map((entry, i) => (
              <div key={i} style={{
                fontSize: '0.74rem', color: 'var(--text-1)', fontFamily: 'var(--mono)',
                padding: '2px 0', lineHeight: 1.5,
              }}>
                {entry}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
