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
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>Password Strength</span>
        <span style={{ fontSize: '0.72rem', color: s.color, fontFamily: 'var(--mono)', fontWeight: 600 }}>{s.label}</span>
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
    width: '100%', maxWidth: '460px', padding: '48px 44px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'var(--bg-sidebar)', backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)', border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-modal)', animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    borderRadius: '20px',
  };

  const inputStyle = {
    padding: '14px 16px', fontSize: '0.95rem',
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-m)', color: 'var(--text-0)',
    fontFamily: 'var(--font)', width: '100%',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block', fontSize: '0.7rem', fontWeight: 600,
    color: 'var(--text-1)', marginBottom: '8px',
    textTransform: 'uppercase', letterSpacing: '1.5px',
    fontFamily: "var(--font-display)",
  };

  const errBox = error && (
    <div style={{ background: 'var(--red-dim)', color: 'var(--red-bright)', border: '1px solid var(--red-border)',
      padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '18px', width: '100%' }}>{error}</div>
  );

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }} />
      </div>

      <div style={{ ...cardStyle, position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <svg viewBox="0 0 32 32" width="36" height="36" fill="none">
              <rect width="32" height="32" rx="8" fill="#080808" />
              <rect x="5" y="10" width="4" height="13" rx="1.5" fill="var(--cyan)" />
              <rect x="14" y="5" width="4" height="18" rx="1.5" fill="var(--cyan)" />
              <rect x="23" y="13" width="4" height="10" rx="1.5" fill="var(--cyan)" />
            </svg>
            <h1 style={{
              margin: 0, fontSize: '1.5rem', letterSpacing: '0.04em',
              color: 'var(--text-0)', fontFamily: 'var(--font-display)',
              fontWeight: 800, textTransform: 'uppercase',
            }}>
              Trade<span style={{ color: 'var(--cyan)' }}>.</span>Journal
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.88rem', fontFamily: 'var(--font)' }}>
            {mode === 'login' && 'Sign in to your trading dashboard'}
            {mode === 'register' && 'Create your trading account'}
            {mode === '2fa' && 'Two-factor authentication'}
          </p>
        </div>

        {/* Login */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Username</label>
              <input type="text" style={inputStyle}
                value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="admin" disabled={loading} autoFocus id="login-username"
                onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Password</label>
              <input type="password" style={{ ...inputStyle, letterSpacing: '0.1em' }}
                value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••" disabled={loading} id="login-password"
                onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            {errBox}
            <button type="submit" className="btn btn-primary" id="login-submit-btn"
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 700, borderRadius: '12px' }}
              disabled={loading || !password || !username}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', margin: '22px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ padding: '0 14px', fontSize: '0.72rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)' }}>Or continue with</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google Sign-In failed')}
                theme={localStorage.getItem('tj-theme') === 'light' ? 'outline' : 'filled_black'}
                size="large" text="signin_with" shape="rectangular" useOneTap={false} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-2)' }}>Don't have an account? </span>
              <button type="button" onClick={() => { setMode('register'); resetForm(); }}
                style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, fontFamily: 'inherit' }}>
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* Register */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ width: '100%' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Username</label>
              <input type="text" style={inputStyle}
                value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="trader_pro" disabled={loading} autoFocus id="register-username"
                onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Email</label>
              <input type="email" style={inputStyle}
                value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com" disabled={loading} id="register-email"
                onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ marginBottom: '6px' }}>
              <label style={labelStyle}>Password</label>
              <input type="password" style={{ ...inputStyle, letterSpacing: '0.1em' }}
                value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••" disabled={loading} id="register-password"
                onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
              <PasswordStrength password={password} />
            </div>
            <div style={{ marginBottom: '24px', marginTop: '16px' }}>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" style={{ ...inputStyle, letterSpacing: '0.1em' }}
                value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="••••••••" disabled={loading} id="register-confirm"
                onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
              {confirmPassword && password !== confirmPassword && (
                <span style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '6px', display: 'block' }}>Passwords do not match</span>
              )}
            </div>
            {errBox}
            <button type="submit" className="btn btn-primary" id="register-submit-btn"
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 700, borderRadius: '12px' }}
              disabled={loading || !username || !email || !password || password !== confirmPassword}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '22px' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-2)' }}>Already have an account? </span>
              <button type="button" onClick={() => { setMode('login'); resetForm(); }}
                style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, fontFamily: 'inherit' }}>
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* 2FA */}
        {mode === '2fa' && (
          <form onSubmit={handle2FA} style={{ width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'var(--cyan-dim2)',
                border: '1px solid var(--cyan-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', margin: 0 }}>Enter the 6-digit code from your authenticator app</p>
            </div>
            <div style={{ marginBottom: '28px' }}>
              <input type="text" maxLength={6} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
                style={{ ...inputStyle, padding: '18px', fontSize: '1.8rem', textAlign: 'center', letterSpacing: '0.5em', fontFamily: 'var(--mono)', fontWeight: 700 }}
                value={totpCode} onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="000000" disabled={loading} autoFocus id="totp-input"
                onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            {errBox}
            <button type="submit" className="btn btn-primary" id="totp-submit-btn"
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 700, borderRadius: '12px' }}
              disabled={loading || totpCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '22px' }}>
              <button type="button" onClick={() => { setMode('login'); resetForm(); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>
                ← Back to login
              </button>
            </div>
          </form>
        )}
        {onBack && (
          <div style={{ textAlign: 'center', marginTop: '22px' }}>
            <button type="button" onClick={onBack}
              style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>
              ← Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
