import React from 'react';

export function ConnectorStatus({
  connected = false,
  connectorConnected = false,
  mt5Connected = false,
  mt5Status = 'closed',
  lockReason = '',
  lastSync,
  onStartSession,
  onSetupClick,
  starting = false,
}) {
  // If either connectorConnected or connected is true, the sync agent is alive
  const isAgentOnline = connectorConnected || connected;
  const isMt5Active = mt5Connected;
  const isLockedOrOutOfSession = isAgentOnline && !isMt5Active;

  // Determine badge colors & label
  let dotColor = 'var(--red)';
  let bg = 'var(--red-dim)';
  let border = 'var(--red-border)';
  let label = 'Connector Offline';
  let subBadge = null;

  if (starting || mt5Status === 'reconnecting') {
    dotColor = 'var(--amber)';
    bg = 'var(--amber-dim)';
    border = 'var(--amber-border)';
    label = starting ? 'Connecting MT5…' : 'Reconnecting MT5…';
  } else if (isMt5Active) {
    dotColor = 'var(--green-bright)';
    bg = 'var(--green-dim)';
    border = 'var(--green-border)';
    label = 'MT5 Live';
  } else if (isAgentOnline) {
    // Connector is connected, MT5 is closed (Discipline or Out of Session)
    dotColor = 'var(--cyan)';
    bg = 'rgba(0, 180, 216, 0.12)';
    border = 'rgba(0, 180, 216, 0.35)';
    label = 'Connector Online';

    const isOutOfSession = mt5Status === 'out_of_session' || (lockReason && lockReason.toLowerCase().includes('outside'));
    subBadge = (
      <span
        style={{
          marginLeft: '4px',
          padding: '1px 6px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.08)',
          color: 'var(--amber)',
          fontSize: '0.68rem',
          fontWeight: 600,
        }}
        title={lockReason || (isOutOfSession ? 'Outside of active trading session' : 'Rule violation lock active')}
      >
        🔒 {isOutOfSession ? 'Out of Session' : 'MT5 Locked'}
      </span>
    );
  }

  const tooltipText = starting
    ? 'Establishing connection to MetaTrader 5...'
    : isMt5Active
    ? `MT5 is connected and streaming live data. ${lastSync ? `Last sync: ${lastSync}` : ''}`
    : isAgentOnline
    ? `Connection established. MT5 closed: ${lockReason || 'Session closed/Discipline protected'}`
    : 'Connector is not running on your computer. Click Connect to start.';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '6px',
        background: bg,
        border: `1px solid ${border}`,
        fontSize: '0.75rem',
        fontFamily: 'var(--mono)',
        color: 'var(--text-0)',
        whiteSpace: 'nowrap',
      }}
      title={tooltipText}
    >
      <div
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 8px ${dotColor}`,
          animation: isMt5Active ? 'pulseGreen 2s infinite' : 'none',
        }}
      />
      <span style={{ fontWeight: 600, letterSpacing: '0.3px', color: dotColor }}>
        {label}
      </span>

      {subBadge}

      {/* When offline, provide 1-click connect button for returning users */}
      {!isAgentOnline && onStartSession && (
        <button
          onClick={onStartSession}
          disabled={starting}
          style={{
            marginLeft: '6px',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '2px 8px',
            cursor: starting ? 'wait' : 'pointer',
            fontSize: '0.70rem',
            fontWeight: 700,
            fontFamily: 'var(--mono)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
          title="Click to start your trading session and connect MT5"
        >
          {starting ? 'Connecting…' : '⚡ Connect'}
        </button>
      )}

      {/* When offline, provide secondary setup/download option */}
      {!isAgentOnline && onSetupClick && (
        <button
          onClick={onSetupClick}
          style={{
            marginLeft: '4px',
            background: 'none',
            border: 'none',
            color: 'var(--text-2)',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '0.68rem',
            padding: 0,
            fontFamily: 'var(--mono)',
          }}
          title="Download connector package or view setup guide"
        >
          First time?
        </button>
      )}
    </div>
  );
}
