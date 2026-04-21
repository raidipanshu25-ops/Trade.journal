import React, { useState, useEffect } from 'react';
import { authApi } from '../api';
import { GoogleLogin } from '@react-oauth/google';

export function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Use the same dynamic background as the main app
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('tj-theme') || 'dark');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !username) return;
    
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(username, password);
      if (res.token) {
        localStorage.setItem('tj-auth-token', res.token);
        onLogin(res.token);
      }
    } catch (err) {
      setError(err.message.includes('401') ? 'Incorrect credentials. Access denied.' : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.googleLogin(credentialResponse.credential);
      if (res.token) {
        localStorage.setItem('tj-auth-token', res.token);
        onLogin(res.token);
      }
    } catch (err) {
      setError(err.message.includes('403') ? 'Your Google Account is not authorized.' : 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--bg-sidebar)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-modal)',
        animation: 'fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
             <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
               <rect width="32" height="32" rx="8" fill="#080808" />
               <rect x="5" y="10" width="4" height="13" rx="1.5" fill="var(--cyan)" />
               <rect x="14" y="5" width="4" height="18" rx="1.5" fill="var(--cyan)" />
               <rect x="23" y="13" width="4" height="10" rx="1.5" fill="var(--cyan)" />
             </svg>
             <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'display', letterSpacing: '-0.02em', color: 'var(--text-0)' }}>
                <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>Trade</span>
                <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>.journal</span>
             </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem' }}>Secure Dashboard Authentication</p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span>Username</span>
            </label>
            <input
              type="text"
              className="form-input"
              style={{ padding: '12px', fontSize: '1rem' }}
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              placeholder="admin"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span>Password</span>
            </label>
            <input
              type="password"
              className="form-input"
              style={{ padding: '12px', fontSize: '1rem', letterSpacing: '0.1em' }}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              background: 'var(--red-dim)',
              color: 'var(--red-bright)',
              border: '1px solid var(--red-border)',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '24px',
              animation: 'fade-in 0.2s ease-out'
            }}>
              {error}
            </div>
          )}

          <button 
             type="submit" 
             className="btn btn-primary" 
             style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
             disabled={loading || !password || !username}
          >
            {loading ? 'Authenticating...' : 'Unlock Dashboard'}
          </button>
        </form>

        <div style={{ width: '100%', display: 'flex', alignItems: 'center', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            <span style={{ padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or continue with</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Sign-In failed')}
                theme={localStorage.getItem('tj-theme') === 'light' ? 'outline' : 'filled_black'}
                size="large"
                text="signin_with"
                shape="rectangular"
                useOneTap={false}
            />
        </div>
      </div>
    </div>
  );
}
