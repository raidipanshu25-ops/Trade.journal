import { useState, useEffect } from 'react';
import { authApi } from '../api';
import { GoogleLogin } from '@react-oauth/google';

function PasswordStrength({ password }) {
  const getStrength = (pw) => {
    if (!pw) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: 20, label: 'Weak', color: 'var(--red)' };
    if (score <= 2) return { level: 40, label: 'Fair', color: 'var(--amber)' };
    if (score <= 3) return { level: 60, label: 'Good', color: 'var(--amber)' };
    if (score <= 4) return { level: 80, label: 'Strong', color: 'var(--green)' };
    return { level: 100, label: 'Very Strong', color: 'var(--green-bright)' };
  };
  const s = getStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>Password Strength</span>
        <span style={{ fontSize: '0.7rem', color: s.color, fontFamily: 'var(--mono)', fontWeight: 600 }}>{s.label}</span>
      </div>
      <div style={{ width: '100%', height: '3px', background: 'var(--bg-4)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${s.level}%`, height: '100%', background: s.color, borderRadius: '2px', transition: 'all 300ms ease' }} />
      </div>
    </div>
  );
}

export function LoginPage({ onLogin, onBack }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('tj-theme') || 'dark');
  }, []);

  const resetForm = () => { setUsername(''); setEmail(''); setPassword(''); setConfirmPassword(''); setTotpCode(''); setError(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password || !username) return;
    setLoading(true); setError('');
    try {
      const res = await authApi.login(username, password);
      if (res.requires_2fa) { setTempToken(res.temp_token); setMode('2fa'); setTotpCode(''); }
      else if (res.token) { localStorage.setItem('tj-auth-token', res.token); onLogin(res.token); }
    } catch (err) {
      setError(err.message.includes('401') ? 'Incorrect credentials.' : err.message.includes('403') ? 'Account deactivated.' : 'Login failed.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) return;
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try {
      const res = await authApi.register(username, email, password);
      if (res.token) { localStorage.setItem('tj-auth-token', res.token); onLogin(res.token); }
    } catch (err) {
      if (err.message.includes('409')) setError('Username or email already taken');
      else if (err.message.includes('403')) setError('Registration is disabled');
      else setError('Registration failed.');
    } finally { setLoading(false); }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) return;
    setLoading(true); setError('');
    try {
      const res = await authApi.verify2FA(totpCode, tempToken);
      if (res.token) { localStorage.setItem('tj-auth-token', res.token); onLogin(res.token); }
    } catch { setError('Invalid 2FA code. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true); setError('');
    try {
      const res = await authApi.googleLogin(credentialResponse.credential);
      if (res.token) { localStorage.setItem('tj-auth-token', res.token); onLogin(res.token); }
    } catch (err) {
      setError(err.message.includes('403') ? 'Your Google Account is not authorized.' : 'Google Sign-In failed.');
    } finally { setLoading(false); }
  };

  const cardStyle = {
    width: '100%', maxWidth: '440px', padding: '40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'var(--bg-sidebar)', backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)', border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-modal)', animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const errBox = error && (
    <div style={{ background: 'var(--red-dim)', color: 'var(--red-bright)', border: '1px solid var(--red-border)',
      padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px', width: '100%' }}>{error}</div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={cardStyle}>
        {/* Brand */}
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
              <rect width="32" height="32" rx="8" fill="#080808" />
              <rect x="5" y="10" width="4" height="13" rx="1.5" fill="var(--cyan)" />
              <rect x="14" y="5" width="4" height="18" rx="1.5" fill="var(--cyan)" />
              <rect x="23" y="13" width="4" height="10" rx="1.5" fill="var(--cyan)" />
            </svg>
            <h1 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '-0.02em', color: 'var(--text-0)' }}>
              <span style={{ fontWeight: 600 }}>Trade</span><span style={{ color: 'var(--text-2)', fontWeight: 400 }}>.journal</span>
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.85rem' }}>
            {mode === 'login' && 'Sign in to your dashboard'}
            {mode === 'register' && 'Create your trading account'}
            {mode === '2fa' && 'Two-factor authentication'}
          </p>
        </div>

        {/* Login */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Username</label>
              <input type="text" className="form-input" style={{ padding: '12px', fontSize: '1rem' }}
                value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="admin" disabled={loading} autoFocus id="login-username" />
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input type="password" className="form-input" style={{ padding: '12px', fontSize: '1rem', letterSpacing: '0.1em' }}
                value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••" disabled={loading} id="login-password" />
            </div>
            {errBox}
            <button type="submit" className="btn btn-primary" id="login-submit-btn"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
              disabled={loading || !password || !username}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', margin: '20px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ padding: '0 12px', fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or continue with</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google Sign-In failed')}
                theme={localStorage.getItem('tj-theme') === 'light' ? 'outline' : 'filled_black'}
                size="large" text="signin_with" shape="rectangular" useOneTap={false} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>Don't have an account? </span>
              <button type="button" onClick={() => { setMode('register'); resetForm(); }}
                style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit' }}>
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* Register */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ width: '100%' }}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Username</label>
              <input type="text" className="form-input" style={{ padding: '12px', fontSize: '1rem' }}
                value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="trader_pro" disabled={loading} autoFocus id="register-username" />
            </div>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Email</label>
              <input type="email" className="form-input" style={{ padding: '12px', fontSize: '1rem' }}
                value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com" disabled={loading} id="register-email" />
            </div>
            <div className="form-group" style={{ marginBottom: '4px' }}>
              <label className="form-label">Password</label>
              <input type="password" className="form-input" style={{ padding: '12px', fontSize: '1rem', letterSpacing: '0.1em' }}
                value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••" disabled={loading} id="register-password" />
              <PasswordStrength password={password} />
            </div>
            <div className="form-group" style={{ marginBottom: '20px', marginTop: '14px' }}>
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" style={{ padding: '12px', fontSize: '1rem', letterSpacing: '0.1em' }}
                value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="••••••••" disabled={loading} id="register-confirm" />
              {confirmPassword && password !== confirmPassword && (
                <span style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '4px', display: 'block' }}>Passwords do not match</span>
              )}
            </div>
            {errBox}
            <button type="submit" className="btn btn-primary" id="register-submit-btn"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
              disabled={loading || !username || !email || !password || password !== confirmPassword}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>Already have an account? </span>
              <button type="button" onClick={() => { setMode('login'); resetForm(); }}
                style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit' }}>
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* 2FA */}
        {mode === '2fa' && (
          <form onSubmit={handle2FA} style={{ width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--cyan-dim2)',
                border: '1px solid var(--cyan-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', margin: 0 }}>Enter the 6-digit code from your authenticator app</p>
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <input type="text" className="form-input" maxLength={6} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
                style={{ padding: '16px', fontSize: '1.8rem', textAlign: 'center', letterSpacing: '0.5em', fontFamily: 'var(--mono)', fontWeight: 700 }}
                value={totpCode} onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="000000" disabled={loading} autoFocus id="totp-input" />
            </div>
            {errBox}
            <button type="submit" className="btn btn-primary" id="totp-submit-btn"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
              disabled={loading || totpCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button type="button" onClick={() => { setMode('login'); resetForm(); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit' }}>
                ← Back to login
              </button>
            </div>
          </form>
        )}
        {onBack && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button type="button" onClick={onBack}
              style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit' }}>
              ← Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
