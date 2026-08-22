import { useState, useEffect } from 'react';
import { api } from '../api';
import { ProfileSection } from './ProfileSection';

/* ════════════════════════════════════════════════
   Theme Presets
   ════════════════════════════════════════════════ */

const THEME_PRESETS = [
  {
    id: 'terminal-teal',
    name: 'Terminal Teal',
    desc: 'FundingPips-inspired',
    accent: '#00D9A3',
    accentDark: '#00B88A',
    bgBase: '#0A0E14',
    bgSurface: '#111722',
    bgRaised: '#161D2B',
    borderColor: '#232B3A',
    textPrimary: '#F2F5F9',
    textSecondary: '#8A93A6',
    profit: '#22C55E',
    loss: '#F43F5E',
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Gold',
    desc: 'GoatFundedTrader-inspired',
    accent: '#D4A24C',
    accentDark: '#B8892E',
    bgBase: '#0B0A0A',
    bgSurface: '#141211',
    bgRaised: '#1C1917',
    borderColor: '#2A2622',
    textPrimary: '#F5F1E8',
    textSecondary: '#9C9385',
    profit: '#34D399',
    loss: '#FB7185',
  },
  {
    id: 'violet-aurora',
    name: 'Violet Aurora',
    desc: 'Maven-inspired',
    accent: '#8B5CF6',
    accentDark: '#7C3AED',
    bgBase: '#0D0B14',
    bgSurface: '#14111F',
    bgRaised: '#1C1830',
    borderColor: '#2A2440',
    textPrimary: '#F3F1FA',
    textSecondary: '#948DA8',
    profit: '#10B981',
    loss: '#EF4444',
  },
];

/* ════════════════════════════════════════════════
   Color Utilities
   ════════════════════════════════════════════════ */

function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

/* ════════════════════════════════════════════════
   applyThemePreset — the new unified function
   ════════════════════════════════════════════════ */

export function applyThemePreset(presetId) {
  if (!presetId) presetId = 'terminal-teal';

  const el = document.documentElement;

  // Clear any lingering inline body background styles from the old system
  document.body.style.backgroundImage = '';
  document.body.style.backgroundSize = '';
  document.body.style.backgroundColor = '';
  document.body.style.backgroundAttachment = '';

  // Backward compat: dark / light passthrough
  if (presetId === 'dark' || presetId === 'light') {
    el.setAttribute('data-theme', presetId);
    localStorage.setItem('tj-preset', presetId);
    localStorage.setItem('tj-theme', presetId);
    // Clear any custom inline CSS vars so the stylesheet defaults take over
    const varsToClear = [
      '--bg-0', '--bg-1', '--bg-2', '--bg-3', '--border',
      '--cyan', '--cyan-dark', '--cyan-dim', '--cyan-dim2', '--cyan-border',
      '--cyan-glow', '--cyan-glow-sm', '--gradient-accent', '--gradient-accent-hover', '--gradient-brand',
      '--text-0', '--text-1', '--text-2',
      '--green', '--red',
    ];
    varsToClear.forEach(v => el.style.removeProperty(v));
    return;
  }

  // Custom preset — derive from saved base color
  if (presetId === 'custom') {
    const baseHex = localStorage.getItem('tj-custom-base') || '#00D9A3';
    const { h, s, l } = hexToHSL(baseHex);

    const bgBase = hslToHex(h, Math.min(s, 15), Math.max(l, 5));
    const bgSurface = hslToHex(h, Math.min(s, 15), Math.max(l, 5) + 4);
    const bgRaised = hslToHex(h, Math.min(s, 15), Math.max(l, 5) + 8);
    const borderHex = hslToHex(h, Math.min(s, 15), Math.max(l, 5) + 12);

    const rgb = hexToRgb(baseHex);

    el.setAttribute('data-theme', 'dark');
    localStorage.setItem('tj-preset', 'custom');
    localStorage.setItem('tj-theme', 'custom');

    el.style.setProperty('--bg-0', bgBase);
    el.style.setProperty('--bg-1', bgSurface);
    el.style.setProperty('--bg-2', bgRaised);
    el.style.setProperty('--bg-3', borderHex);
    el.style.setProperty('--border', borderHex);

    el.style.setProperty('--cyan', baseHex);
    el.style.setProperty('--cyan-dark', hslToHex(h, s, Math.max(l - 10, 10)));
    el.style.setProperty('--cyan-dim', `rgba(${rgb}, 0.06)`);
    el.style.setProperty('--cyan-dim2', `rgba(${rgb}, 0.09)`);
    el.style.setProperty('--cyan-border', `rgba(${rgb}, 0.14)`);
    el.style.setProperty('--cyan-glow', `0 0 16px rgba(${rgb}, 0.2), 0 0 32px rgba(${rgb}, 0.06)`);
    el.style.setProperty('--cyan-glow-sm', `0 0 8px rgba(${rgb}, 0.18)`);
    el.style.setProperty('--gradient-accent', `linear-gradient(135deg, ${baseHex} 0%, ${hslToHex(h, s, Math.max(l - 10, 10))} 100%)`);
    el.style.setProperty('--gradient-accent-hover', `linear-gradient(135deg, ${hslToHex(h, s, Math.max(l - 10, 10))} 0%, ${hslToHex(h, s, Math.max(l - 10, 10))} 100%)`);
    el.style.setProperty('--gradient-brand', `linear-gradient(135deg, ${baseHex}, ${hslToHex(h, s, Math.max(l - 10, 10))})`);

    el.style.setProperty('--text-0', '#F2F5F9');
    el.style.setProperty('--text-1', '#8A93A6');
    el.style.setProperty('--text-2', '#5A6478');

    el.style.setProperty('--green', '#22C55E');
    el.style.setProperty('--red', '#F43F5E');
    return;
  }

  // Named preset — just set data-theme; CSS handles the rest
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  if (preset) {
    el.setAttribute('data-theme', presetId);
    localStorage.setItem('tj-preset', presetId);
    localStorage.setItem('tj-theme', presetId);
    // Clear any custom inline CSS vars so the data-theme CSS rules take precedence
    const varsToClear = [
      '--bg-0', '--bg-1', '--bg-2', '--bg-3', '--border',
      '--cyan', '--cyan-dark', '--cyan-dim', '--cyan-dim2', '--cyan-border',
      '--cyan-glow', '--cyan-glow-sm', '--gradient-accent', '--gradient-accent-hover', '--gradient-brand',
      '--text-0', '--text-1', '--text-2',
      '--green', '--red',
    ];
    varsToClear.forEach(v => el.style.removeProperty(v));
  }
}

/* ════════════════════════════════════════════════
   Backward-Compat No-Op Exports
   (App.jsx still imports and calls these on mount)
   ════════════════════════════════════════════════ */

export function applyBgPreset() { /* no-op — handled by data-theme */ }
export function applyAccentPreset() { /* no-op — handled by data-theme */ }
export function applyTextPreset() { /* no-op — handled by data-theme */ }

/* ════════════════════════════════════════════════
   SettingsPage Component
   ════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
   MT5 Connector — Sync Token Management
   ════════════════════════════════════════════════ */
function ConnectorTokenSection() {
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.getSyncToken().then(d => { setToken(d.sync_token || ''); setHasToken(d.has_token); }).catch(() => {});
    api.getSyncStatus().then(setStatus).catch(() => {});
  }, []);

  const handleCopy = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const d = await api.generateSyncToken();
      setToken(d.sync_token);
      setHasToken(true);
    } catch { /* silent */ }
    setRegenerating(false);
  };

  const masked = token ? token.slice(0, 8) + '••••••••' + token.slice(-4) : '—';

  return (
    <div className="card" style={{ marginBottom: '28px' }}>
      <div className="settings-section-title">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
        MT5 Connector
      </div>

      {/* Connection Status */}
      {status && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '16px', padding: '8px 12px', borderRadius: '8px',
          background: status.connected ? 'rgba(34,197,94,0.08)' : 'rgba(244,63,94,0.08)',
          border: `1px solid ${status.connected ? 'rgba(34,197,94,0.2)' : 'rgba(244,63,94,0.2)'}`,
          fontSize: '0.8rem', fontFamily: 'var(--mono)',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: status.connected ? 'var(--green)' : 'var(--red)',
          }} />
          <span style={{ color: status.connected ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {status.connected ? 'Local Agent Connected' : 'Local Agent Disconnected'}
          </span>
          {status.last_sync && (
            <span style={{ color: 'var(--text-2)', marginLeft: 'auto', fontSize: '0.72rem' }}>
              Last sync: {new Date(status.last_sync).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Sync Token */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{
          display: 'block', fontSize: '11px', fontFamily: 'var(--mono)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--text-2)', marginBottom: '8px', fontWeight: 600,
        }}>Sync Token</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <code style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px',
            background: 'var(--bg-0)', border: '1px solid var(--border)',
            color: 'var(--text-0)', fontSize: '0.82rem', fontFamily: 'var(--mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {showToken ? (token || '—') : masked}
          </code>
          <button className="btn btn-secondary" onClick={() => setShowToken(!showToken)} title={showToken ? 'Hide' : 'Show'}
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
            {showToken ? '🙈' : '👁️'}
          </button>
          <button className="btn btn-secondary" onClick={handleCopy} disabled={!token}
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleRegenerate} disabled={regenerating}
          style={{ fontSize: '0.78rem' }}>
          {regenerating ? 'Generating…' : hasToken ? '🔄 Regenerate Token' : '🔑 Generate Token'}
        </button>
        <a 
          href={`/api/sync/connector.zip?token=${encodeURIComponent(token || '')}`} 
          download="tj-mt5-connector.zip"
          className="btn btn-secondary"
          style={{ fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>📥</span> Download Connector (.zip)
        </a>
        <span style={{ color: 'var(--text-2)', fontSize: '0.72rem', fontFamily: 'var(--mono)', width: '100%', marginTop: '4px' }}>
          {hasToken ? 'Regenerating will invalidate the old token.' : 'Generate a token to connect your local MT5 agent.'}
        </span>
      </div>
    </div>
  );
}


export function SettingsPage({ theme, onToggleTheme, currentUser, onLogout, onUserUpdate }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [activePreset, setActivePreset] = useState(() => localStorage.getItem('tj-preset') || 'terminal-teal');
  const [customColor, setCustomColor] = useState(() => localStorage.getItem('tj-custom-base') || '#00D9A3');
  const [contrast, setContrast] = useState(() => parseInt(localStorage.getItem('tj-contrast') || '100', 10));

  // Apply theme on mount
  useEffect(() => {
    applyThemePreset(activePreset);
  }, []);

  // Contrast filter
  useEffect(() => {
    document.documentElement.style.filter = `contrast(${contrast}%) brightness(${contrast === 100 ? 100 : contrast - 10}%)`;
    localStorage.setItem('tj-contrast', contrast);
  }, [contrast]);

  // Fetch settings
  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  // 48-Hour Rule Locker Countdown
  useEffect(() => {
    if (!settings?.lock_expiry) {
      setTimeLeft('');
      return;
    }
    const updateCountdown = () => {
      const expiry = new Date(settings.lock_expiry).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeLeft('Unlocking on next refresh...');
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${h}h ${m}m`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // update every minute
    return () => clearInterval(interval);
  }, [settings?.lock_expiry]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleAddBonusRule = () => {
    const newRule = {
      id: 'rule_' + Date.now(),
      target_session: 'london',
      bonus_trades: 1,
      conditions: [{ type: 'consecutive_wins', lookback_trades: 2, source_session: 'asia' }]
    };
    setSettings(prev => ({
      ...prev,
      bonus_rules: [...(prev.bonus_rules || []), newRule]
    }));
    setSaved(false);
  };

  const handleUpdateBonusRule = (id, field, value) => {
    setSettings(prev => ({
      ...prev,
      bonus_rules: (prev.bonus_rules || []).map(r => r.id === id ? { ...r, [field]: value } : r)
    }));
    setSaved(false);
  };

  const handleUpdateBonusCondition = (ruleId, field, value) => {
    setSettings(prev => ({
      ...prev,
      bonus_rules: (prev.bonus_rules || []).map(r => {
        if (r.id === ruleId) {
          const newConds = [...(r.conditions || [])];
          if (newConds.length > 0) {
            newConds[0] = { ...newConds[0], [field]: value };
          }
          return { ...r, conditions: newConds };
        }
        return r;
      })
    }));
    setSaved(false);
  };

  const handleDeleteBonusRule = (id) => {
    setSettings(prev => ({
      ...prev,
      bonus_rules: (prev.bonus_rules || []).filter(r => r.id !== id)
    }));
    setSaved(false);
  };
  const handleSessionChange = (session, key, value) => {
    setSettings(prev => ({
      ...prev,
      sessions: {
        ...prev.sessions,
        [session]: { ...prev.sessions[session], [key]: value },
      },
    }));
    setSaved(false);
  };

  const handleAddSession = () => {
    const newSessionName = 'new_session_' + Date.now().toString().slice(-4);
    setSettings(prev => ({
      ...prev,
      sessions: {
        ...prev.sessions,
        [newSessionName]: {
          start: '08:00',
          end: '16:00',
          enabled: true,
          max_trades: 1
        }
      }
    }));
    setSaved(false);
  };

  const handleDeleteSession = (sessionName) => {
    setSettings(prev => {
      const newSessions = { ...prev.sessions };
      delete newSessions[sessionName];
      return { ...prev, sessions: newSessions };
    });
    setSaved(false);
  };

  const handleRenameSession = (oldName, newName) => {
    if (oldName === newName || !newName.trim()) return;
    setSettings(prev => {
      const newSessions = { ...prev.sessions };
      newSessions[newName] = newSessions[oldName];
      delete newSessions[oldName];
      return { ...prev, sessions: newSessions };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.updateSettings(settings);
      // The API returns the updated settings, which might contain lock_expiry if it was a looser rule
      if (result && result.settings) {
        setSettings(result.settings);
      } else {
        // Fallback fetch
        const updated = await api.getSettings();
        setSettings(updated);
      }
      setSaved(true);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = (presetId) => {
    setActivePreset(presetId);
    applyThemePreset(presetId);
  };

  const handleCustomColorChange = (hexColor) => {
    setCustomColor(hexColor);
    localStorage.setItem('tj-custom-base', hexColor);
    setActivePreset('custom');
    applyThemePreset('custom');
  };

  // Resolve the active preset object for the live preview
  const resolvedPreview = (() => {
    const found = THEME_PRESETS.find(p => p.id === activePreset);
    if (found) return found;
    if (activePreset === 'custom') {
      const hex = customColor;
      const { h, s, l } = hexToHSL(hex);
      return {
        accent: hex,
        accentDark: hslToHex(h, s, Math.max(l - 10, 10)),
        bgBase: hslToHex(h, Math.min(s, 15), Math.max(l, 5)),
        bgSurface: hslToHex(h, Math.min(s, 15), Math.max(l, 5) + 4),
        profit: '#22C55E',
        loss: '#F43F5E',
        textPrimary: '#F2F5F9',
        textSecondary: '#8A93A6',
      };
    }
    // Fallback for dark/light
    return THEME_PRESETS[0];
  })();

  if (!settings) {
    return (
      <div>
        <div className="page-header"><h2>Settings</h2></div>
        <div className="card"><div className="skeleton skeleton-card" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
        <p>Configure appearance, trading rules, session windows, and API connections.</p>
      </div>

      {/* ══════════════ Profile / Account ══════════════ */}
      {currentUser && (
        <div style={{ marginBottom: '28px' }}>
          <ProfileSection user={currentUser} onLogout={onLogout} onUserUpdate={onUserUpdate} />
        </div>
      )}

      {/* ══════════════ MT5 Connector ══════════════ */}
      <ConnectorTokenSection />

      {/* ══════════════ Appearance ══════════════ */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="settings-section-title">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Appearance
        </div>

        {/* ── Section: Theme Preset ── */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontFamily: 'var(--mono)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-2)',
            marginBottom: '12px',
            fontWeight: 600,
          }}>
            THEME PRESET
          </label>

          <div className="theme-preset-grid">
            {THEME_PRESETS.map(preset => (
              <button
                key={preset.id}
                className={`theme-preset-card ${activePreset === preset.id ? 'active' : ''}`}
                onClick={() => handlePresetSelect(preset.id)}
                id={`preset-${preset.id}-btn`}
              >
                <div className="theme-preset-colors">
                  <span style={{ background: preset.bgBase }} />
                  <span style={{ background: preset.bgSurface }} />
                  <span style={{ background: preset.accent }} />
                  <span style={{ background: preset.profit }} />
                  <span style={{ background: preset.loss }} />
                </div>
                <span className="theme-preset-name">{preset.name}</span>
                <span className="theme-preset-desc">{preset.desc}</span>
              </button>
            ))}

            {/* Custom Card */}
            <button
              className={`theme-preset-card ${activePreset === 'custom' ? 'active' : ''}`}
              onClick={() => handlePresetSelect('custom')}
              id="preset-custom-btn"
            >
              <div className="theme-preset-colors">
                <span style={{ background: hslToHex(hexToHSL(customColor).h, Math.min(hexToHSL(customColor).s, 15), Math.max(hexToHSL(customColor).l, 5)) }} />
                <span style={{ background: hslToHex(hexToHSL(customColor).h, Math.min(hexToHSL(customColor).s, 15), Math.max(hexToHSL(customColor).l, 5) + 4) }} />
                <span style={{ background: customColor }} />
                <span style={{ background: '#22C55E' }} />
                <span style={{ background: '#F43F5E' }} />
              </div>
              <span className="theme-preset-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Custom
                <input
                  type="color"
                  value={customColor}
                  onChange={e => handleCustomColorChange(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '22px',
                    height: '22px',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: '50%',
                  }}
                  title="Pick Custom Base Color"
                  id="preset-custom-color-picker"
                />
              </span>
              <span className="theme-preset-desc">Build your own</span>
            </button>
          </div>
        </div>

        {/* ── Section: Live Preview ── */}
        <div style={{ marginBottom: '24px' }}>
          <div className="theme-live-preview" style={{
            background: resolvedPreview.bgSurface,
            border: `1px solid ${resolvedPreview.bgRaised || resolvedPreview.borderColor || 'var(--border)'}`,
            borderRadius: '10px',
            padding: '20px',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              marginBottom: '16px',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: resolvedPreview.textSecondary, marginBottom: '6px', fontFamily: 'var(--mono)' }}>Balance</div>
                <div style={{ fontSize: '20px', fontFamily: 'var(--mono)', fontWeight: 700, color: resolvedPreview.accent }}>$125,430</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: resolvedPreview.textSecondary, marginBottom: '6px', fontFamily: 'var(--mono)' }}>Today's P&L</div>
                <div style={{ fontSize: '20px', fontFamily: 'var(--mono)', fontWeight: 700, color: resolvedPreview.profit }}>+$2,847.50</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: resolvedPreview.textSecondary, marginBottom: '6px', fontFamily: 'var(--mono)' }}>Win Rate</div>
                <div style={{ fontSize: '20px', fontFamily: 'var(--mono)', fontWeight: 700, color: resolvedPreview.accent }}>68.5%</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: resolvedPreview.textSecondary, marginBottom: '6px', fontFamily: 'var(--mono)' }}>Drawdown</div>
                <div style={{ fontSize: '20px', fontFamily: 'var(--mono)', fontWeight: 700, color: resolvedPreview.loss }}>-1.2%</div>
              </div>
            </div>
            <button
              className="preview-cta"
              style={{
                width: '100%',
                padding: '10px 0',
                border: 'none',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${resolvedPreview.accent} 0%, ${resolvedPreview.accentDark || resolvedPreview.accent} 100%)`,
                color: resolvedPreview.bgBase,
                fontWeight: 700,
                fontSize: '13px',
                fontFamily: 'var(--mono)',
                letterSpacing: '0.04em',
                cursor: 'default',
                textTransform: 'uppercase',
              }}
              id="preview-cta-btn"
            >
              Execute Trade
            </button>
          </div>
        </div>

        {/* ── Section: Classic Dark / Light Toggle ── */}
        <div style={{ marginBottom: '22px' }}>
          <label className="form-label">Classic</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className={`appearance-chip ${(activePreset === 'dark' || (theme === 'dark' && !THEME_PRESETS.find(p => p.id === activePreset) && activePreset !== 'custom')) ? 'active' : ''}`}
              onClick={() => {
                handlePresetSelect('dark');
                if (theme !== 'dark') onToggleTheme();
              }}
              id="theme-dark-btn"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              Dark
            </button>
            <button
              className={`appearance-chip ${activePreset === 'light' ? 'active' : ''}`}
              onClick={() => {
                handlePresetSelect('light');
                if (theme !== 'light') onToggleTheme();
              }}
              id="theme-light-btn"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              </svg>
              Light
            </button>
          </div>
        </div>

        {/* ── Section: Contrast Slider ── */}
        <div className="accent-slider" style={{ marginBottom: '10px' }}>
           <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
             <span>Display Contrast / Boldness</span>
             <span style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{contrast}%</span>
           </label>
           <input
             type="range"
             min="80"
             max="150"
             value={contrast}
             onChange={e => setContrast(parseInt(e.target.value))}
             style={{ width: '100%', cursor: 'pointer' }}
             id="contrast-slider"
           />
           <p style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-2)' }}>Increase contrast if text appears too dim or washed out.</p>
        </div>
      </div>

      {/* ══════════════ Trade Settings ══════════════ */}
      
      {settings.lock_expiry && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          color: 'var(--text-0)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔒</span>
          <div>
            <h4 style={{ margin: '0 0 6px 0', color: '#F43F5E', fontSize: '0.95rem' }}>48-Hour Rule Locker Active</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-1)', lineHeight: 1.5 }}>
              You recently attempted to loosen your trading rules (e.g. increasing risk limits or max trades). 
              To protect you from emotional decision-making, these looser rules are pending and will unlock in <strong>{timeLeft}</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="content-grid">
        {/* Trade Limits */}
        <div className="card">
          <div className="settings-section-title">Trade Limits</div>
          <div className="form-group">
            <label className="form-label">Max Lot Size</label>
            <input type="number" step="0.01" className="form-input" value={settings.max_lot_size}
              onChange={e => handleChange('max_lot_size', parseFloat(e.target.value) || 0)} id="setting-max-lot" />
          </div>
        </div>

        {/* Risk Limits */}
        <div className="card">
          <div className="settings-section-title">Risk Limits</div>
          <div className="form-group">
            <label className="form-label">Max Daily Loss (%)</label>
            <input type="number" step="0.5" className="form-input" value={settings.max_daily_loss_pct}
              onChange={e => handleChange('max_daily_loss_pct', parseFloat(e.target.value) || 0)} id="setting-max-daily-loss" />
          </div>
          <div className="form-group">
            <label className="form-label">Max Session Loss (%)</label>
            <input type="number" step="0.5" className="form-input" value={settings.max_session_loss_pct}
              onChange={e => handleChange('max_session_loss_pct', parseFloat(e.target.value) || 0)} id="setting-max-session-loss" />
          </div>
        </div>

        {/* Session Windows */}
        <div className="card content-grid-full">
          <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Trading Sessions</span>
            <button className="btn-secondary" onClick={handleAddSession} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>+ Add Session</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {Object.entries(settings.sessions || {}).map(([name, session]) => (
              <div key={name} className={`session-card ${session.enabled ? 'enabled' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <input 
                    key={name}
                    type="text" 
                    defaultValue={name} 
                    onBlur={(e) => handleRenameSession(name, e.target.value.trim().toLowerCase().replace(/\s+/g, '_'))}
                    placeholder="session name"
                    style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-0)', background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', width: '130px', outline: 'none' }} 
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={session.enabled} onChange={e => handleSessionChange(name, 'enabled', e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                    <button className="btn-secondary" onClick={() => handleDeleteSession(name)} style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(244, 63, 94, 0.1)', color: '#F43F5E', border: 'none' }}>Remove</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="time" className="form-input" style={{ flex: 1 }} value={session.start} onChange={e => handleSessionChange(name, 'start', e.target.value)} />
                  <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>→</span>
                  <input type="time" className="form-input" style={{ flex: 1 }} value={session.end} onChange={e => handleSessionChange(name, 'end', e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.8rem' }}>Max Trades:</label>
                  <input type="number" min="0" step="1" className="form-input" style={{ width: '60px', padding: '4px 8px' }} value={session.max_trades ?? 1} onChange={e => handleSessionChange(name, 'max_trades', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating / Bonus Trades */}
        <div className="card content-grid-full">
          <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Floating / Bonus Trades</span>
            <button className="btn-secondary" onClick={handleAddBonusRule} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>+ Add Rule</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(settings.bonus_rules || []).length === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>No floating trade rules configured.</p>
            ) : (settings.bonus_rules || []).map((rule, idx) => (
              <div key={rule.id} className="session-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--cyan)' }}>✦ Bonus Rule {idx + 1}</span>
                  <button className="btn-secondary" onClick={() => handleDeleteBonusRule(rule.id)} style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(244, 63, 94, 0.1)', color: '#F43F5E', border: 'none' }}>Remove</button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-2)' }}>If my last</span>
                  <input type="number" min="1" step="1" className="form-input" style={{ width: '52px', padding: '4px 6px', textAlign: 'center' }} 
                    value={rule.conditions?.[0]?.lookback_trades ?? 1} 
                    onChange={e => handleUpdateBonusCondition(rule.id, 'lookback_trades', parseInt(e.target.value) || 1)} />
                  <span style={{ color: 'var(--text-2)' }}>trades in</span>
                  <select className="form-input" style={{ width: '120px', padding: '4px 6px', textTransform: 'capitalize' }} 
                    value={rule.conditions?.[0]?.source_session ?? 'all'}
                    onChange={e => handleUpdateBonusCondition(rule.id, 'source_session', e.target.value)}>
                    <option value="all">Any Session</option>
                    {Object.keys(settings.sessions || {}).map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
                  </select>
                  <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>are profitable →</span>
                  <span style={{ color: 'var(--text-2)' }}>add</span>
                  <input type="number" min="1" step="1" className="form-input" style={{ width: '52px', padding: '4px 6px', textAlign: 'center' }} 
                    value={rule.bonus_trades ?? 1} 
                    onChange={e => handleUpdateBonusRule(rule.id, 'bonus_trades', parseInt(e.target.value) || 1)} />
                  <span style={{ color: 'var(--text-2)' }}>extra trade(s) to</span>
                  <select className="form-input" style={{ width: '120px', padding: '4px 6px', textTransform: 'capitalize' }} 
                    value={rule.target_session ?? ''}
                    onChange={e => handleUpdateBonusRule(rule.id, 'target_session', e.target.value)}>
                    {Object.keys(settings.sessions || {}).map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Window */}
        <div className="card">
          <div className="settings-section-title">Trading Window</div>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.allowed_trading_window?.enabled || false}
                  onChange={e => setSettings(prev => ({ ...prev, allowed_trading_window: { ...prev.allowed_trading_window, enabled: e.target.checked } }))} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-1)' }}>Enable time restriction</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="time" className="form-input" value={settings.allowed_trading_window?.start || '08:00'}
              onChange={e => setSettings(prev => ({ ...prev, allowed_trading_window: { ...prev.allowed_trading_window, start: e.target.value } }))} />
            <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>→</span>
            <input type="time" className="form-input" value={settings.allowed_trading_window?.end || '23:30'}
              onChange={e => setSettings(prev => ({ ...prev, allowed_trading_window: { ...prev.allowed_trading_window, end: e.target.value } }))} />
          </div>
        </div>

        {/* Localization */}
        <div className="card">
          <div className="settings-section-title">Localization</div>
          <div className="form-group">
            <label className="form-label">Timezone</label>
            <select
              className="form-input"
              value={settings.timezone || 'Asia/Kolkata'}
              onChange={e => handleChange('timezone', e.target.value)}
              style={{ width: '100%', cursor: 'pointer', background: 'var(--bg-2)', color: 'var(--text-0)' }}
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        {/* API Config */}
        <div className="card">
          <div className="settings-section-title">API Configuration</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
            The API key for Z.ai (GLM 5.2) is configured via{' '}
            <code style={{ color: 'var(--cyan)', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>backend/.env</code>
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '8px', lineHeight: 1.7 }}>
            Set{' '}
            <code style={{ color: 'var(--cyan)', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>ZAI_API_KEY=your-key</code>
            {' '}and{' '}
            <code style={{ color: 'var(--cyan)', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>NVIDIA_API_KEY=nvapi-...</code>
            {' '}and restart the backend.
          </p>
        </div>
      </div>

      <div style={{ marginTop: '8px', display: 'flex', gap: '14px', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-settings-btn">
          {saving ? (
            <><span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving...</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              Save Settings
            </>
          )}
        </button>
        {saved && <span style={{ color: 'var(--green)', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--mono)' }}>✓ Settings saved</span>}
      </div>
    </div>
  );
}
