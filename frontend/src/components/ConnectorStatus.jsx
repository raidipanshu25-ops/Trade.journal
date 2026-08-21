import React from 'react';

export function ConnectorStatus({ connected, lastSync, onSetupClick }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '6px',
        background: connected ? 'var(--green-dim)' : 'var(--red-dim)',
        border: `1px solid ${connected ? 'var(--green-border)' : 'var(--red-border)'}`,
        fontSize: '0.75rem',
        fontFamily: 'var(--mono)',
        color: connected ? 'var(--green)' : 'var(--red)',
        whiteSpace: 'nowrap',
      }}
      title={lastSync ? `Last sync: ${lastSync}` : 'No sync data'}
    >
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: connected ? 'var(--green)' : 'var(--red)',
          boxShadow: connected ? 'var(--green-glow)' : 'var(--red-glow)',
          animation: connected ? 'pulseGreen 2s infinite' : 'pulseRed 2s infinite',
        }}
      />
      <span style={{ fontWeight: 600, letterSpacing: '0.5px' }}>
        {connected ? 'MT5 Connected' : 'MT5 Disconnected'}
      </span>
      {!connected && (
        <button
          onClick={onSetupClick}
          style={{
            marginLeft: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--text-0)',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '0.7rem',
            padding: 0,
            fontFamily: 'var(--mono)',
          }}
        >
          Setup
        </button>
      )}
    </div>
  );
}
