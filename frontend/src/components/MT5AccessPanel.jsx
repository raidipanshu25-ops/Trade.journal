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
      padding: '10px 12px',
      borderRadius: '6px',
      border: '1px solid var(--border)',
      background: 'var(--bg-3)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-0)' }}>
        {meta.label}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
        {meta.time}
      </div>
      <div style={{ fontSize: '0.7rem', color: statusColor, fontWeight: 600, marginTop: '2px', fontFamily: 'var(--mono)' }}>
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
    if (!confirm('⚠️ EMERGENCY OVERRIDE\n\nThis bypasses ALL safety checks and opens MT5 immediately.\n\nAre you sure?')) return;
    setOverrideLoading('force_open');
    try {
      const data = await api.mt5AccessForceOpen();
      setStatus(data.state);
    } catch (err) {
      console.error('Force open error:', err);
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
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: '1px' }}>
              {status.current_time}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 10px', borderRadius: '4px',
          background: isOpen ? 'var(--green-dim)' : 'var(--red-dim)',
          border: `1px solid ${isOpen ? 'var(--green-border)' : 'var(--red-border)'}`,
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: isOpen ? 'var(--green)' : 'var(--red)',
          }} />
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--mono)',
            color: isOpen ? 'var(--green)' : 'var(--red)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Reason line */}
      <div style={{
        fontSize: '0.78rem', color: 'var(--text-1)', marginBottom: '14px',
        padding: '8px 12px', background: 'var(--bg-3)',
        borderRadius: '5px', border: '1px solid var(--border)',
        lineHeight: 1.5,
      }}>
        {status.reason || '—'}
      </div>

      {/* Session cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <SessionCard name="asia"    data={status.sessions?.asia} />
        <SessionCard name="london"  data={status.sessions?.london} />
        <SessionCard name="newyork" data={status.sessions?.newyork} />
      </div>

      {/* Daily P&L + Next session row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daily P&L</div>
            <div style={{
              fontSize: '0.88rem', fontWeight: 600, fontFamily: 'var(--mono)',
              color: pnlPositive ? 'var(--green)' : 'var(--red)',
              marginTop: '2px',
            }}>
              {pnlPositive ? '+' : ''}{pnl.toFixed(2)}
              {status.daily_loss_pct > 0 && (
                <span style={{ fontSize: '0.62rem', color: 'var(--red)', marginLeft: '5px' }}>
                  ({status.daily_loss_pct.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        </div>
        {!isOpen && status.next_session_open && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
            Next: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{status.next_session_open}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        {isOpen && (
          <button
            className="btn btn-secondary"
            onClick={() => handleOverride('close')}
            disabled={overrideLoading === 'close'}
            style={{
              fontSize: '0.73rem', padding: '5px 12px',
              background: 'var(--red-dim)', color: 'var(--red)',
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
              fontSize: '0.73rem', padding: '5px 12px',
              background: status.force_open_disabled ? 'var(--bg-3)' : 'var(--green-dim)',
              color: status.force_open_disabled ? 'var(--text-3)' : 'var(--green)',
              borderColor: status.force_open_disabled ? 'var(--border)' : 'var(--green-border)',
              cursor: status.force_open_disabled ? 'not-allowed' : 'pointer',
            }}
            title={status.force_open_disabled ? 'Disabled — 2 trades already taken in a session' : 'Override: open MT5 (max 2 extra trades)'}
            id="mt5-force-open"
          >
            {overrideLoading === 'open' ? 'Opening…' : 'Force Open'}
          </button>
        )}
        {!isOpen && status.force_open_disabled && (
          <button
            className="btn btn-secondary"
            onClick={handleForceOpen}
            disabled={overrideLoading === 'force_open'}
            style={{
              fontSize: '0.73rem', padding: '5px 12px',
              background: 'var(--amber-dim)', color: 'var(--amber)',
              borderColor: 'var(--amber-border)',
            }}
            title="Emergency: bypass all safety checks and open MT5"
            id="mt5-emergency-override"
          >
            {overrideLoading === 'force_open' ? 'Opening…' : '⚠ Force Open'}
          </button>
        )}
        {hasOverride && (
          <button
            className="btn btn-secondary"
            onClick={() => handleOverride('clear')}
            style={{ fontSize: '0.73rem', padding: '5px 12px' }}
            id="mt5-clear-override"
          >
            Auto Mode
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={loading}
          style={{ fontSize: '0.68rem', padding: '4px 9px', opacity: 0.5 }}
          title="Reset daily state (testing)"
          id="mt5-reset-day"
        >
          Reset
        </button>
      </div>

      {/* MT5 exe warning */}
      {!status.mt5_exe_found && (
        <div style={{
          marginTop: '10px', padding: '7px 11px', borderRadius: '5px',
          background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
          fontSize: '0.7rem', color: 'var(--amber)', lineHeight: 1.5,
        }}>
          MT5 executable not found. Set <code style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem' }}>MT5_PATH</code> in backend <code style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem' }}>.env</code>.
        </div>
      )}

      {/* Event Log */}
      {status.log && status.log.length > 0 && (
        <details style={{ marginTop: '10px' }}>
          <summary style={{ fontSize: '0.68rem', color: 'var(--text-3)', cursor: 'pointer', userSelect: 'none', fontFamily: 'var(--mono)' }}>
            Event Log ({status.log.length})
          </summary>
          <div style={{
            marginTop: '5px', maxHeight: '100px', overflowY: 'auto',
            background: 'var(--bg-3)', borderRadius: '5px', padding: '6px 8px',
            border: '1px solid var(--border)',
          }}>
            {[...status.log].reverse().map((entry, i) => (
              <div key={i} style={{
                fontSize: '0.65rem', color: 'var(--text-2)', fontFamily: 'var(--mono)',
                padding: '1px 0', lineHeight: 1.4,
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
