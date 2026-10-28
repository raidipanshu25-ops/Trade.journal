import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api';

/**
 * AI Analysis panel — dynamic provider badge + shimmer loading.
 * Fixed: robust polling, proper error display, retry button.
 */
export function AIPanel({ aiAvailable }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    api.analysisHistory(today).then(res => {
      if (res && res.analysis && !res.message) {
        setAnalysis(res);
      }
    }).catch(console.error);

    // Fetch AI provider status
    api.aiStatus().then(setAiStatus).catch(console.error);
  }, []);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    stopPolling();

    // Remember existing analysis ID to ensure we don't immediately resolve to stale cached data
    const initialId = analysis?.id || 0;
    const requestStartTime = Date.now();
    setAnalysis(null);

    try {
      const result = await api.runAnalysis({
        custom_prompt: customPrompt || undefined,
      });

      if (result.status === 'started') {
        const today = new Date().toISOString().split('T')[0];
        let pollCount = 0;
        const MAX_POLLS = 90; // 90 × 1.5s = 135s max wait

        pollRef.current = setInterval(async () => {
          pollCount++;
          try {
            const res = await api.analysisHistory(today);
            const isNewResult = res && res.analysis && !res.message && (
              (res.id && res.id > initialId) ||
              (!initialId && res.analysis) ||
              (res.created_at && new Date(res.created_at).getTime() >= requestStartTime - 2000)
            );
            if (isNewResult) {
              setAnalysis(res);
              setLoading(false);
              stopPolling();
            } else if (pollCount >= MAX_POLLS) {
              setError('Analysis is taking longer than expected. Please click Retry or refresh the page.');
              setLoading(false);
              stopPolling();
            }
          } catch (e) {
            if (pollCount >= MAX_POLLS) {
              setError('Could not retrieve analysis results. Please try again.');
              setLoading(false);
              stopPolling();
            }
          }
        }, 1500);

        // Hard timeout at 140 seconds
        timeoutRef.current = setTimeout(() => {
          stopPolling();
          setLoading(false);
          setError('Analysis request timed out. Please click Retry.');
        }, 140000);
      } else if (result.analysis) {
        // Direct result (shouldn't normally happen with background task but handle it)
        setAnalysis(result);
        setLoading(false);
      } else if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        setAnalysis(result);
        setLoading(false);
      }
    } catch (err) {
      const errMsg = err.message || 'Unknown error';
      if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
        setError('AI provider quota exceeded. Please wait a moment or check your API key balance.');
      } else if (errMsg.includes('401') || errMsg.includes('403')) {
        setError('AI provider authentication failed. Check your API key in Settings.');
      } else if (errMsg.includes('timeout') || errMsg.toLowerCase().includes('network')) {
        setError('Network error reaching AI provider. Please check your connection and try again.');
      } else {
        setError(`Analysis failed: ${errMsg}`);
      }
      setLoading(false);
    }
  };

  // Determine badge label from status
  const providerLabel = aiStatus?.analyzer?.provider
    ? aiStatus.analyzer.provider.toUpperCase()
    : 'AI COACH';
  const modelLabel = aiStatus?.analyzer?.model || '';
  const isProviderAvailable = aiStatus?.analyzer?.available ?? aiAvailable;

  // Provider badge color map
  const badgeColors = {
    agentrouter:  'linear-gradient(135deg, #01FFA6, #00B88A)',
    gemini:       'linear-gradient(135deg, #4285f4, #0f9d58)',
    openai:       'linear-gradient(135deg, #10a37f, #1a7f64)',
    openrouter:   'linear-gradient(135deg, #7c3aed, #4f46e5)',
    groq:         'linear-gradient(135deg, #f59e0b, #d97706)',
    huggingface:  'linear-gradient(135deg, #ff9d00, #e67e00)',
    'nvidia-nim': 'linear-gradient(135deg, #76b900, #3a7000)',
    nvidia:       'linear-gradient(135deg, #76b900, #4a8a00)',
    zai:          'linear-gradient(135deg, #4a9eff, #3b82f6)',
    none:         'linear-gradient(135deg, #6b7280, #4b5563)',
  };
  const providerKey = aiStatus?.analyzer?.provider || 'agentrouter';
  const badgeBg = badgeColors[providerKey] || badgeColors.agentrouter;

  return (
    <div className="ai-panel" id="ai-panel">
      <div className="ai-panel-header">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93"/>
            <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93"/>
            <circle cx="12" cy="14" r="1"/>
            <path d="M6 20a6 6 0 0 1 12 0"/>
            <path d="M12 14v-4"/>
          </svg>
          AI Trading Coach
          <span
            className="ai-badge"
            style={{ background: badgeBg }}
            title={modelLabel ? `Model: ${modelLabel}` : undefined}
          >
            {providerLabel}
          </span>
          {!isProviderAvailable && (
            <span style={{ fontSize: '0.7rem', color: 'var(--red)', marginLeft: 6, fontWeight: 500 }}>
              ⚠ Offline
            </span>
          )}
        </h3>
        <button
          className="btn btn-primary"
          onClick={runAnalysis}
          disabled={loading}
          id="run-analysis-btn"
        >
          {loading ? (
            <>
              <span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Analyzing...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run Analysis
            </>
          )}
        </button>
      </div>

      <div style={{ padding: '14px 20px', borderBottom: `1px solid var(--border)` }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Additional Context (Optional)</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. market was choppy, felt hesitant, was following news..."
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            id="custom-prompt-input"
          />
        </div>
      </div>

      {/* Active provider info strip */}
      {aiStatus && (
        <div style={{
          padding: '8px 20px',
          borderBottom: `1px solid var(--border)`,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontSize: '0.72rem',
          color: 'var(--text-2)',
          background: 'var(--bg-2)',
          flexWrap: 'wrap',
        }}>
          <span>
            <span style={{ color: 'var(--text-3)' }}>Provider: </span>
            <span style={{ color: isProviderAvailable ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {isProviderAvailable ? providerLabel : 'None'}
            </span>
          </span>
          {modelLabel && (
            <span>
              <span style={{ color: 'var(--text-3)' }}>Model: </span>
              <code style={{ color: 'var(--cyan)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>{modelLabel}</code>
            </span>
          )}
          {!isProviderAvailable && (
            <span style={{ color: 'var(--yellow)' }}>
              Add <code style={{ fontFamily: 'var(--mono)' }}>GEMINI_API_KEY</code>, <code style={{ fontFamily: 'var(--mono)' }}>OPENAI_API_KEY</code>, or <code style={{ fontFamily: 'var(--mono)' }}>GROQ_API_KEY</code> to <code style={{ fontFamily: 'var(--mono)' }}>backend/.env</code>
            </span>
          )}
        </div>
      )}

      <div className="ai-content">
        {/* Error banner with retry */}
        {error && !loading && (
          <div style={{
            background: 'var(--red-dim)',
            border: '1px solid var(--red-border)',
            borderRadius: 'var(--radius-m)',
            padding: '14px 18px',
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <div>
              <div style={{ color: 'var(--red-bright)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                Analysis Failed
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: '0.78rem' }}>{error}</div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => { setError(''); runAnalysis(); }}
              style={{ flexShrink: 0, fontSize: '0.78rem', padding: '8px 16px' }}
            >
              ↻ Retry
            </button>
          </div>
        )}

        {!analysis && !loading && !error && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93"/>
                <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93"/>
                <circle cx="12" cy="14" r="1"/>
                <path d="M6 20a6 6 0 0 1 12 0"/>
                <path d="M12 14v-4"/>
              </svg>
            </div>
            <h3>Analysis Ready</h3>
            <p>
              {isProviderAvailable
                ? `Click "Run Analysis" to get professional insights from AXIOM. Using ${providerLabel}${modelLabel ? ` (${modelLabel})` : ''}.`
                : 'No AI provider available. Configure AGENTROUTER_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY in Settings or backend/.env.'}
            </p>
          </div>
        )}

        {loading && (
          <div>
            <div className="shimmer-lines">
              <div className="shimmer-line" />
              <div className="shimmer-line" />
              <div className="shimmer-line" />
              <div className="shimmer-line" />
              <div className="shimmer-line" />
            </div>
            <p style={{
              textAlign: 'center', color: 'var(--text-3)',
              fontSize: '0.78rem', fontFamily: 'var(--mono)',
              marginTop: '12px',
            }}>
              AXIOM is analyzing your trades... this may take 30-60 seconds
            </p>
          </div>
        )}

        {analysis && !loading && (
          <ReactMarkdown>{analysis.analysis}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}


