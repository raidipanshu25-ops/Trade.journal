/**
 * PostTradeReflection.jsx
 * Appears within 60s of a trade closing.
 * 2 questions: followed entry plan? followed exit plan?
 * Optional 1-line note.
 */
import { useState, useEffect } from 'react';
import { api } from '../api';

export function PostTradeReflection({ trade, onSubmit, onSkip }) {
  const [followedEntry, setFollowedEntry] = useState(null);
  const [followedExit, setFollowedExit] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  // 60-second countdown
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          onSkip(); // auto-dismiss
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onSkip]);

  const canSubmit = followedEntry !== null && followedExit !== null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.logReflection({
        ticket: trade?.ticket || trade?.position_id || '',
        followed_entry: followedEntry,
        followed_exit: followedExit,
        note,
      });
      onSubmit({ followedEntry, followedExit, note });
    } catch {
      onSubmit({ followedEntry, followedExit, note });
    } finally {
      setSubmitting(false);
    }
  };

  const pnl = trade?.profit ?? 0;
  const pnlColor = pnl > 0 ? '#4ADE80' : pnl < 0 ? '#F43F5E' : '#FACC15';
  const progressPct = (secondsLeft / 60) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9997,
      background: 'rgba(8, 10, 18, 0.92)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '36px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'fadeSlideIn 0.3s ease',
      }}>
        {/* Timer bar */}
        <div style={{
          height: '3px', background: 'var(--border)', borderRadius: '2px',
          marginBottom: '28px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            width: `${progressPct}%`,
            background: secondsLeft > 20 ? 'var(--cyan)' : '#FB923C',
            transition: 'width 1s linear, background 0.5s',
          }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #1E40AF, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          }}>📋</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-0)' }}>
              Post-Trade Reflection
            </h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-2)' }}>
              Trade just closed · reflection closes in {secondsLeft}s
            </p>
          </div>
        </div>

        {/* Trade Summary */}
        {trade && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '10px', padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Closed Trade</div>
              <div style={{ fontWeight: 600, color: 'var(--text-0)', fontSize: '0.9rem' }}>
                {trade.symbol || 'Unknown'} · {trade.type === 0 ? 'BUY' : 'SELL'} · {trade.volume || trade.lots}L
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>P&amp;L</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: pnlColor, fontFamily: 'var(--mono)' }}>
                {pnl >= 0 ? '+' : ''}{pnl?.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Q1 — Entry */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-0)' }}>
            Did you follow your <span style={{ color: 'var(--cyan)' }}>entry plan</span>?
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <YesNoButton active={followedEntry === true} positive onClick={() => setFollowedEntry(true)}>✅ Yes</YesNoButton>
            <YesNoButton active={followedEntry === false} positive={false} onClick={() => setFollowedEntry(false)}>❌ No</YesNoButton>
          </div>
        </div>

        {/* Q2 — Exit */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-0)' }}>
            Did you follow your <span style={{ color: 'var(--cyan)' }}>exit plan</span>?
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <YesNoButton active={followedExit === true} positive onClick={() => setFollowedExit(true)}>✅ Yes</YesNoButton>
            <YesNoButton active={followedExit === false} positive={false} onClick={() => setFollowedExit(false)}>❌ No</YesNoButton>
          </div>
        </div>

        {/* Optional Note */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: '6px' }}>
            One-line note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={120}
            placeholder="What happened? What will you do differently?"
            style={{
              width: '100%', padding: '9px 12px',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text-0)', fontSize: '0.85rem',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onSkip} style={{ padding: '10px 16px', fontSize: '0.82rem' }}>
            Skip
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            style={{ flex: 1 }}
          >
            {submitting ? 'Saving...' : 'Submit Reflection'}
          </button>
        </div>
      </div>
    </div>
  );
}

function YesNoButton({ children, active, positive, onClick }) {
  const activeColor = positive ? '#4ADE80' : '#F43F5E';
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px', borderRadius: '8px',
        fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
        transition: 'all 0.15s',
        background: active ? activeColor + '18' : 'var(--bg-2)',
        border: `1px solid ${active ? activeColor : 'var(--border)'}`,
        color: active ? activeColor : 'var(--text-2)',
      }}
    >
      {children}
    </button>
  );
}
