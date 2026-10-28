import { useState, useEffect } from 'react';
import { api } from '../api';
import { ProfileSection } from './ProfileSection';

/* ════════════════════════════════════════════════
   Theme Presets & Utilities (from utils/theme)
   ════════════════════════════════════════════════ */
import {
  THEME_PRESETS,
  hexToHSL,
  hslToHex,
  hexToRgb,
  applyThemePreset,
} from '../utils/theme';

export {
  THEME_PRESETS,
  hexToHSL,
  hslToHex,
  hexToRgb,
  applyThemePreset,
};

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

  const [downloading, setDownloading] = useState(false);

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

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await api.downloadConnector(token);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback direct download link
      const fallbackUrl = `/api/sync/connector.zip?token=${encodeURIComponent(token || '')}`;
      window.location.href = fallbackUrl;
    } finally {
      setDownloading(false);
    }
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
        <button 
          onClick={handleDownload} 
          disabled={downloading}
          className="btn btn-secondary"
          style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <span>📥</span> {downloading ? 'Downloading...' : 'Download Connector (.zip)'}
        </button>
        <span style={{ color: 'var(--text-2)', fontSize: '0.72rem', fontFamily: 'var(--mono)', width: '100%', marginTop: '4px' }}>
          {hasToken ? 'Regenerating will invalidate the old token.' : 'Generate a token to connect your local MT5 agent.'}
        </span>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════
   AI & Vision Configuration (AgentRouter / OpenRouter)
   ════════════════════════════════════════════════ */
function AiConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [config, setConfig] = useState(null);

  // Form fields
  const [provider, setProvider] = useState('agentrouter');
  const [agentKey, setAgentKey] = useState('');
  const [agentUrl, setAgentUrl] = useState('https://co.agentrouter.org/v1');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [visionModel, setVisionModel] = useState('gpt-4o-mini');
  const [statusMsg, setStatusMsg] = useState('');

  const loadConfig = () => {
    api.getAiConfig()
      .then(d => {
        setConfig(d);
        if (d.ai_provider) setProvider(d.ai_provider);
        else if (d.agentrouter?.configured) setProvider('agentrouter');
        else if (d.openrouter?.configured) setProvider('openrouter');

        if (d.agentrouter?.base_url) setAgentUrl(d.agentrouter.base_url);
        if (d.ai_model) setAiModel(d.ai_model);
        if (d.vision_model) setVisionModel(d.vision_model);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    try {
      const payload = {
        ai_provider: provider === 'auto' ? '' : provider,
        vision_provider: provider === 'auto' ? '' : provider,
        ai_model: aiModel.trim(),
        vision_model: visionModel.trim(),
      };
      if (agentKey.trim()) payload.agentrouter_api_key = agentKey.trim();
      if (agentUrl.trim()) payload.agentrouter_base_url = agentUrl.trim();
      if (openrouterKey.trim()) payload.openrouter_api_key = openrouterKey.trim();

      const res = await api.saveAiConfig(payload);
      setSaved(true);
      setStatusMsg(res.message || 'AI configuration updated successfully');
      setAgentKey('');
      setOpenrouterKey('');
      loadConfig();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setStatusMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeStatus = config?.active_status;
  const isAnalyzerActive = activeStatus?.analyzer?.available;
  const isVisionActive = activeStatus?.vision?.available;

  return (
    <div className="card" style={{ marginBottom: '28px' }}>
      <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2a10 10 0 1 0 10 10" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
          </svg>
          <span>AI & Vision Engine (AgentRouter)</span>
        </div>

        {/* Live status indicators */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '0.72rem', fontFamily: 'var(--mono)',
            padding: '4px 10px', borderRadius: '100px',
            background: isAnalyzerActive ? 'rgba(1,255,166,0.1)' : 'rgba(244,63,94,0.1)',
            border: `1px solid ${isAnalyzerActive ? 'rgba(1,255,166,0.3)' : 'rgba(244,63,94,0.3)'}`,
            color: isAnalyzerActive ? '#01FFA6' : '#F43F5E',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isAnalyzerActive ? '#01FFA6' : '#F43F5E' }} />
            AI Coach: {isAnalyzerActive ? `${activeStatus.analyzer.provider}/${activeStatus.analyzer.model}` : 'Offline'}
          </span>

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '0.72rem', fontFamily: 'var(--mono)',
            padding: '4px 10px', borderRadius: '100px',
            background: isVisionActive ? 'rgba(1,255,166,0.1)' : 'rgba(244,63,94,0.1)',
            border: `1px solid ${isVisionActive ? 'rgba(1,255,166,0.3)' : 'rgba(244,63,94,0.3)'}`,
            color: isVisionActive ? '#01FFA6' : '#F43F5E',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isVisionActive ? '#01FFA6' : '#F43F5E' }} />
            Vision AI: {isVisionActive ? `${activeStatus.vision.vision_provider}/${activeStatus.vision.vision_model}` : 'Offline'}
          </span>
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6, margin: '8px 0 18px 0' }}>
        Configure your AI engine provider and vision models for psychological coaching and automated chart analysis.
      </p>

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          {/* Provider Selection */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Provider Gateway</label>
            <select
              className="form-input"
              value={provider}
              onChange={e => setProvider(e.target.value)}
              style={{ width: '100%', cursor: 'pointer', background: 'var(--bg-2)', color: 'var(--text-0)' }}
            >
              <option value="agentrouter">AgentRouter (agentrouter.org / co.agentrouter.org) — Recommended</option>
              <option value="openrouter">OpenRouter (openrouter.ai)</option>
              <option value="openai">Direct OpenAI (api.openai.com)</option>
              <option value="gemini">Google Gemini (generativelanguage.googleapis.com)</option>
              <option value="auto">Auto-detect from configured keys</option>
            </select>
          </div>

          {/* Base URL */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Base URL (API Endpoint)</label>
            <input
              type="text"
              className="form-input"
              value={agentUrl}
              onChange={e => setAgentUrl(e.target.value)}
              placeholder="https://co.agentrouter.org/v1"
              style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {/* API Key */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>
              {provider === 'openrouter' ? 'OpenRouter API Key' : 'AgentRouter API Key'}
              {config?.agentrouter?.configured && (
                <span style={{ color: 'var(--green)', marginLeft: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
                  ✓ Key Configured ({config.agentrouter.masked_key})
                </span>
              )}
            </label>
            {config?.agentrouter?.configured && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                Leave empty to keep existing key
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type={showKey ? 'text' : 'password'}
              className="form-input"
              value={provider === 'openrouter' ? openrouterKey : agentKey}
              onChange={e => provider === 'openrouter' ? setOpenrouterKey(e.target.value) : setAgentKey(e.target.value)}
              placeholder={config?.agentrouter?.configured ? '••••••••••••••••••••••••••••••••' : 'Enter your API key here (sk-...)'}
              style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: '0.85rem' }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowKey(!showKey)}
              style={{ padding: '8px 12px', fontSize: '0.8rem' }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Model Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          {/* AI Coach Model */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ marginBottom: '6px' }}>AI Trading Coach Model (AXIOM)</label>
            <select
              className="form-input"
              value={['deepseek-v4-flash', 'gemini astra', 'claude-3-5-sonnet', 'gpt-4o', 'claude-opus-5-5'].includes(aiModel) ? aiModel : 'custom'}
              onChange={e => {
                if (e.target.value !== 'custom') {
                  setAiModel(e.target.value);
                } else {
                  setAiModel('');
                }
              }}
              style={{ width: '100%', cursor: 'pointer', background: 'var(--bg-2)', color: 'var(--text-0)', marginBottom: '8px' }}
            >
              <option value="deepseek-v4-flash">DeepSeek V4 Flash (Fast & Verified)</option>
              <option value="gemini astra">GPT-6 Astra (Deep Reasoning)</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="claude-opus-5-5">Claude Opus 5.5</option>
              <option value="custom">Custom Model ID...</option>
            </select>
            {!['deepseek-v4-flash', 'gemini astra', 'claude-3-5-sonnet', 'gpt-4o', 'claude-opus-5-5'].includes(aiModel) && (
              <input
                type="text"
                className="form-input"
                value={aiModel}
                onChange={e => setAiModel(e.target.value)}
                placeholder="Enter custom model identifier (e.g. gpt-4o-mini)"
                style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}
              />
            )}
          </div>

          {/* Vision Model */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ marginBottom: '6px' }}>Chart Vision Model (SMC Analysis)</label>
            <select
              className="form-input"
              value={['deepseek-v4-flash', 'gpt-4o', 'claude-3-5-sonnet', 'claude-opus-5-5'].includes(visionModel) ? visionModel : 'custom'}
              onChange={e => {
                if (e.target.value !== 'custom') {
                  setVisionModel(e.target.value);
                } else {
                  setVisionModel('');
                }
              }}
              style={{ width: '100%', cursor: 'pointer', background: 'var(--bg-2)', color: 'var(--text-0)', marginBottom: '8px' }}
            >
              <option value="deepseek-v4-flash">DeepSeek V4 Flash Vision (Recommended)</option>
              <option value="gpt-4o">GPT-4o Vision</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet Vision</option>
              <option value="claude-opus-5-5">Claude Opus 5.5 Vision</option>
              <option value="custom">Custom Model ID...</option>
            </select>
            {!['deepseek-v4-flash', 'gpt-4o', 'claude-3-5-sonnet', 'claude-opus-5-5'].includes(visionModel) && (
              <input
                type="text"
                className="form-input"
                value={visionModel}
                onChange={e => setVisionModel(e.target.value)}
                placeholder="Enter custom vision model identifier"
                style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}
              />
            )}
          </div>
        </div>

        {/* Action button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: '0.82rem' }}>
            {saving ? 'Saving & Connecting...' : 'Save AI Configuration'}
          </button>
          {saved && (
            <span style={{ color: '#01FFA6', fontSize: '0.8rem', fontFamily: 'var(--mono)', fontWeight: 600 }}>
              ✓ Configuration Saved & Active
            </span>
          )}
          {statusMsg && !saved && (
            <span style={{ color: statusMsg.startsWith('Error') ? '#F43F5E' : 'var(--text-2)', fontSize: '0.8rem', fontFamily: 'var(--mono)' }}>
              {statusMsg}
            </span>
          )}
        </div>
      </form>
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

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('tj-settings-tab') || 'rules');

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('tj-settings-tab', tabId);
  };

  if (!settings) {
    return (
      <div>
        <div className="page-header"><h2>Platform Settings</h2></div>
        <div className="card"><div className="skeleton skeleton-card" /></div>
      </div>
    );
  }

  const tabs = [
    { id: 'rules', label: 'Risk & Trade Rules', icon: '🛡️', desc: 'Risk guardrails & limits' },
    { id: 'ai', label: 'AI Intelligence', icon: '🤖', desc: 'AgentRouter & AI coaches' },
    { id: 'connector', label: 'MT5 Connector', icon: '⚡', desc: 'Sync agent & token' },
    { id: 'appearance', label: 'Appearance', icon: '🎨', desc: 'Themes & display' },
    ...(currentUser ? [{ id: 'account', label: 'Account & Security', icon: '👤', desc: 'Credentials & 2FA' }] : []),
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Platform Settings</h2>
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.85rem' }}>
              Configure your prop-firm risk guardrails, AI coaching engines, MT5 local sync, and workspace theme.
            </p>
          </div>
        </div>
      </div>

      {/* ── Enterprise Tabbed Navigation ── */}
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '6px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        marginBottom: '24px',
        overflowX: 'auto',
      }}>
        {tabs.map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              id={`settings-tab-${t.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                background: isActive ? 'rgba(1, 255, 166, 0.08)' : 'transparent',
                color: isActive ? 'var(--text-0)' : 'var(--text-2)',
                fontSize: '0.82rem',
                fontFamily: 'var(--mono)',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{t.icon}</span>
              <span>{t.label}</span>
              {isActive && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginLeft: '2px' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════ TAB 1: Risk & Trade Rules ══════════════ */}
      {activeTab === 'rules' && (
        <div>
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
                  You recently attempted to loosen your trading rules. To protect you from emotional decision-making, these looser rules are pending and will unlock in <strong>{timeLeft}</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="content-grid" style={{ marginBottom: '24px' }}>
            {/* Trade Limits */}
            <div className="card">
              <div className="settings-section-title">Trade Execution Sizing</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                Maximum lot size allowed per order. Any order placed above this size will trigger an instant rule violation.
              </p>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Max Lot Size per Order</label>
                <input type="number" step="0.01" className="form-input" value={settings.max_lot_size}
                  onChange={e => handleChange('max_lot_size', parseFloat(e.target.value) || 0)} id="setting-max-lot" />
              </div>
            </div>

            {/* Risk Limits */}
            <div className="card">
              <div className="settings-section-title">Risk & Drawdown Guardrails</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                Daily and session drawdown caps. MT5 force-close activates the moment these limits are touched.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Daily Loss (%)</label>
                  <input type="number" step="0.5" className="form-input" value={settings.max_daily_loss_pct}
                    onChange={e => handleChange('max_daily_loss_pct', parseFloat(e.target.value) || 0)} id="setting-max-daily-loss" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Session Loss (%)</label>
                  <input type="number" step="0.5" className="form-input" value={settings.max_session_loss_pct}
                    onChange={e => handleChange('max_session_loss_pct', parseFloat(e.target.value) || 0)} id="setting-max-session-loss" />
                </div>
              </div>
            </div>

            {/* Session Windows */}
            <div className="card content-grid-full">
              <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span>Algorithmic Trading Sessions</span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: '4px 0 0 0', fontWeight: 400 }}>
                    Define session trading windows and enforce strict trade counts per market phase.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={handleAddSession} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>+ Add Session</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '16px' }}>
                {Object.entries(settings.sessions || {}).map(([name, session]) => (
                  <div key={name} className={`session-card ${session.enabled ? 'enabled' : ''}`} style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
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
                        <button className="btn-secondary" onClick={() => handleDeleteSession(name)} style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(244, 63, 94, 0.1)', color: '#F43F5E', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                      <input type="time" className="form-input" style={{ flex: 1 }} value={session.start} onChange={e => handleSessionChange(name, 'start', e.target.value)} />
                      <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>→</span>
                      <input type="time" className="form-input" style={{ flex: 1 }} value={session.end} onChange={e => handleSessionChange(name, 'end', e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="form-label" style={{ margin: 0, fontSize: '0.8rem' }}>Allowed Trades:</label>
                      <input type="number" min="0" step="1" className="form-input" style={{ width: '64px', padding: '4px 8px', textAlign: 'center' }} value={session.max_trades ?? 1} onChange={e => handleSessionChange(name, 'max_trades', parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating / Bonus Trades */}
            <div className="card content-grid-full">
              <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span>Performance Incentive Rules (Bonus Trades)</span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: '4px 0 0 0', fontWeight: 400 }}>
                    Earn additional trades in later sessions when demonstrating disciplined, profitable execution.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={handleAddBonusRule} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>+ Add Bonus Rule</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {(settings.bonus_rules || []).length === 0 ? (
                  <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', margin: 0, fontStyle: 'italic', padding: '12px 0' }}>No floating trade rules configured. Click "+ Add Bonus Rule" to create one.</p>
                ) : (settings.bonus_rules || []).map((rule, idx) => (
                  <div key={rule.id} className="session-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)' }}>✦ Bonus Rule #{idx + 1}</span>
                      <button className="btn-secondary" onClick={() => handleDeleteBonusRule(rule.id)} style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(244, 63, 94, 0.1)', color: '#F43F5E', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.82rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '10px 14px', borderRadius: '6px' }}>
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
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>are profitable →</span>
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
              <div className="settings-section-title">Hard Operating Window</div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={settings.allowed_trading_window?.enabled || false}
                      onChange={e => setSettings(prev => ({ ...prev, allowed_trading_window: { ...prev.allowed_trading_window, enabled: e.target.checked } }))} />
                    <span className="toggle-slider" />
                  </label>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-1)' }}>Enforce daily cutoff window</span>
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
              <div className="settings-section-title">Market Localization</div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Account Timezone</label>
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
          </div>

          {/* Action Bar for Rules */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            marginTop: '8px'
          }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-settings-btn" style={{ padding: '9px 20px', fontSize: '0.85rem' }}>
              {saving ? (
                <><span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving Changes...</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Save Rule Changes
                </>
              )}
            </button>
            {saved && <span style={{ color: 'var(--green)', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--mono)' }}>✓ All rule updates saved and active</span>}
          </div>
        </div>
      )}

      {/* ══════════════ TAB 2: AI Intelligence ══════════════ */}
      {activeTab === 'ai' && (
        <div>
          <AiConfigSection />
        </div>
      )}

      {/* ══════════════ TAB 3: MT5 Connector ══════════════ */}
      {activeTab === 'connector' && (
        <div>
          <ConnectorTokenSection />
        </div>
      )}

      {/* ══════════════ TAB 4: Appearance (Clean Company Design) ══════════════ */}
      {activeTab === 'appearance' && (
        <div className="card">
          <div className="settings-section-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Design Theme & Visual Environment
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6, margin: '6px 0 20px 0' }}>
            Choose an aesthetic curated for high-contrast institutional trading setups, or customize your own palette.
          </p>

          {/* Theme Preset Grid */}
          <div style={{ marginBottom: '28px' }}>
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
              CURATED PALETTES
            </label>

            <div className="theme-preset-grid">
              {THEME_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className={`theme-preset-card ${activePreset === preset.id ? 'active' : ''}`}
                  onClick={() => handlePresetSelect(preset.id)}
                  id={`preset-${preset.id}-btn`}
                  style={{ cursor: 'pointer', textAlign: 'left' }}
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
                style={{ cursor: 'pointer', textAlign: 'left' }}
              >
                <div className="theme-preset-colors">
                  <span style={{ background: hslToHex(hexToHSL(customColor).h, Math.min(hexToHSL(customColor).s, 15), Math.max(hexToHSL(customColor).l, 5)) }} />
                  <span style={{ background: hslToHex(hexToHSL(customColor).h, Math.min(hexToHSL(customColor).s, 15), Math.max(hexToHSL(customColor).l, 5) + 4) }} />
                  <span style={{ background: customColor }} />
                  <span style={{ background: '#22C55E' }} />
                  <span style={{ background: '#F43F5E' }} />
                </div>
                <span className="theme-preset-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Custom Color
                  <input
                    type="color"
                    value={customColor}
                    onChange={e => handleCustomColorChange(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      width: '20px',
                      height: '20px',
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
                <span className="theme-preset-desc">Custom Hex Accent</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            {/* Classic Dark / Light Toggle */}
            <div>
              <label className="form-label" style={{ marginBottom: '8px' }}>Color Mode</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className={`appearance-chip ${(activePreset === 'dark' || (theme === 'dark' && !THEME_PRESETS.find(p => p.id === activePreset) && activePreset !== 'custom')) ? 'active' : ''}`}
                  onClick={() => {
                    handlePresetSelect('dark');
                    if (theme !== 'dark') onToggleTheme();
                  }}
                  id="theme-dark-btn"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                  Dark Mode
                </button>
                <button
                  type="button"
                  className={`appearance-chip ${activePreset === 'light' ? 'active' : ''}`}
                  onClick={() => {
                    handlePresetSelect('light');
                    if (theme !== 'light') onToggleTheme();
                  }}
                  id="theme-light-btn"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  </svg>
                  Light Mode
                </button>
              </div>
            </div>

            {/* Display Contrast */}
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Display Contrast / Boldness</span>
                <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{contrast}%</span>
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
              <p style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-3)' }}>
                Fine-tunes typography contrast and background depth for monitor calibration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TAB 5: Account & Security ══════════════ */}
      {activeTab === 'account' && currentUser && (
        <div>
          <ProfileSection user={currentUser} onLogout={onLogout} onUserUpdate={onUserUpdate} />
        </div>
      )}
    </div>
  );
}
