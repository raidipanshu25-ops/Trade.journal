import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';

/**
 * Custom hook that polls the backend at a given interval.
 */
export function usePolling(fetchFn, intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}

/**
 * Hook for ALL real-time data via WebSocket.
 *
 * Light ticks (every 1s): positions, account, connected status
 * Full ticks (every 3s):  also daily_stats, discipline, journal_stats
 *
 * Falls back to REST polling if WebSocket fails.
 */
export function useLiveData() {
  const [positions, setPositions] = useState([]);
  const [account, setAccount] = useState(null);
  const [connected, setConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting | open | closed | fallback
  const [historyUpdatedCounter, setHistoryUpdatedCounter] = useState(0);

  // Heavy data — only updated on full ticks (every 3s)
  const [dailyStats, setDailyStats] = useState(null);
  const [discipline, setDiscipline] = useState(null);
  const [journalStats, setJournalStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const fallbackTimer = useRef(null);
  const reconnectDelay = useRef(1000);
  const mountedRef = useRef(true);

  const connectWs = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      // Build WebSocket URL from current location
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = localStorage.getItem('tj-auth-token') || '';
      const wsUrl = `${proto}//${window.location.host}/ws/live?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsStatus('connecting');

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setWsStatus('open');
        reconnectDelay.current = 1000; // Reset backoff
        // Clear any fallback polling
        if (fallbackTimer.current) {
          clearInterval(fallbackTimer.current);
          fallbackTimer.current = null;
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          
          if (data.history_updated) {
            setHistoryUpdatedCounter(prev => prev + 1);
          }
          
          setPositions(data.positions || []);
          setAccount(data.account || null);
          setConnected(data.connected || false);

          // Full-tick fields (only present every 3rd tick)
          if (data.daily_stats !== undefined) {
            setDailyStats(data.daily_stats);
          }
          if (data.discipline !== undefined) {
            setDiscipline(data.discipline);
          }
          if (data.journal_stats !== undefined) {
            setJournalStats(data.journal_stats);
          }
          if (data.analytics !== undefined) {
            setAnalytics(data.analytics);
          }
        } catch (e) {
          console.warn('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setWsStatus('closed');
        wsRef.current = null;
        // Start fallback polling while we try to reconnect
        startFallbackPolling();
        // Try reconnecting with backoff (max 10s)
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, 10000);
          connectWs();
        }, reconnectDelay.current);
      };

      ws.onerror = () => {
        // onclose will fire after this
        ws.close();
      };
    } catch (e) {
      console.warn('WebSocket creation failed, using REST fallback:', e);
      setWsStatus('fallback');
      startFallbackPolling();
    }
  }, []);

  const startFallbackPolling = useCallback(() => {
    if (fallbackTimer.current) return; // Already polling
    setWsStatus('fallback');
    
    const poll = async () => {
      try {
        const res = await fetch('/api/positions-live');
        if (res.ok) {
          const data = await res.json();
          if (mountedRef.current) {
            setPositions(data.positions || []);
            setAccount(data.account || null);
            setConnected(data.connected || false);
          }
        }
      } catch (e) {
        // Silently retry
      }
    };
    
    poll(); // Immediate first fetch
    fallbackTimer.current = setInterval(poll, 2000); // 2s fallback polling
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connectWs();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (fallbackTimer.current) {
        clearInterval(fallbackTimer.current);
      }
    };
  }, [connectWs]);

  return {
    positions, account, connected, wsStatus, historyUpdatedCounter,
    dailyStats, discipline, journalStats, analytics,
  };
}


/**
 * Lightweight dashboard hook — no more 15s heavy polling.
 *
 * On mount: one-shot health check to determine MT5 + AI availability.
 * Every 30s: lightweight health ping only.
 * Manual refresh() fetches everything via REST as a fallback.
 *
 * All heavy data (discipline, daily stats, journal stats) now comes
 * through the useLiveData() WebSocket — see App.jsx.
 */
export function useDashboard() {
  const [state, setState] = useState({
    health: null,
    loading: true,
    error: null,
    mt5Connected: false,
    aiAvailable: false,
  });

  // One-shot: full REST fetch (used on mount and as manual fallback)
  const refresh = useCallback(async () => {
    try {
      const health = await api.health();
      setState(prev => ({
        ...prev,
        health,
        loading: false,
        error: null,
        mt5Connected: health.mt5_connected,
        aiAvailable: health.ai_available,
      }));
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    refresh();
    // Lightweight health ping every 30s (just checks MT5 + AI status)
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { ...state, refresh };
}

