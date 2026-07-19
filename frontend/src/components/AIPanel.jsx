import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api';

/**
 * AI Analysis panel — io.net styled with gradient badge and shimmer loading.
 */
export function AIPanel({ aiAvailable }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    api.analysisHistory(today).then(res => {
      if (res && res.analysis && !res.message) {
        setAnalysis(res);
      }
    }).catch(console.error);
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
          <span className="ai-badge">Z.ai</span>
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
              {aiAvailable
                ? 'Click "Run Analysis" to get professional insights about your trading performance.'
                : 'Add your NVIDIA API key in backend/.env to enable AI analysis. Basic mode is available.'}
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
