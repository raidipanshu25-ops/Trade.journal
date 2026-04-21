import { useRef, useEffect } from 'react';

/**
 * TradesTable — real-time P&L with io.net flash animation.
 * BUY = green-bright LONG badge, SELL = red-bright SHORT badge.
 */
export function TradesTable({ positions = [] }) {
  const prevProfits = useRef({});

  useEffect(() => {
    const newMap = {};
    positions.forEach(p => { newMap[p.ticket] = p.profit; });
    prevProfits.current = newMap;
  }, [positions]);

  if (!positions.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
            <polyline points="16 7 22 7 22 13"/>
          </svg>
        </div>
        <h3>No Open Positions</h3>
        <p>No active trades right now. Market waiting.</p>
      </div>
    );
  }

  const fmt = (minutes) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs}h ${mins}m`;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" id="trades-table">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Vol</th>
            <th>Entry</th>
            <th>Current</th>
            <th>P&amp;L</th>
            <th>Duration</th>
            <th>SL</th>
            <th>TP</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(pos => {
            const prevProfit = prevProfits.current[pos.ticket];
            const changed = prevProfit !== undefined && prevProfit !== pos.profit;
            const direction = changed ? (pos.profit > prevProfit ? 'flash-up' : 'flash-down') : '';
            const isLong = pos.type === 'BUY';

            return (
              <tr key={pos.ticket}>
                <td style={{ color: 'var(--text-2)', fontSize: '0.72rem' }}>{pos.ticket}</td>
                <td style={{ fontWeight: 700, color: 'var(--text-0)', letterSpacing: '0.3px' }}>
                  {pos.symbol}
                </td>
                <td>
                  <span className={`side-badge ${isLong ? 'long' : 'short'}`}>
                    {isLong ? 'LONG' : 'SHORT'}
                  </span>
                </td>
                <td>{pos.volume}</td>
                <td>{pos.open_price}</td>
                <td className={`live-price ${direction}`}>{pos.current_price}</td>
                <td className={`live-pnl ${pos.profit >= 0 ? 'profit-cell' : 'loss-cell'} ${direction}`}>
                  {pos.profit >= 0 ? '+' : ''}{pos.profit.toFixed(2)}
                </td>
                <td>{fmt(pos.duration_minutes)}</td>
                <td style={{ color: pos.sl ? 'var(--red-bright)' : 'var(--text-3)' }}>
                  {pos.sl || '—'}
                </td>
                <td style={{ color: pos.tp ? 'var(--green-bright)' : 'var(--text-3)' }}>
                  {pos.tp || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
