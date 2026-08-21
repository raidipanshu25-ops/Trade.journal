import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

/**
 * Wrapper that fetches public config (Google Client ID, etc.) from the backend
 * at runtime. This means anyone can deploy without rebuilding the frontend —
 * just set env vars on the backend.
 */
function Root() {
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [ready, setReady] = useState(!!clientId);

  useEffect(() => {
    // If already set via build-time env, skip fetch
    if (clientId) return;

    const base = import.meta.env.VITE_API_URL || '';
    fetch(`${base}/api/config`)
      .then(r => r.json())
      .then(cfg => {
        if (cfg.google_client_id) {
          setClientId(cfg.google_client_id);
        }
        setReady(true);
      })
      .catch(() => setReady(true)); // Still render app even if config fetch fails
  }, []);

  if (!ready) {
    return null; // Brief loading state
  }

  if (!clientId) {
    // No Google SSO configured — render app without OAuth provider
    return (
      <StrictMode>
        <App />
      </StrictMode>
    );
  }

  return (
    <StrictMode>
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
