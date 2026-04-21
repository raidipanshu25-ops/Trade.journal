/**
 * Sidebar — io.net precision navigation.
 * Outfit display font, gradient brand mark, neon-pill active indicator.
 */

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
  ),
  trades: (
    <svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  discipline: (
    <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  analysis: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
  ),
  exness: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
  ),
  chartvision: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
  ),
  accountAnalysis: (
    <svg viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
  ),
};

export function Sidebar({ activePage, onNavigate, mt5Connected, aiAvailable, alertCount, theme, onToggleTheme }) {
  const navItems = [
    { id: 'dashboard',        label: 'Dashboard',         icon: 'dashboard' },
    { id: 'trades',             label: 'Positions',         icon: 'trades' },
    { id: 'history',            label: 'History',           icon: 'history' },
    { id: 'accountAnalysis',    label: 'Account Analysis',  icon: 'accountAnalysis' },
    { id: 'discipline',         label: 'Discipline',        icon: 'discipline', badge: alertCount },
    { id: 'analysis',           label: 'AI Coach',          icon: 'analysis' },
    { id: 'chartvision',        label: 'Chart Vision',      icon: 'chartvision' },
    { id: 'exness',             label: 'MT5 Terminal',      icon: 'exness' },
    { id: 'settings',           label: 'Settings',          icon: 'settings' },
  ];

  return (
    <aside className="sidebar" id="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="8" width="3" height="10" rx="1" fill="url(#brandGrad)"/>
            <rect x="10.5" y="4" width="3" height="14" rx="1" fill="url(#brandGrad)"/>
            <rect x="17" y="10" width="3" height="8" rx="1" fill="url(#brandGrad)"/>
            <line x1="5.5" y1="5" x2="5.5" y2="8" stroke="url(#brandGrad)" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="12" y1="1.5" x2="12" y2="4" stroke="url(#brandGrad)" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="18.5" y1="7" x2="18.5" y2="10" stroke="url(#brandGrad)" strokeWidth="1.2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0%" stopColor="#22d3ee"/>
                <stop offset="100%" stopColor="#3b82f6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <h1>Trade<span className="brand-dot">.</span><span className="brand-accent">journal</span></h1>
          <span className="brand-tag">mt5 · live</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            id={`nav-${item.id}`}
            aria-current={activePage === item.id ? 'page' : undefined}
          >
            <span className="nav-item-icon">{icons[item.icon]}</span>
            {item.label}
            {item.badge > 0 && (
              <span className="nav-item-badge">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="connection-status">
              <div className={`connection-dot ${mt5Connected ? 'connected' : ''}`} />
              <span>MT5 {mt5Connected ? 'Online' : 'Offline'}</span>
            </div>
            <div className="connection-status" style={{ marginTop: '6px' }}>
              <div className={`connection-dot ${aiAvailable ? 'connected' : ''}`} />
              <span>Kimi 2.5 {aiAvailable ? 'Ready' : 'No Key'}</span>
            </div>
          </div>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            id="theme-toggle-btn"
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
        <div className="sidebar-version">v1.0.0 · Trade.journal</div>
      </div>
    </aside>
  );
}
