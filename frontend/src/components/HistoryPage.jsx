import { useState, useEffect } from 'react';
import { api } from '../api';
import { StatCard } from './StatCard';

export function HistoryPage({ mt5Connected, historyUpdatedCounter }) {
  const [stats, setStats] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [statsData, tradesData] = await Promise.all([
        api.journalStats(),
        api.journalTrades({ limit, offset: page * limit, date: dateFilter })
      ]);
      setStats(statsData);
      setTrades(tradesData);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dateFilter, historyUpdatedCounter]);

  const handleSync = async () => {
    if (!mt5Connected) return;
    setSyncing(true);
    try {
      await api.syncJournal();
      // Reload current page
      await loadHistory();
    } catch (err) {
      console.error('Failed to sync journal:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Trade History Journal</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <p>Your complete record of closed positions and historical performance.</p>
          <button 
            className="btn btn-secondary" 
            onClick={handleSync} 
            disabled={syncing || !mt5Connected}
            title={!mt5Connected ? 'Connect MT5 to sync' : 'Sync latest historical trades'}
          >
            {syncing ? 'Syncing...' : 'Sync MT5'}
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <StatCard
            title="Total Closed Trades"
            value={stats.total_trades}
            subtitle={`${stats.winning_trades}W / ${stats.losing_trades}L`}
            type="neutral"
          />
          <StatCard
            title="Overall Win Rate"
            value={`${stats.win_rate}%`}
            subtitle="Historical"
            type={stats.win_rate >= 50 ? 'profit' : stats.win_rate > 0 ? 'loss' : 'neutral'}
          />
          <StatCard
            title="Net Historical P&L"
            value={`$${stats.net_pnl >= 0 ? '+' : ''}${stats.net_pnl.toFixed(2)}`}
            subtitle={`Gross Profit: $${stats.total_profit.toFixed(2)}`}
            type={stats.net_pnl >= 0 ? 'profit' : stats.net_pnl < 0 ? 'loss' : 'neutral'}
          />
          <StatCard
            title="Active Days"
            value={stats.trading_days}
            subtitle={stats.symbols_traded?.length ? `${stats.symbols_traded.length} Symbols Traded` : '—'}
            type="neutral"
          />
        </div>
      )}

      <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">Closed Positions</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="date" 
              className="form-input" 
              style={{ width: '150px', padding: '6px 12px' }}
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(0);
              }}
            />
            {dateFilter && (
              <button className="btn btn-secondary" onClick={() => { setDateFilter(''); setPage(0); }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-2)' }}>Loading history...</div>
        ) : trades.length === 0 ? (
          <div className="empty-state">
            <p>No trade history found for this criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Close Time</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Size</th>
                  <th style={{ textAlign: 'right' }}>Open/Close</th>
                  <th style={{ textAlign: 'right' }}>Duration</th>
                  <th style={{ textAlign: 'right' }}>Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => {
                  const net = trade.profit + (trade.commission || 0) + (trade.swap || 0);

                  return (
                    <tr key={trade.ticket}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--text-2)' }}>
                        #{trade.ticket}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-0)' }}>{trade.date}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                          {trade.close_time
                            ? (trade.close_time.includes('T')
                                ? trade.close_time.split('T')[1]?.substring(0, 8)
                                : trade.close_time.split(' ')[1]?.substring(0, 8))
                            : ''}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-0)', letterSpacing: '0.3px' }}>{trade.symbol}</td>
                      <td>
                        <span className={`type-badge type-${trade.type?.toLowerCase()}`}>
                          {trade.type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{trade.volume}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--text-1)' }}>
                        <div>{(trade.open_price || 0).toFixed(5)}</div>
                        <div style={{ color: 'var(--text-2)' }}>{(trade.close_price || 0).toFixed(5)}</div>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                        {(() => {
                          const m = Math.max(0, Math.round(trade.duration_minutes || 0));
                          if (m === 0) return '—';
                          if (m < 60) return `${m}m`;
                          const h = Math.floor(m / 60);
                          const mins = m % 60;
                          return mins > 0 ? `${h}h ${mins}m` : `${h}h`;
                        })()}
                      </td>
                      <td style={{ 
                        textAlign: 'right',
                        fontWeight: 700,
                        fontFamily: 'var(--mono)',
                        color: net > 0 ? 'var(--green-bright)' : net < 0 ? 'var(--red-bright)' : 'var(--text-1)'
                      }}>
                        {net > 0 ? '+' : ''}{net.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            disabled={page === 0 || loading}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </button>
          <span style={{ color: 'var(--text-2)', fontSize: '0.9em' }}>
            Page {page + 1}
          </span>
          <button 
            className="btn btn-secondary" 
            disabled={trades.length < limit || loading}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
