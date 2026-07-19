import { useState, useEffect } from 'react';
import { api } from '../api';

/**
 * WebTerminalPage — Quick-launch page for trading platforms.
 * MetaAPI's WebTerminal has SSL certificate issues (ERR_CERT_AUTHORITY_INVALID),
 * so we provide direct links to the MetaTrader Web platform and account details
 * for easy login.
 */
export function WebTerminalPage({ accounts }) {
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Load accounts on mount
  useEffect(() => {
    api.mt5Accounts().then(accs => {
      setConnectedAccounts(accs);
      if (accs.length > 0) setSelectedId(accs[0].id);
    }).catch(() => {});
  }, []);

  if (connectedAccounts.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h2>Web Terminal</h2>
          <p>Access your trading accounts from the browser.</p>
        </div>
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-l)', padding: '48px 32px', textAlign: 'center',
        }}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2"
               strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 16 }}>
            <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>No MT5 accounts connected yet.</p>
          <p style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>
            Go to <strong style={{ color: 'var(--cyan)' }}>MT5 Accounts</strong> in the sidebar to add your first account.
          </p>
        </div>
      </div>
    );
  }

  const selectedAccount = connectedAccounts.find(a => a.id === selectedId) || connectedAccounts[0];

  return (
    <div>
      <div className="page-header">
        <h2>Web Terminal</h2>
        <p>Access your MT5 trading account directly from the browser.</p>
      </div>

      {/* Account selector */}
      {connectedAccounts.length > 1 && (
        <div style={{ marginBottom: '20px' }}>
          <select
            value={selectedId || ''}
            onChange={e => setSelectedId(Number(e.target.value))}
            className="form-input"
            style={{ padding: '10px 14px', fontSize: '0.9rem', width: 'auto', minWidth: 260 }}
            id="terminal-account-select"
          >
            {connectedAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>#{acc.login} — {acc.server}</option>
            ))}
          </select>
        </div>
      )}

      {/* Account details card */}
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-m)',
            background: 'var(--cyan-dim)', border: '1px solid var(--cyan-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--cyan)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
              <circle cx="7" cy="15" r="1" fill="var(--cyan)" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-0)', fontFamily: 'var(--mono)' }}>
              Account #{selectedAccount.login}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{selectedAccount.server}</div>
          </div>
          <div style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: selectedAccount.state === 'DEPLOYED' ? 'var(--green-dim)' : 'var(--red-dim)',
            border: `1px solid ${selectedAccount.state === 'DEPLOYED' ? 'var(--green-border)' : 'var(--red-border)'}`,
            borderRadius: '999px', padding: '4px 14px', fontSize: '0.73rem', fontWeight: 600,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
              background: selectedAccount.state === 'DEPLOYED' ? 'var(--green)' : 'var(--red)',
            }} />
            <span style={{ color: selectedAccount.state === 'DEPLOYED' ? 'var(--green)' : 'var(--red)' }}>
              {selectedAccount.state === 'DEPLOYED' ? 'Connected' : selectedAccount.state || 'Deploying'}
            </span>
          </div>
        </div>

        {/* Quick copy info */}
        <div style={{
          background: 'var(--bg-3)', borderRadius: 'var(--radius-m)', padding: '16px 20px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px',
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Login ID</div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text-0)', fontSize: '0.95rem' }}>{selectedAccount.login}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Server</div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text-0)', fontSize: '0.95rem' }}>{selectedAccount.server}</div>
          </div>
        </div>

        {/* Launch buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{
              padding: '14px 28px', fontSize: '0.95rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              borderRadius: 'var(--radius-l)',
            }}
            onClick={() => window.open('https://metatrader.exness.com/', '_blank', 'noopener,noreferrer')}
            id="open-mt5-web-btn"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            Open MT5 Web
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>

          <button
            className="btn btn-secondary"
            style={{
              padding: '14px 28px', fontSize: '0.95rem', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: '10px',
            }}
            onClick={() => window.open('https://www.mql5.com/en/trading/mt5', '_blank', 'noopener,noreferrer')}
            id="open-mql5-web-btn"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            MQL5 WebTerminal
          </button>

          <button
            className="btn btn-secondary"
            style={{
              padding: '14px 28px', fontSize: '0.95rem', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: '10px',
            }}
            onClick={() => window.open('https://www.metatrader5.com/en/download', '_blank', 'noopener,noreferrer')}
            id="download-mt5-btn"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download MT5
          </button>
        </div>
      </div>

      {/* How to login */}
      <div className="card" style={{ marginTop: '20px', padding: '24px' }}>
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <span className="card-title">How to Login</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { step: '1', title: 'Open any MT5 web terminal above', desc: 'Click one of the buttons to open a web-based MT5 platform.' },
            { step: '2', title: 'Enter your server name', desc: `Search for "${selectedAccount.server}" in the broker/server field.` },
            { step: '3', title: 'Login with your credentials', desc: `Use login ID ${selectedAccount.login} and the password from your broker email.` },
            { step: '4', title: 'Start trading', desc: 'Your account is synced — all trades will appear automatically in Trade.journal.' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--cyan-dim)', border: '1px solid var(--cyan-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.78rem', fontWeight: 700, color: 'var(--cyan)',
              }}>
                {s.step}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-0)', marginBottom: '2px' }}>{s.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px', marginTop: '20px',
      }}>
        {[
          { icon: '📊', title: 'Live Charts', desc: 'Real-time price charts with indicators' },
          { icon: '⚡', title: 'Place Orders', desc: 'Market, limit, and stop orders' },
          { icon: '🛡️', title: 'Manage Positions', desc: 'Modify SL/TP, close positions' },
          { icon: '🔄', title: 'Auto-Synced', desc: 'All trades sync to your journal automatically' },
        ].map(f => (
          <div key={f.title} style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-l)', padding: '18px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-0)', marginBottom: '4px' }}>{f.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
