import { useState, useEffect } from 'react';
import { api } from '../api';

/* ════════════════════════════════════════════════
   Background Presets
   ════════════════════════════════════════════════ */

const BG_PRESETS = [
  {
    id: 'solid',
    label: 'Solid',
    desc: 'Clean flat background',
  },
  {
    id: 'mesh',
    label: 'Gradient Mesh',
    desc: 'Ambient color wash',
  },
  {
    id: 'dots',
    label: 'Dot Grid',
    desc: 'Subtle dot pattern',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    desc: 'Northern-lights glow',
  },
];

function getBgCSS(id) {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  switch (id) {
    case 'mesh':
      return {
        image: isDark
          ? `radial-gradient(ellipse at 20% 50%, rgba(34,211,238,0.12) 0%, transparent 50%),
             radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.10) 0%, transparent 50%),
             radial-gradient(ellipse at 60% 80%, rgba(168,85,247,0.08) 0%, transparent 50%)`
          : `radial-gradient(ellipse at 20% 50%, rgba(8,145,178,0.08) 0%, transparent 50%),
             radial-gradient(ellipse at 80% 20%, rgba(37,99,235,0.06) 0%, transparent 50%),
             radial-gradient(ellipse at 60% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)`,
        size: '100% 100%, 100% 100%, 100% 100%',
      };
    case 'dots':
      return {
        image: isDark
          ? `radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)`
          : `radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)`,
        size: '24px 24px',
      };
    case 'aurora':
      return {
        image: `radial-gradient(ellipse at 10% 80%, rgba(34,211,238,0.14) 0%, transparent 40%),
             radial-gradient(ellipse at 50% 10%, rgba(168,85,247,0.14) 0%, transparent 40%),
             radial-gradient(ellipse at 90% 70%, rgba(59,130,246,0.14) 0%, transparent 40%),
             radial-gradient(ellipse at 40% 50%, rgba(16,185,129,0.08) 0%, transparent 50%)`,
        size: '100% 100%, 100% 100%, 100% 100%, 100% 100%',
      };
    case 'solid':
    default:
      return { image: 'none', size: 'auto', color: '' };
  }
}

export function applyBgPreset(id, theme) {
  const bg = getBgCSS(id, theme);
  document.body.style.backgroundImage = bg.image;
  document.body.style.backgroundSize = bg.size;
  document.body.style.backgroundColor = bg.color || '';
  document.body.style.backgroundAttachment = 'fixed';
  localStorage.setItem('tj-bg', id);
};

/* ════════════════════════════════════════════════
   Accent Color Presets
   ════════════════════════════════════════════════ */

const ACCENT_PRESETS = [
  { id: 'cyan',    label: 'Cyan',    color: '#22d3ee', dark: '#06b6d4' },
  { id: 'blue',    label: 'Blue',    color: '#3b82f6', dark: '#2563eb' },
  { id: 'violet',  label: 'Violet',  color: '#8b5cf6', dark: '#7c3aed' },
  { id: 'emerald', label: 'Emerald', color: '#10b981', dark: '#059669' },
  { id: 'rose',    label: 'Rose',    color: '#f43f5e', dark: '#e11d48' },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function applyAccentPreset(idOrHex) {
  let color = idOrHex;
  let dark = idOrHex;
  const preset = ACCENT_PRESETS.find(p => p.id === idOrHex);
  if (preset) {
    color = preset.color;
    dark = preset.dark;
    localStorage.setItem('tj-accent', preset.id);
  } else if (idOrHex && idOrHex.startsWith('#')) {
    localStorage.setItem('tj-accent', idOrHex);
  } else {
    return;
  }
  const el = document.documentElement;
  const rgb = hexToRgb(color);
  el.style.setProperty('--cyan', color);
  el.style.setProperty('--cyan-dark', dark);
  el.style.setProperty('--cyan-dim', `rgba(${rgb}, 0.06)`);
  el.style.setProperty('--cyan-dim2', `rgba(${rgb}, 0.09)`);
  el.style.setProperty('--cyan-border', `rgba(${rgb}, 0.14)`);
  el.style.setProperty('--cyan-glow', `0 0 16px rgba(${rgb}, 0.2), 0 0 32px rgba(${rgb}, 0.06)`);
  el.style.setProperty('--cyan-glow-sm', `0 0 8px rgba(${rgb}, 0.18)`);
  el.style.setProperty('--gradient-accent', `linear-gradient(135deg, ${color} 0%, ${dark} 100%)`);
  el.style.setProperty('--gradient-accent-hover', `linear-gradient(135deg, ${dark} 0%, ${dark} 100%)`);
  el.style.setProperty('--gradient-brand', `linear-gradient(135deg, ${color}, ${dark})`);
}

/* ════════════════════════════════════════════════
   Text Color Presets
   ════════════════════════════════════════════════ */

const TEXT_PRESETS_DARK = [
  { id: 'default',  label: 'Default',       text0: '#f4f4f5', text1: '#a1a1aa', text2: '#71717a' },
  { id: 'bright',   label: 'High Contrast', text0: '#ffffff', text1: '#d4d4d8', text2: '#a1a1aa' },
  { id: 'warm',     label: 'Warm',          text0: '#fef3c7', text1: '#d4a574', text2: '#92704a' },
  { id: 'cool',     label: 'Cool',          text0: '#e0f2fe', text1: '#93c5fd', text2: '#60a5fa' },
];

const TEXT_PRESETS_LIGHT = [
  { id: 'default',  label: 'Default',       text0: '#09090b', text1: '#3f3f46', text2: '#71717a' },
  { id: 'bright',   label: 'High Contrast', text0: '#000000', text1: '#18181b', text2: '#3f3f46' },
  { id: 'warm',     label: 'Warm',          text0: '#451a03', text1: '#78350f', text2: '#92400e' },
  { id: 'cool',     label: 'Cool',          text0: '#0c4a6e', text1: '#075985', text2: '#0369a1' },
];

export function applyTextPreset(idOrHex, theme) {
  const presets = theme === 'light' ? TEXT_PRESETS_LIGHT : TEXT_PRESETS_DARK;
  let text0 = idOrHex;
  let text1 = idOrHex;
  let text2 = idOrHex;

  const preset = presets.find(p => p.id === idOrHex);
  if (preset) {
    text0 = preset.text0;
    text1 = preset.text1;
    text2 = preset.text2;
    localStorage.setItem('tj-text', preset.id);
  } else if (idOrHex && idOrHex.startsWith('#')) {
    localStorage.setItem('tj-text', idOrHex);
  } else {
    const defaultPreset = presets[0];
    text0 = defaultPreset.text0;
    text1 = defaultPreset.text1;
    text2 = defaultPreset.text2;
    localStorage.setItem('tj-text', 'default');
  }

  const el = document.documentElement;
  el.style.setProperty('--text-0', text0);
  el.style.setProperty('--text-1', text1);
  el.style.setProperty('--text-2', text2);
}

/* ════════════════════════════════════════════════
   Settings Page Component
   ════════════════════════════════════════════════ */

export function SettingsPage({ theme, onToggleTheme }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bgPreset, setBgPreset] = useState(() => localStorage.getItem('tj-bg') || 'solid');
  const [accentPreset, setAccentPreset] = useState(() => localStorage.getItem('tj-accent') || 'cyan');
  const [textPreset, setTextPreset] = useState(() => localStorage.getItem('tj-text') || 'default');
  const [contrast, setContrast] = useState(() => parseInt(localStorage.getItem('tj-contrast') || '100', 10));

  useEffect(() => {
    applyBgPreset(bgPreset, theme);
    applyAccentPreset(accentPreset);
    applyTextPreset(textPreset, theme);
  }, []);

  useEffect(() => {
    document.documentElement.style.filter = `contrast(${contrast}%) brightness(${contrast === 100 ? 100 : contrast - 10}%)`;
    localStorage.setItem('tj-contrast', contrast);
  }, [contrast]);

  // Re-apply presets when theme changes
  useEffect(() => {
    applyBgPreset(bgPreset, theme);
    applyTextPreset(textPreset, theme);
  }, [theme]);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      setSaved(true);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBgChange = (id) => {
    setBgPreset(id);
    applyBgPreset(id, theme);
  };

  const handleAccentChange = (id) => {
    setAccentPreset(id);
    applyAccentPreset(id);
  };

  const handleTextChange = (id) => {
    setTextPreset(id);
    applyTextPreset(id, theme);
  };

  const textPresets = theme === 'light' ? TEXT_PRESETS_LIGHT : TEXT_PRESETS_DARK;

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

      {/* ══════════════ Appearance ══════════════ */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="settings-section-title">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Appearance
        </div>

        {/* Theme Toggle */}
        <div style={{ marginBottom: '22px' }}>
          <label className="form-label">Theme</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className={`appearance-chip ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => theme !== 'dark' && onToggleTheme()}
              id="theme-dark-btn"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              Dark
            </button>
            <button
              className={`appearance-chip ${theme === 'light' ? 'active' : ''}`}
              onClick={() => theme !== 'light' && onToggleTheme()}
              id="theme-light-btn"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              </svg>
              Light
            </button>
          </div>
        </div>

        {/* Background Style */}
        <div style={{ marginBottom: '22px' }}>
          <label className="form-label">Background Style & Color</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
            {BG_PRESETS.map(preset => (
              <button
                key={preset.id}
                className={`appearance-chip appearance-chip-lg ${bgPreset === preset.id ? 'active' : ''}`}
                onClick={() => handleBgChange(preset.id)}
                id={`bg-${preset.id}-btn`}
              >
                <span className="appearance-chip-title">{preset.label}</span>
                <span className="appearance-chip-desc">{preset.desc}</span>
              </button>
            ))}
            <div className="appearance-chip appearance-chip-lg" style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px', alignItems: 'center' }}>
              <span className="appearance-chip-title">Custom Base</span>
              <input type="color" value={bgPreset.startsWith('#') ? bgPreset : '#000000'} onChange={e => handleBgChange(e.target.value)} style={{ width: '40px', height: '24px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Pick Custom Background Color" />
            </div>
          </div>
        </div>

        {/* Accent Color */}
        <div style={{ marginBottom: '22px' }}>
          <label className="form-label">Accent Color</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {ACCENT_PRESETS.map(preset => (
              <button
                key={preset.id}
                className={`accent-chip ${accentPreset === preset.id ? 'active' : ''}`}
                onClick={() => handleAccentChange(preset.id)}
                title={preset.label}
                id={`accent-${preset.id}-btn`}
              >
                <span className="accent-swatch" style={{ background: preset.color }} />
                <span>{preset.label}</span>
              </button>
            ))}
            <div className={`accent-chip ${accentPreset.startsWith('#') ? 'active' : ''}`} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="color" value={accentPreset.startsWith('#') ? accentPreset : '#22d3ee'} onChange={e => handleAccentChange(e.target.value)} style={{ width: '20px', height: '20px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '50%' }} title="Pick Custom Accent Color" />
              <span>Custom</span>
            </div>
          </div>
        </div>

        {/* Text Colors */}
        <div style={{ marginBottom: '22px' }}>
          <label className="form-label">Text Style</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
            {textPresets.map(preset => (
              <button
                key={preset.id}
                className={`appearance-chip appearance-chip-lg ${textPreset === preset.id ? 'active' : ''}`}
                onClick={() => handleTextChange(preset.id)}
                id={`text-${preset.id}-btn`}
              >
                <span className="appearance-chip-title">{preset.label}</span>
                <span className="text-preview-row">
                  <span className="text-preview-dot" style={{ background: preset.text0 }} title="Headers" />
                  <span className="text-preview-dot" style={{ background: preset.text1 }} title="Body" />
                  <span className="text-preview-dot" style={{ background: preset.text2 }} title="Muted" />
                </span>
              </button>
            ))}
            <div className={`appearance-chip appearance-chip-lg ${textPreset.startsWith('#') ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px', alignItems: 'center' }}>
              <span className="appearance-chip-title">Custom Text</span>
              <input type="color" value={textPreset.startsWith('#') ? textPreset : (theme === 'light' ? '#000000' : '#ffffff')} onChange={e => handleTextChange(e.target.value)} style={{ width: '40px', height: '24px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Pick Custom Text Color" />
            </div>
          </div>
        </div>

        {/* Contrast / Brightness Adjuster */}
        <div style={{ marginBottom: '10px' }}>
           <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
             <span>Display Contrast / Boldness</span>
             <span style={{ color: 'var(--text-2)' }}>{contrast}%</span>
           </label>
           <input type="range" min="80" max="150" value={contrast} onChange={e => setContrast(parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
           <p style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-2)' }}>Increase contrast if text appears too dim or washed out.</p>
        </div>
      </div>

      {/* ══════════════ Trade Settings ══════════════ */}
      <div className="content-grid">
        {/* Trade Limits */}
        <div className="card">
          <div className="settings-section-title">Trade Limits</div>
          <div className="form-group">
            <label className="form-label">Max Trades / Day</label>
            <input type="number" className="form-input" value={settings.max_trades_per_day}
              onChange={e => handleChange('max_trades_per_day', parseInt(e.target.value) || 0)} id="setting-max-trades-day" />
          </div>
          <div className="form-group">
            <label className="form-label">Max Trades / Session</label>
            <input type="number" className="form-input" value={settings.max_trades_per_session}
              onChange={e => handleChange('max_trades_per_session', parseInt(e.target.value) || 0)} id="setting-max-trades-session" />
          </div>
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
          <div className="settings-section-title">Trading Sessions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {Object.entries(settings.sessions || {}).map(([name, session]) => (
              <div key={name} className={`session-card ${session.enabled ? 'enabled' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.88rem', color: 'var(--text-0)' }}>{name}</span>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={session.enabled} onChange={e => handleSessionChange(name, 'enabled', e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="time" className="form-input" style={{ flex: 1 }} value={session.start} onChange={e => handleSessionChange(name, 'start', e.target.value)} />
                  <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>→</span>
                  <input type="time" className="form-input" style={{ flex: 1 }} value={session.end} onChange={e => handleSessionChange(name, 'end', e.target.value)} />
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

        {/* API Config */}
        <div className="card">
          <div className="settings-section-title">API Configuration</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
            The NVIDIA NIM API key for Kimi 2.5 is configured via{' '}
            <code style={{ color: 'var(--cyan)', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>backend/.env</code>
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '8px', lineHeight: 1.7 }}>
            Set{' '}
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
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
