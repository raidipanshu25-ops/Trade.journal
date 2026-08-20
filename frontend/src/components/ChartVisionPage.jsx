/**
 * Chart Vision Page — Screen capture from Exness WebTerminal + Vision AI analysis.
 * Uses getDisplayMedia() for one-click tab capture.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

const STATUS_BADGES = {
  pending: { label: 'Pending', color: '#4a9eff' },
  processing: { label: 'Analyzing', color: '#f0b429' },
  done: { label: 'Analyzed', color: '#00e5a0' },
  error: { label: 'Error', color: '#ff4757' },
};

export function ChartVisionPage() {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnap, setSelectedSnap] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [context, setContext] = useState('');
  const [streamActive, setStreamActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pollRef = useRef(null);

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
    // Fetch AI provider status
    api.aiStatus().then(setAiStatus).catch(console.error);
    return () => {
      // Cleanup stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll for analysis status updates when we have pending snapshots
  useEffect(() => {
    const hasPending = snapshots.some(s => s.analysis_status === 'pending' || s.analysis_status === 'processing');
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(loadSnapshots, 3000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [snapshots]);

  async function loadSnapshots() {
    try {
      const data = await api.chartSnapshots({ limit: 50 });
      setSnapshots(data);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    }
  }

  // --- Screen Capture ---
  const startCapture = useCallback(async () => {
    try {
      // If we already have an active stream, capture immediately
      if (streamRef.current && streamRef.current.active) {
        captureFrame();
        return;
      }

      // Request screen/tab capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'never' },
        audio: false,
        preferCurrentTab: false,
      });

      streamRef.current = stream;
      setStreamActive(true);

      // Listen for stream end (user clicks "Stop Sharing")
      stream.getVideoTracks()[0].onended = () => {
        streamRef.current = null;
        setStreamActive(false);
      };

      // Small delay to let the stream initialize, then capture
      setTimeout(() => captureFrame(), 300);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setStatusMsg('Capture cancelled — select an Exness tab next time');
      } else {
        setStatusMsg(`Capture error: ${err.message}`);
      }
      setTimeout(() => setStatusMsg(''), 4000);
    }
  }, []);

  const captureFrame = useCallback(() => {
    if (!streamRef.current || !streamRef.current.active) return;

    const track = streamRef.current.getVideoTracks()[0];
    const settings = track.getSettings();
    const canvas = canvasRef.current;
    canvas.width = settings.width || 1920;
    canvas.height = settings.height || 1080;

    // Create a temporary video to grab the frame
    const tempVideo = document.createElement('video');
    tempVideo.srcObject = streamRef.current;
    tempVideo.play().then(() => {
      canvas.getContext('2d').drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedImage(dataUrl);
      setStatusMsg('Chart captured! Add details and save.');
      setTimeout(() => setStatusMsg(''), 3000);
      tempVideo.pause();
      tempVideo.srcObject = null;
    });
  }, []);

  // --- Clipboard Paste ---
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (ev) => {
            setCapturedImage(ev.target.result);
            setStatusMsg('Image pasted from clipboard!');
            setTimeout(() => setStatusMsg(''), 3000);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // --- File Drop ---
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCapturedImage(ev.target.result);
        setStatusMsg('Image dropped!');
        setTimeout(() => setStatusMsg(''), 3000);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // --- Upload & Analyze ---
  async function handleSave() {
    if (!capturedImage) return;
    setUploading(true);
    try {
      const result = await api.chartUpload({
        image: capturedImage,
        symbol,
        timeframe,
        context,
        auto_analyze: true,
      });
      if (result.status === 'duplicate') {
        setStatusMsg('⚠️ This chart was already captured');
      } else {
        setStatusMsg('✅ Chart saved & analysis started!');
        setCapturedImage(null);
        setSymbol('');
        setTimeframe('');
        setContext('');
      }
      loadSnapshots();
    } catch (err) {
      setStatusMsg(`❌ Upload failed: ${err.message}`);
    }
    setUploading(false);
    setTimeout(() => setStatusMsg(''), 4000);
  }

  // --- Export ---
  function handleExport() {
    const url = api.chartExport();
    window.open(url, '_blank');
  }

  // --- Delete ---
  async function handleDelete(id) {
    if (!confirm('Delete this chart snapshot?')) return;
    try {
      await api.chartDelete(id);
      setSnapshots(prev => prev.filter(s => s.id !== id));
      if (selectedSnap?.id === id) setSelectedSnap(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  // --- Re-analyze ---
  async function handleReanalyze(id) {
    try {
      await api.chartAnalyze(id);
      setStatusMsg('🔄 Re-analysis started...');
      setTimeout(() => setStatusMsg(''), 3000);
      loadSnapshots();
    } catch (err) {
      setStatusMsg(`❌ Re-analysis failed: ${err.message}`);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  }

  // --- Select snapshot for detail ---
  async function handleSelectSnap(snap) {
    try {
      const detail = await api.chartSnapshot(snap.id);
      setSelectedSnap(detail);
    } catch (err) {
      setSelectedSnap(snap);
    }
  }

  return (
    <div className="chart-vision-page">
      <h1 className="page-title">Chart Vision AI</h1>
      <p className="page-subtitle">
        Capture charts from Exness WebTerminal • Vision AI analyzes patterns • Export training data
      </p>

      {/* Vision provider info strip */}
      {aiStatus && (
        <div style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-2)',
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 16px',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          {aiStatus.vision?.available ? (
            <>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>● Vision AI Active</span>
              <span><span style={{ color: 'var(--text-3)' }}>Vision: </span>
                <code style={{ color: 'var(--cyan)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>
                  {aiStatus.vision.vision_provider}/{aiStatus.vision.vision_model}
                </code>
              </span>
              {aiStatus.vision.coaching_provider && aiStatus.vision.coaching_provider !== 'none' && (
                <span><span style={{ color: 'var(--text-3)' }}>Coaching: </span>
                  <code style={{ color: 'var(--cyan)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>
                    {aiStatus.vision.coaching_provider}/{aiStatus.vision.coaching_model}
                  </code>
                </span>
              )}
            </>
          ) : (
            <>
              <span style={{ color: 'var(--red)', fontWeight: 600 }}>● Vision AI Offline</span>
              <span style={{ color: 'var(--yellow)' }}>
                Add <code style={{ fontFamily: 'var(--mono)' }}>NVIDIA_API_KEY</code>, <code style={{ fontFamily: 'var(--mono)' }}>GEMINI_API_KEY</code>, or <code style={{ fontFamily: 'var(--mono)' }}>OPENAI_API_KEY</code> to <code style={{ fontFamily: 'var(--mono)' }}>backend/.env</code> and restart
              </span>
            </>
          )}
        </div>
      )}

      {statusMsg && (
        <div className="cv-status-banner">{statusMsg}</div>
      )}

      {/* Hidden canvas for screen capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Capture Zone */}
      <div className="cv-capture-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="cv-capture-header">
          <h2>📸 Capture & Upload</h2>
          <div className="cv-capture-actions">
            <button className="cv-btn cv-btn-primary" onClick={startCapture} id="btn-capture-chart">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {streamActive ? 'Capture Again' : 'Capture Chart'}
            </button>
            {streamActive && (
              <span className="cv-stream-indicator">
                <span className="cv-stream-dot" /> Stream Active
              </span>
            )}
          </div>
        </div>

        {!capturedImage ? (
          <div className="cv-drop-area">
            <div className="cv-drop-icon">
              <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="var(--accent)" strokeWidth="2">
                <rect x="6" y="10" width="36" height="28" rx="3" />
                <circle cx="24" cy="24" r="8" />
                <path d="M16 10l3-4h10l3 4" />
              </svg>
            </div>
            <p className="cv-drop-text">
              Click <strong>Capture Chart</strong> to grab Exness WebTerminal
            </p>
            <p className="cv-drop-hint">
              Or paste from clipboard (Ctrl+V) • Or drag & drop an image
            </p>
          </div>
        ) : (
          <div className="cv-preview-area">
            <img src={capturedImage} alt="Captured chart" className="cv-preview-image" />
            <div className="cv-preview-fields">
              <div className="cv-field-row">
                <div className="cv-field">
                  <label>Symbol</label>
                  <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)}
                    placeholder="e.g. XAUUSD, EURUSD" />
                </div>
                <div className="cv-field">
                  <label>Timeframe</label>
                  <select value={timeframe} onChange={e => setTimeframe(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="M1">M1</option>
                    <option value="M5">M5</option>
                    <option value="M15">M15</option>
                    <option value="M30">M30</option>
                    <option value="H1">H1</option>
                    <option value="H4">H4</option>
                    <option value="D1">D1</option>
                    <option value="W1">W1</option>
                  </select>
                </div>
              </div>
              <div className="cv-field" style={{ width: '100%' }}>
                <label>Context Note</label>
                <input type="text" value={context} onChange={e => setContext(e.target.value)}
                  placeholder="e.g. before NY open, after SL hit, waiting for breakout..." />
              </div>
              <div className="cv-preview-actions">
                <button className="cv-btn cv-btn-success" onClick={handleSave} disabled={uploading} id="btn-save-chart">
                  {uploading ? '⏳ Saving...' : '💾 Save & Analyze'}
                </button>
                <button className="cv-btn cv-btn-ghost" onClick={() => setCapturedImage(null)}>
                  ✕ Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="cv-toolbar">
        <h2>📊 Snapshot Gallery ({snapshots.length})</h2>
        <button className="cv-btn cv-btn-outline" onClick={handleExport} disabled={!snapshots.length} id="btn-export-json">
          📥 Export Training JSON
        </button>
      </div>

      {/* Gallery + Detail Split */}
      <div className="cv-content">
        {/* Gallery Grid */}
        <div className={`cv-gallery ${selectedSnap ? 'cv-gallery-narrow' : ''}`}>
          {snapshots.length === 0 ? (
            <div className="cv-empty">
              <p>No chart snapshots yet</p>
              <p className="cv-empty-hint">Capture your first chart to get started</p>
            </div>
          ) : (
            snapshots.map(snap => {
              const badge = STATUS_BADGES[snap.analysis_status] || STATUS_BADGES.pending;
              return (
                <div
                  key={snap.id}
                  className={`cv-card ${selectedSnap?.id === snap.id ? 'cv-card-active' : ''}`}
                  onClick={() => handleSelectSnap(snap)}
                >
                  <div className="cv-card-img-wrapper">
                    <img src={snap.image_url} alt={`Chart ${snap.id}`} loading="lazy" />
                    <span className="cv-card-badge" style={{ background: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="cv-card-info">
                    <div className="cv-card-top">
                      <span className="cv-card-symbol">{snap.symbol || 'Unknown'}</span>
                      <span className="cv-card-tf">{snap.timeframe || '—'}</span>
                    </div>
                    <div className="cv-card-date">
                      {new Date(snap.timestamp).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                    {snap.context && <div className="cv-card-context">{snap.context}</div>}
                  </div>
                  <div className="cv-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="cv-card-action-btn" onClick={() => handleReanalyze(snap.id)} title="Re-analyze">🔄</button>
                    <button className="cv-card-action-btn cv-card-action-delete" onClick={() => handleDelete(snap.id)} title="Delete">🗑️</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        {selectedSnap && (
          <div className="cv-detail">
            <div className="cv-detail-header">
              <h3>{selectedSnap.symbol || 'Chart'} {selectedSnap.timeframe || ''}</h3>
              <button className="cv-btn cv-btn-ghost cv-btn-sm" onClick={() => setSelectedSnap(null)}>✕</button>
            </div>

            <img src={selectedSnap.image_url} alt="Chart detail" className="cv-detail-image" />

            <div className="cv-detail-meta">
              <span>{new Date(selectedSnap.timestamp).toLocaleString()}</span>
              {selectedSnap.context && <span className="cv-detail-context">"{selectedSnap.context}"</span>}
            </div>

            {selectedSnap.analysis_status === 'done' ? (
              <div className="cv-analysis-results">
                {/* Trend + Grade Row */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {selectedSnap.trend_direction && (
                    <div className="cv-analysis-section" style={{ flex: 1, minWidth: '120px' }}>
                      <h4>📈 Trend</h4>
                      <span className={`cv-trend-badge cv-trend-${selectedSnap.trend_direction}`}>
                        {selectedSnap.trend_direction.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {selectedSnap.trade_setup && (
                    <div className="cv-analysis-section" style={{ flex: 2, minWidth: '200px' }}>
                      <h4>⭐ Setup Grade</h4>
                      <p>{selectedSnap.trade_setup}</p>
                    </div>
                  )}
                </div>

                {/* SMC Analysis */}
                {selectedSnap.smc_analysis && Object.keys(selectedSnap.smc_analysis).length > 0 && (
                  <div className="cv-analysis-section cv-smc-block">
                    <h4>🏛️ Smart Money Analysis</h4>
                    {selectedSnap.smc_analysis.market_structure && (
                      <div className="cv-smc-item">
                        <span className="cv-smc-label">Market Structure</span>
                        <p>{selectedSnap.smc_analysis.market_structure}</p>
                      </div>
                    )}
                    {selectedSnap.smc_analysis.order_blocks && (
                      <div className="cv-smc-item">
                        <span className="cv-smc-label">Order Blocks</span>
                        {typeof selectedSnap.smc_analysis.order_blocks === 'string' ? (
                          <p>{selectedSnap.smc_analysis.order_blocks}</p>
                        ) : Array.isArray(selectedSnap.smc_analysis.order_blocks) ? (
                          selectedSnap.smc_analysis.order_blocks.map((ob, i) => (
                            <p key={i} className="cv-smc-point">
                              {typeof ob === 'string' ? ob : (
                                <>
                                  <span className={`cv-ob-type ${ob.type}`}>{ob.type?.toUpperCase()}</span>
                                  {ob.location} — <em>{ob.status}</em>
                                </>
                              )}
                            </p>
                          ))
                        ) : null}
                      </div>
                    )}
                    {selectedSnap.smc_analysis.fair_value_gaps && (
                      <div className="cv-smc-item">
                        <span className="cv-smc-label">Fair Value Gaps</span>
                        {typeof selectedSnap.smc_analysis.fair_value_gaps === 'string' ? (
                          <p>{selectedSnap.smc_analysis.fair_value_gaps}</p>
                        ) : Array.isArray(selectedSnap.smc_analysis.fair_value_gaps) ? (
                          selectedSnap.smc_analysis.fair_value_gaps.map((fvg, i) => (
                            <p key={i} className="cv-smc-point">
                              {typeof fvg === 'string' ? fvg : (
                                <>
                                  <span className={`cv-ob-type ${fvg.direction}`}>{fvg.direction?.toUpperCase()}</span>
                                  {fvg.location} — <em>{fvg.status}</em>
                                </>
                              )}
                            </p>
                          ))
                        ) : null}
                      </div>
                    )}
                    {selectedSnap.smc_analysis.liquidity_status && (
                      <div className="cv-smc-item">
                        <span className="cv-smc-label">Liquidity</span>
                        <p>{selectedSnap.smc_analysis.liquidity_status}</p>
                      </div>
                    )}
                    {selectedSnap.smc_analysis.inducement && (
                      <div className="cv-smc-item">
                        <span className="cv-smc-label">Inducement</span>
                        <p>{selectedSnap.smc_analysis.inducement}</p>
                      </div>
                    )}
                    {selectedSnap.smc_analysis.premium_discount && (
                      <div className="cv-smc-item">
                        <span className="cv-smc-label">Premium / Discount</span>
                        <p>{selectedSnap.smc_analysis.premium_discount}</p>
                      </div>
                    )}
                    {selectedSnap.smc_analysis.poi && (
                      <div className="cv-smc-item cv-poi-highlight">
                        <span className="cv-smc-label">🎯 Point of Interest</span>
                        <p>{selectedSnap.smc_analysis.poi}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Entry Improvement Coaching — THE MOST IMPORTANT SECTION */}
                {selectedSnap.entry_improvement && Object.keys(selectedSnap.entry_improvement).length > 0 && (
                  <div className="cv-analysis-section cv-entry-coach">
                    <h4>🎓 Entry Improvement Coach</h4>

                    {selectedSnap.entry_improvement.current_assessment && (
                      <div className="cv-coach-item">
                        <span className="cv-coach-label">📋 Assessment</span>
                        <p>{selectedSnap.entry_improvement.current_assessment}</p>
                      </div>
                    )}

                    {selectedSnap.entry_improvement.what_to_wait_for?.length > 0 && (
                      <div className="cv-coach-item cv-wait-for">
                        <span className="cv-coach-label">⏳ What To Wait For</span>
                        <ol className="cv-wait-list">
                          {selectedSnap.entry_improvement.what_to_wait_for.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {selectedSnap.entry_improvement.perfect_entry_description && (
                      <div className="cv-coach-item cv-perfect-entry">
                        <span className="cv-coach-label">💎 Perfect Entry</span>
                        <p>{selectedSnap.entry_improvement.perfect_entry_description}</p>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {selectedSnap.entry_improvement.stop_loss_placement && (
                        <div className="cv-coach-item" style={{ flex: 1, minWidth: '180px' }}>
                          <span className="cv-coach-label">🛡️ Stop Loss</span>
                          <p>{selectedSnap.entry_improvement.stop_loss_placement}</p>
                        </div>
                      )}
                      {selectedSnap.entry_improvement.risk_reward_estimate && (
                        <div className="cv-coach-item" style={{ flex: 1, minWidth: '120px' }}>
                          <span className="cv-coach-label">📐 R:R</span>
                          <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedSnap.entry_improvement.risk_reward_estimate}</p>
                        </div>
                      )}
                    </div>

                    {selectedSnap.entry_improvement.take_profit_targets?.length > 0 && (
                      <div className="cv-coach-item">
                        <span className="cv-coach-label">🎯 Take Profit Targets</span>
                        <ul className="cv-tp-list">
                          {selectedSnap.entry_improvement.take_profit_targets.map((tp, i) => (
                            <li key={i}>{tp}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedSnap.entry_improvement.mistakes_to_avoid?.length > 0 && (
                      <div className="cv-coach-item cv-mistakes">
                        <span className="cv-coach-label">⚠️ Mistakes To Avoid</span>
                        <ul>
                          {selectedSnap.entry_improvement.mistakes_to_avoid.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Confluences */}
                {(selectedSnap.confluences_present?.length > 0 || selectedSnap.confluences_missing?.length > 0) && (
                  <div className="cv-analysis-section">
                    <h4>🔗 Confluence Check</h4>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {selectedSnap.confluences_present?.length > 0 && (
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <div className="cv-badge-list">
                            {selectedSnap.confluences_present.map((c, i) => (
                              <span key={i} className="cv-pattern-badge cv-confluence-present">✓ {c.replace(/_/g, ' ')}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedSnap.confluences_missing?.length > 0 && (
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <div className="cv-badge-list">
                            {selectedSnap.confluences_missing.map((c, i) => (
                              <span key={i} className="cv-pattern-badge cv-confluence-missing">✗ {c.replace(/_/g, ' ')}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Patterns */}
                {selectedSnap.chart_patterns?.length > 0 && (
                  <div className="cv-analysis-section">
                    <h4>🔍 Chart Patterns</h4>
                    <div className="cv-badge-list">
                      {selectedSnap.chart_patterns.map((p, i) => (
                        <span key={i} className="cv-pattern-badge">{p.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Candlestick Patterns */}
                {selectedSnap.candlestick_patterns?.length > 0 && (
                  <div className="cv-analysis-section">
                    <h4>🕯️ Candlestick Patterns</h4>
                    <div className="cv-badge-list">
                      {selectedSnap.candlestick_patterns.map((p, i) => (
                        <span key={i} className="cv-pattern-badge">{p.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Annotations */}
                {selectedSnap.annotations_detected?.length > 0 && (
                  <div className="cv-analysis-section">
                    <h4>✏️ Annotations Detected</h4>
                    <div className="cv-badge-list">
                      {selectedSnap.annotations_detected.map((a, i) => (
                        <span key={i} className="cv-annotation-badge">{a.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* S/R Levels */}
                {selectedSnap.support_resistance?.length > 0 && (
                  <div className="cv-analysis-section">
                    <h4>📊 Support / Resistance</h4>
                    <div className="cv-sr-list">
                      {selectedSnap.support_resistance.map((sr, i) => (
                        <div key={i} className={`cv-sr-item cv-sr-${sr.type}`}>
                          <span className="cv-sr-type">{sr.type}</span>
                          <span className="cv-sr-level">{sr.level}</span>
                          {sr.strength && <span className="cv-sr-strength">{sr.strength}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Action */}
                {selectedSnap.price_action && (
                  <div className="cv-analysis-section">
                    <h4>📝 Price Action Analysis</h4>
                    <p className="cv-price-action">{selectedSnap.price_action}</p>
                  </div>
                )}

                {/* Risk Assessment */}
                {selectedSnap.risk_assessment && (
                  <div className="cv-analysis-section">
                    <h4>⚖️ Risk Assessment</h4>
                    <p className="cv-price-action">{selectedSnap.risk_assessment}</p>
                  </div>
                )}
              </div>
            ) : selectedSnap.analysis_status === 'processing' ? (
              <div className="cv-analysis-pending">
                <div className="cv-spinner" />
                <p>Vision AI is analyzing this chart...</p>
              </div>
            ) : selectedSnap.analysis_status === 'error' ? (
              <div className="cv-analysis-error">
                <p>❌ Analysis failed</p>
                <p className="cv-error-detail">{selectedSnap.full_analysis}</p>
                <button className="cv-btn cv-btn-outline" onClick={() => handleReanalyze(selectedSnap.id)}>
                  🔄 Retry Analysis
                </button>
              </div>
            ) : (
              <div className="cv-analysis-pending">
                <p>Analysis pending...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
