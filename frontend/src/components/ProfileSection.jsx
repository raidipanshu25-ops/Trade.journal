import { useState, useEffect } from 'react';
import { authApi } from '../api';

function parseUA(ua) {
  if (!ua) return 'Unknown Device';
  if (ua.includes('Chrome') && !ua.includes('Edge')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return ua.slice(0, 40);
}

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ProfileSection({ user, onLogout, onUserUpdate }) {
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [sessLoading, setSessLoading] = useState(true);

  const [tfaStep, setTfaStep] = useState('idle'); // idle | setup | verify | disabling
  const [tfaData, setTfaData] = useState(null);
  const [tfaCode, setTfaCode] = useState('');
  const [tfaErr, setTfaErr] = useState('');
  const [tfaLoading, setTfaLoading] = useState(false);

  useEffect(() => {
    authApi.getSessions().then(setSessions).catch(() => {}).finally(() => setSessLoading(false));
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) { setPwErr('Passwords do not match'); return; }
    if (pwNew.length < 6) { setPwErr('Min 6 characters'); return; }
    setPwLoading(true); setPwErr(''); setPwMsg('');
    try {
      await authApi.changePassword(pwCurrent, pwNew);
      setPwMsg('Password changed successfully');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (err) {
      setPwErr(err.message.includes('401') ? 'Current password is incorrect' : 'Failed to change password');
    } finally { setPwLoading(false); }
  };

  const handleSetup2FA = async () => {
    setTfaLoading(true); setTfaErr('');
    try {
      const data = await authApi.setup2FA();
      setTfaData(data);
      setTfaStep('setup');
    } catch (err) { setTfaErr(err.message); }
    finally { setTfaLoading(false); }
  };

  const handleVerify2FA = async () => {
    if (tfaCode.length !== 6) return;
    setTfaLoading(true); setTfaErr('');
    try {
      await authApi.verify2FA(tfaCode);
      setTfaStep('idle');
      setTfaCode('');
      setTfaData(null);
      if (onUserUpdate) onUserUpdate();
    } catch { setTfaErr('Invalid code. Try again.'); }
    finally { setTfaLoading(false); }
  };

  const handleDisable2FA = async () => {
    if (tfaCode.length !== 6) return;
    setTfaLoading(true); setTfaErr('');
    try {
      await authApi.disable2FA(tfaCode);
      setTfaStep('idle');
      setTfaCode('');
      if (onUserUpdate) onUserUpdate();
    } catch { setTfaErr('Invalid code.'); }
    finally { setTfaLoading(false); }
  };

  const handleRevokeSession = async (id) => {
    try {
      await authApi.revokeSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {}
  };

  const handleRevokeAll = async () => {
    try {
      await authApi.logout();
      onLogout();
    } catch {}
  };

  const sectionTitle = (icon, text) => (
    <div className="settings-section-title" style={{ marginTop: '0' }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
        {icon}
      </svg>
      {text}
    </div>
  );

  const isSso = user?.email && !user?.password_hash;

  return (
    <div>
      {/* Account Info */}
      <div className="card" style={{ marginBottom: '28px' }}>
        {sectionTitle(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>, 'Account')}
        <div className="profile-info-row">
          <span className="profile-info-label">Username</span>
          <span className="profile-info-value">{user?.username || '—'}</span>
        </div>
        <div className="profile-info-row">
          <span className="profile-info-label">Email</span>
          <span className="profile-info-value">{user?.email || '—'}</span>
        </div>
        <div className="profile-info-row">
          <span className="profile-info-label">Role</span>
          <span className={`role-badge ${user?.role || 'user'}`}>{user?.role || 'user'}</span>
        </div>
        <div className="profile-info-row">
          <span className="profile-info-label">Member Since</span>
          <span className="profile-info-value">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
        </div>
      </div>

      {/* Change Password */}
      <div className="card" style={{ marginBottom: '28px' }}>
        {sectionTitle(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, 'Change Password')}
        <form onSubmit={handleChangePassword}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Current Password</label>
            <input type="password" className="form-input" value={pwCurrent} onChange={e => { setPwCurrent(e.target.value); setPwErr(''); setPwMsg(''); }} id="pw-current" />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" value={pwNew} onChange={e => { setPwNew(e.target.value); setPwErr(''); setPwMsg(''); }} id="pw-new" />
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Confirm New Password</label>
            <input type="password" className="form-input" value={pwConfirm} onChange={e => { setPwConfirm(e.target.value); setPwErr(''); setPwMsg(''); }} id="pw-confirm" />
          </div>
          {pwErr && <div style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: '10px' }}>{pwErr}</div>}
          {pwMsg && <div style={{ color: 'var(--green)', fontSize: '0.82rem', marginBottom: '10px' }}>✓ {pwMsg}</div>}
          <button type="submit" className="btn btn-primary" disabled={pwLoading || !pwCurrent || !pwNew || pwNew !== pwConfirm} id="pw-submit">
            {pwLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div className="card" style={{ marginBottom: '28px' }}>
        {sectionTitle(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>, 'Two-Factor Authentication')}
        {user?.totp_enabled ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span className="status-badge active">Enabled</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>2FA is active on your account</span>
            </div>
            {tfaStep === 'disabling' ? (
              <div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '12px' }}>Enter your current 2FA code to disable:</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input type="text" className="form-input" maxLength={6} inputMode="numeric" value={tfaCode}
                    onChange={e => { setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTfaErr(''); }}
                    placeholder="000000" style={{ width: '140px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '1.1rem', letterSpacing: '0.3em' }} id="tfa-disable-code" />
                  <button className="btn btn-primary" onClick={handleDisable2FA} disabled={tfaLoading || tfaCode.length !== 6}>
                    {tfaLoading ? 'Disabling...' : 'Confirm'}
                  </button>
                  <button className="btn-danger" style={{ padding: '8px 12px' }} onClick={() => { setTfaStep('idle'); setTfaCode(''); setTfaErr(''); }}>Cancel</button>
                </div>
                {tfaErr && <div style={{ color: 'var(--red)', fontSize: '0.82rem', marginTop: '8px' }}>{tfaErr}</div>}
              </div>
            ) : (
              <button className="btn-danger" onClick={() => setTfaStep('disabling')} id="tfa-disable-btn">Disable 2FA</button>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '16px' }}>
              Add an extra layer of security by enabling two-factor authentication with an authenticator app.
            </p>
            {tfaStep === 'idle' && (
              <button className="btn btn-primary" onClick={handleSetup2FA} disabled={tfaLoading} id="tfa-setup-btn">
                {tfaLoading ? 'Setting up...' : 'Enable 2FA'}
              </button>
            )}
            {tfaStep === 'setup' && tfaData && (
              <div>
                <div className="qr-container">
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '12px' }}>Scan with your authenticator app:</p>
                  {tfaData.qr_code && <img src={tfaData.qr_code} alt="2FA QR Code" />}
                  <div className="totp-secret-display">{tfaData.secret}</div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label className="form-label">Enter verification code:</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="text" className="form-input" maxLength={6} inputMode="numeric" value={tfaCode}
                      onChange={e => { setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTfaErr(''); }}
                      placeholder="000000" style={{ width: '160px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '1.2rem', letterSpacing: '0.4em' }} id="tfa-verify-code" />
                    <button className="btn btn-primary" onClick={handleVerify2FA} disabled={tfaLoading || tfaCode.length !== 6}>
                      {tfaLoading ? 'Verifying...' : 'Verify & Enable'}
                    </button>
                  </div>
                  {tfaErr && <div style={{ color: 'var(--red)', fontSize: '0.82rem', marginTop: '8px' }}>{tfaErr}</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="card" style={{ marginBottom: '28px' }}>
        {sectionTitle(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>, 'Active Sessions')}
        {sessLoading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-2)', fontSize: '0.82rem' }}>Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <p style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>No active sessions found.</p>
        ) : (
          <div>
            {sessions.map(s => (
              <div key={s.id} className={`session-row ${s.is_current ? 'current' : ''}`}>
                <div>
                  <div className="session-device">
                    {parseUA(s.device_info)}
                    {s.is_current && <span style={{ marginLeft: '8px', color: 'var(--cyan)', fontSize: '0.7rem', fontFamily: 'var(--mono)' }}>CURRENT</span>}
                  </div>
                  <div className="session-meta">{s.ip_address} · {timeAgo(s.last_active)}</div>
                </div>
                {!s.is_current && (
                  <button className="btn-icon danger" onClick={() => handleRevokeSession(s.id)} title="Revoke session">
                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
            ))}
            <div style={{ marginTop: '16px' }}>
              <button className="btn-danger" onClick={handleRevokeAll} id="signout-everywhere">Sign Out Everywhere</button>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button className="btn-danger" onClick={onLogout} style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }} id="logout-btn">
        Sign Out
      </button>
    </div>
  );
}
