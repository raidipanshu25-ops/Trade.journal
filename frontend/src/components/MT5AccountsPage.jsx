import { useState, useEffect } from 'react';
import { api } from '../api';

/* ────────────────────────────────────────────────────────────
   STATUS helpers
   ──────────────────────────────────────────────────────────── */
function statusColor(state, conn) {
  if (state === 'DEPLOYED' && conn === 'CONNECTED') return 'var(--green)';
  if (state === 'DEPLOYING' || state === 'CONNECT_FAILED' || conn === 'CONNECTING') return '#f59e0b';
  return 'var(--red)';
}

function statusLabel(state, conn) {
  if (state === 'DEPLOYED' && conn === 'CONNECTED') return 'Connected';
  if (state === 'DEPLOYING') return 'Deploying…';
  if (conn === 'CONNECTING') return 'Connecting…';
  if (conn === 'DISCONNECTED') return 'Disconnected';
  return state || 'Unknown';
}

/* ────────────────────────────────────────────────────────────
   Local MT5 Connection Panel
   ──────────────────────────────────────────────────────────── */
function LocalMT5Panel({ health, onReconnect }) {
  const [reconnecting, setReconnecting] = useState(false);
  const connected = health?.mt5_connected;

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await onReconnect();
    } finally {
      setReconnecting(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-2)', border: `1px solid ${connected ? 'var(--green-border)' : 'var(--red-border)'}`,
      borderRadius: 'var(--radius-l)', padding: '22px 24px', marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={connected ? 'var(--green)' : 'var(--red)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-0)' }}>Local Desktop MT5</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'var(--bg-3)', borderRadius: '999px',
          padding: '5px 14px', fontSize: '0.75rem', fontWeight: 600,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)', display: 'inline-block' }} />
          <span style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.7, marginBottom: '16px' }}>
        {connected ? (
          <>✅ Your MetaTrader 5 desktop terminal is connected. Live data is streaming in real-time — positions, account info, and discipline checks are all active.</>
        ) : (
          <>⚠️ MetaTrader 5 desktop terminal is not detected. Please <strong>start MetaTrader 5</strong> on this computer, then click Reconnect.</>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.78rem', padding: '7px 16px' }}
          onClick={handleReconnect}
          disabled={reconnecting}
          id="mt5-reconnect-btn"
        >
          {reconnecting ? (
            <><span className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Reconnecting…</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Reconnect
            </>
          )}
        </button>
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.78rem', padding: '7px 16px' }}
          onClick={() => api.syncJournal()}
          disabled={!connected}
          id="mt5-sync-history-btn"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Sync Trade History
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Account Card (Cloud mode)
   ──────────────────────────────────────────────────────────── */
function AccountCard({ account, onDelete, onSync, onDeploy, syncing, deploying }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const color = statusColor(account.state, account.connection_status);
  const label = statusLabel(account.state, account.connection_status);

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-l)', padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: '14px',
      position: 'relative', transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-0)', fontFamily: 'var(--mono)' }}>#{account.login}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: '3px' }}>{account.server}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-3)', borderRadius: '999px', padding: '4px 12px', fontSize: '0.73rem', fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
          <span style={{ color }}>{label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '20px', fontSize: '0.75rem', color: 'var(--text-2)' }}>
        <span>MetaAPI ID: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{account.metaapi_account_id ? account.metaapi_account_id.slice(0, 12) + '…' : '—'}</span></span>
        <span>Added: {account.created_at?.slice(0, 10) || '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {account.state !== 'DEPLOYED' && (
          <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '5px 12px' }} onClick={() => onDeploy(account.id)} disabled={deploying === account.id} id={`deploy-account-${account.id}`}>
            {deploying === account.id ? (<><span className="loading-spinner" style={{ width: 11, height: 11, borderWidth: 2 }} /> Deploying…</>) : 'Deploy Now'}
          </button>
        )}
        <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 12px' }} onClick={() => onSync(account.id)} disabled={syncing === account.id || account.state !== 'DEPLOYED'} id={`sync-account-${account.id}`}>
          {syncing === account.id ? (<><span className="loading-spinner" style={{ width: 11, height: 11, borderWidth: 2 }} /> Syncing…</>) : 'Sync History'}
        </button>
        {!confirmDelete ? (
          <button className="btn" style={{ fontSize: '0.75rem', padding: '5px 12px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red-border)' }} onClick={() => setConfirmDelete(true)} id={`delete-account-${account.id}`}>Remove</button>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--red)' }}>Sure?</span>
            <button className="btn" style={{ fontSize: '0.73rem', padding: '4px 10px', background: 'var(--red)', color: '#fff', border: 'none' }} onClick={() => { onDelete(account.id); setConfirmDelete(false); }}>Yes, Remove</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.73rem', padding: '4px 10px' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Add Account Form (Cloud mode)
   ──────────────────────────────────────────────────────────── */
function AddAccountForm({ onAdded }) {
  const [form, setForm] = useState({ login: '', password: '', server: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.login || !form.password || !form.server) { setError('All fields are required.'); return; }
    setLoading(true); setError('');
    try {
      await api.addMt5Account({ login: parseInt(form.login), password: form.password, server: form.server });
      setForm({ login: '', password: '', server: '' });
      onAdded();
    } catch (err) { setError(err.message || 'Failed to add account.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px dashed var(--cyan-border)', borderRadius: 'var(--radius-l)', padding: '22px 24px' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cyan)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
        Add New MT5 Account (Cloud)
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Account Number (Login)</label>
            <input type="number" className="form-input" placeholder="e.g. 1234567" value={form.login} onChange={e => setForm(p => ({ ...p, login: e.target.value }))} id="mt5-account-login" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Investor Password&nbsp;<span style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 500 }}>read-only</span></label>
            <input type="password" className="form-input" placeholder="Investor (read-only) password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} id="mt5-account-password" autoComplete="new-password" />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Broker Server Name</label>
          <input type="text" className="form-input" placeholder="e.g. Exness-MT5Trial3 or ICMarkets-Live01" value={form.server} onChange={e => setForm(p => ({ ...p, server: e.target.value }))} id="mt5-account-server" />
        </div>
        {error && <p style={{ color: 'var(--red)', fontSize: '0.78rem', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button className="btn btn-primary" type="submit" disabled={loading} id="add-mt5-account-btn">
            {loading ? (<><span className="loading-spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Provisioning…</>) : 'Connect Account'}
          </button>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-2)', margin: 0 }}>Powered by MetaAPI cloud — no local MT5 install needed.</p>
        </div>
      </form>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Main Page
   ──────────────────────────────────────────────────────────── */
export function MT5AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [globalMsg, setGlobalMsg] = useState('');
  const [health, setHealth] = useState(null);

  const mt5Mode = health?.mt5_mode || 'cloud';

  const loadAccounts = async () => {
    setLoading(true);
    try { setAccounts(await api.mt5Accounts()); } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadHealth = async () => {
    try { setHealth(await api.health()); } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadHealth();
    loadAccounts();
    const interval = setInterval(() => { loadHealth(); loadAccounts(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id) => {
    try { await api.deleteMt5Account(id); setGlobalMsg('Account removed.'); loadAccounts(); }
    catch (err) { setGlobalMsg('Failed to remove account: ' + err.message); }
    setTimeout(() => setGlobalMsg(''), 3000);
  };

  const handleSync = async (id) => {
    setSyncing(id);
    try { await api.syncMt5Account(id); setGlobalMsg('Sync started.'); loadAccounts(); }
    catch (err) { setGlobalMsg('Sync failed: ' + err.message); }
    finally { setSyncing(null); setTimeout(() => setGlobalMsg(''), 4000); }
  };

  const [deploying, setDeploying] = useState(null);
  const handleDeploy = async (id) => {
    setDeploying(id);
    try { await api.deployMt5Account(id); setGlobalMsg('Deploy started.'); setTimeout(loadAccounts, 3000); setTimeout(loadAccounts, 8000); }
    catch (err) { setGlobalMsg('Deploy failed: ' + err.message); }
    finally { setDeploying(null); setTimeout(() => setGlobalMsg(''), 5000); }
  };

  const handleReconnect = async () => {
    try { const res = await api.reconnect(); setGlobalMsg(res.mt5_connected ? '✅ MT5 reconnected!' : '⚠️ MT5 reconnect failed.'); loadHealth(); }
    catch (err) { setGlobalMsg('Reconnect failed: ' + err.message); }
    setTimeout(() => setGlobalMsg(''), 4000);
  };

  return (
    <div>
      <div className="page-header">
        <h2>MT5 Connection</h2>
        <p>
          {mt5Mode === 'local'
            ? 'Connected to your local MetaTrader 5 desktop terminal for real-time data.'
            : 'Connect MT5 accounts via MetaAPI cloud — no local terminal required.'}
        </p>
      </div>

      {/* Mode indicator */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '20px',
      }}>
        <div style={{
          background: mt5Mode === 'local' ? 'var(--green-dim)' : 'var(--bg-3)',
          border: `1px solid ${mt5Mode === 'local' ? 'var(--green-border)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-m)', padding: '8px 16px',
          fontSize: '0.78rem', fontWeight: 600,
          color: mt5Mode === 'local' ? 'var(--green)' : 'var(--text-2)',
        }}>
          🖥️ Local Mode {mt5Mode === 'local' ? '(Active)' : ''}
        </div>
        <div style={{
          background: mt5Mode === 'cloud' ? 'var(--cyan-dim)' : 'var(--bg-3)',
          border: `1px solid ${mt5Mode === 'cloud' ? 'var(--cyan-border)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-m)', padding: '8px 16px',
          fontSize: '0.78rem', fontWeight: 600,
          color: mt5Mode === 'cloud' ? 'var(--cyan)' : 'var(--text-2)',
        }}>
          ☁️ Cloud Mode {mt5Mode === 'cloud' ? '(Active)' : ''}
        </div>
      </div>

      {/* Global message */}
      {globalMsg && (
        <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: 'var(--radius-m)', padding: '10px 16px', marginBottom: '16px', fontSize: '0.82rem', color: 'var(--green)' }}>
          {globalMsg}
        </div>
      )}

      {/* Local mode: connection panel */}
      {mt5Mode === 'local' && (
        <LocalMT5Panel health={health} onReconnect={handleReconnect} />
      )}

      {/* Cloud mode: add form + info banner */}
      {mt5Mode === 'cloud' && (
        <>
          <div style={{
            background: 'var(--cyan-dim)', border: '1px solid var(--cyan-border)',
            borderRadius: 'var(--radius-l)', padding: '14px 18px',
            marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px',
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-1)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--cyan)' }}>How it works:</strong> Enter your account number, broker server, and <em>investor password</em> (read-only). MetaAPI provisions a cloud terminal and syncs your trade history. You need a <a href="https://app.metaapi.cloud/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>MetaAPI account</a> and your token in <code style={{ background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4, fontSize: '0.73rem' }}>backend/.env</code>.
            </div>
          </div>
          <AddAccountForm onAdded={loadAccounts} />
        </>
      )}

      {/* Cloud accounts list (always shown if any exist) */}
      {mt5Mode === 'cloud' && (
        <div style={{ marginTop: '28px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
            Cloud Accounts ({accounts.length})
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>
              <span className="loading-spinner" style={{ width: 24, height: 24, borderWidth: 2.5, display: 'inline-block' }} />
            </div>
          ) : accounts.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: 12 }}>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <p>No cloud accounts connected yet. Add your first MT5 account above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {accounts.map(acc => (
                <AccountCard key={acc.id} account={acc} onDelete={handleDelete} onSync={handleSync} onDeploy={handleDeploy} syncing={syncing} deploying={deploying} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config hint */}
      <div style={{
        marginTop: '28px', background: 'var(--bg-3)', borderRadius: 'var(--radius-m)',
        padding: '12px 16px', fontSize: '0.73rem', color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        💡 <strong>Switch modes:</strong> Set <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3 }}>MT5_MODE=local</code> or <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3 }}>MT5_MODE=cloud</code> in <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3 }}>backend/.env</code> and restart the server.
      </div>
    </div>
  );
}
