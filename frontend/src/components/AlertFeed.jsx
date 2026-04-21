/**
 * AlertFeed — discipline violation alerts.
 * io.net severity borders, monospace timestamps, crisp icons.
 */
export function AlertFeed({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h3>No Violations</h3>
        <p>All rules followed. Discipline intact.</p>
      </div>
    );
  }

  const AlertIcon = ({ severity }) => (
    <div className="alert-icon">
      {severity === 'critical' ? (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      )}
    </div>
  );

  return (
    <div className="alert-feed" id="alert-feed">
      {alerts.map((alert, index) => (
        <div key={index} className={`alert-item ${alert.severity}`}>
          <AlertIcon severity={alert.severity} />
          <div className="alert-content">
            <div className="alert-message">{alert.message}</div>
            {alert.details && (
              <div className="alert-details">{alert.details}</div>
            )}
            <div className="alert-time">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
