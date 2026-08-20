import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api';

/**
 * AI Analysis panel — dynamic provider badge + shimmer loading.
 */
export function AIPanel({ aiAvailable }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiStatus, setAiStatus] = useState(null);

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

  const runAnalysis = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const result = await api.runAnalysis({
        custom_prompt: customPrompt || undefined,
      });
      if (result.status === 'started') {
        const today = new Date().toISOString().split('T')[0];
        const poll = setInterval(async () => {
          try {
            const res = await api.analysisHistory(today);
            if (res && res.analysis && !res.message) {
              setAnalysis(res);
              setLoading(false);
              clearInterval(poll);
            }
          } catch (e) {}
        }, 3000);
        setTimeout(() => { clearInterval(poll); setLoading(false); }, 120000);
      } else {
        setAnalysis(result);
        setLoading(false);
      }
    } catch (err) {
      setAnalysis({ analysis: `Error: ${err.message}`, score: 0 });
      setLoading(false);
    }
  };

  // Determine badge label from status
  const providerLabel = aiStatus?.analyzer?.provider
    ? aiStatus.analyzer.provider.toUpperCase()
    : 'Z.ai';
  const modelLabel = aiStatus?.analyzer?.model || '';
  const isProviderAvailable = aiStatus?.analyzer?.available ?? aiAvailable;

  // Provider badge color map
  const badgeColors = {
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
  const providerKey = aiStatus?.analyzer?.provider || 'zai';
  const badgeBg = badgeColors[providerKey] || badgeColors.zai;

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
        {!analysis && !loading && (
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
                : 'No AI provider available. Add GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or GROQ_API_KEY in backend/.env and restart the server.'}
            </p>
          </div>
        )}

        {loading && (
          <div className="shimmer-lines">
            <div className="shimmer-line" />
            <div className="shimmer-line" />
            <div className="shimmer-line" />
            <div className="shimmer-line" />
            <div className="shimmer-line" />
          </div>
        )}

        {analysis && !loading && (
          <ReactMarkdown>{analysis.analysis}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}


