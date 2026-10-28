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
  mt5accounts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
      <circle cx="7" cy="15" r="1" fill="currentColor"/>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
};

export function Sidebar({ activePage, onNavigate, mt5Connected, aiAvailable, alertCount, theme, onToggleTheme, currentUser, onLogout, onShowLanding }) {
  const navItems = [
    { id: 'dashboard',        label: 'Dashboard',         icon: 'dashboard' },
    { id: 'trades',           label: 'Positions',         icon: 'trades' },
    { id: 'history',          label: 'History',           icon: 'history' },
    { id: 'accountAnalysis',  label: 'Account Analysis',  icon: 'accountAnalysis' },
    { id: 'discipline',       label: 'Discipline',        icon: 'discipline', badge: alertCount },
    { id: 'analysis',         label: 'AI Coach',          icon: 'analysis' },
    { id: 'chartvision',      label: 'Chart Vision',      icon: 'chartvision' },
    { id: 'mt5accounts',      label: 'MT5 Accounts',      icon: 'mt5accounts' },
    { id: 'settings',         label: 'Settings',          icon: 'settings' },
  ];

  if (currentUser?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: 'admin' });
  }

  return (
    <aside className="sidebar" id="sidebar">
      {/* Brand */}
      <div className="sidebar-brand" title="AI Trading Journal">
        <div className="sidebar-brand-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 17 9 11 13 15 21 7"/>
            <polyline points="17 7 21 7 21 11"/>
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <h1>Trade.Journal</h1>
          <span className="brand-tag">Trading Dashboard</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Menu</div>
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

        {onShowLanding && (
          <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
            <button
              className="nav-item"
              onClick={onShowLanding}
              id="nav-view-website"
              title="View public website"
              style={{ color: 'var(--text-1)' }}
            >
              <span className="nav-item-icon" style={{ opacity: 0.7 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </span>
              View Website
            </button>
          </div>
        )}
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
              <span>AI Coach {aiAvailable ? 'Ready' : 'No Key'}</span>
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
        <div className="sidebar-version">Trading Journal · v1.0</div>
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                {currentUser.username?.charAt(0) || '?'}
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-0)', fontWeight: 600, lineHeight: '1.2' }}>{currentUser.username}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{currentUser.role}</div>
              </div>
            </div>
            {onLogout && (
              <button className="btn-icon" onClick={onLogout} title="Sign out" style={{ width: '24px', height: '24px' }} id="sidebar-logout">
                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
