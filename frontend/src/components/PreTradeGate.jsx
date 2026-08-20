/**
 * PreTradeGate.jsx
 * A modal that intercepts before taking a trade.
 * 3 questions: setup, stop loss, emotional state (mood 1-5).
 * Cannot be skipped. Mood < 3 logs a warning flag.
 */
import { useState } from 'react';
import { api } from '../api';

const MOOD_LABELS = ['', '😰 Very Anxious', '😟 Anxious', '😐 Neutral', '😊 Confident', '🔥 In the Zone'];
const MOOD_COLORS = ['', '#F43F5E', '#FB923C', '#FACC15', '#4ADE80', '#00D9A3'];

export function PreTradeGate({ onSubmit, onCancel }) {
  const [setup, setSetup] = useState('');
  const [stopLevel, setStopLevel] = useState('');
  const [mood, setMood] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // 30-second minimum wait
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const canSubmit = setup.trim().length > 3 && stopLevel.trim().length > 2 && countdown <= 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const entry = await api.logPreTrade({ setup, stop_level: stopLevel, mood });
      onSubmit(entry, mood < 3);
    } catch {
      onSubmit({}, false); // don't block on API error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(8, 10, 18, 0.95)',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '36px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'fadeSlideIn 0.25s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          }}>🔍</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-0)' }}>Pre-Trade Gate</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-2)' }}>Answer before the trade opens · breaks impulsive reflex</p>
          </div>
          {/* Countdown badge */}
          {countdown > 0 && (
            <div style={{
              marginLeft: 'auto',
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '20px', padding: '4px 14px',
              fontSize: '0.82rem', fontWeight: 700, color: '#818CF8',
              fontFamily: 'var(--mono)',
            }}>{countdown}s</div>
          )}
        </div>

        {/* Q1 — Setup */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            1. What is the setup?
          </label>
          <input
            type="text"
            value={setup}
            onChange={e => setSetup(e.target.value)}
            placeholder="e.g. Asia range breakout at key support level"
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text-0)', fontSize: '0.88rem',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Q2 — Stop Loss */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            2. Where is the stop loss?
          </label>
          <input
            type="text"
            value={stopLevel}
            onChange={e => setStopLevel(e.target.value)}
            placeholder="e.g. Below 1.0850 support / -15 pips"
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text-0)', fontSize: '0.88rem',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Q3 — Mood */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            3. Current emotional state: <span style={{ color: MOOD_COLORS[mood], fontFamily: 'var(--mono)' }}>{mood}/5</span>
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setMood(n)}
                style={{
                  flex: 1, padding: '10px 4px',
                  borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: mood === n ? MOOD_COLORS[n] + '20' : 'var(--bg-2)',
                  border: `1px solid ${mood === n ? MOOD_COLORS[n] : 'var(--border)'}`,
                  color: mood === n ? MOOD_COLORS[n] : 'var(--text-2)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-2)', textAlign: 'center' }}>
            {MOOD_LABELS[mood]}
          </p>
          {mood < 3 && (
            <div style={{
              marginTop: '10px', padding: '10px 12px',
              background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)',
              borderRadius: '8px', fontSize: '0.82rem', color: '#FB923C',
            }}>
              ⚠️ Low emotional state flagged — trade is not blocked but this will be logged.
              Consider sitting this one out.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ padding: '10px 20px' }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            style={{ flex: 1 }}
          >
            {submitting ? 'Logging...' : countdown > 0 ? `Wait ${countdown}s…` : '✅ Proceed to Trade'}
          </button>
        </div>
      </div>
    </div>
  );
}
