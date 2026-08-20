/**
 * MorningRitual.jsx
 * Shown as a full-screen overlay on first app open each day.
 * Trading is gated behind this ritual.
 */
import { useState, useEffect } from 'react';
import { api } from '../api';

const RITUAL_STEPS = [
  'review',    // review yesterday summary
  'intention', // set today's process intention
  'rules',     // tap each rule to confirm
];

export function MorningRitual({ onComplete, settings }) {
  const [step, setStep] = useState(0);
  const [intention, setIntention] = useState('');
  const [rulesConfirmed, setRulesConfirmed] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Derive rule list from settings
  const rules = buildRulesList(settings);

  const toggleRule = (r) => {
    setRulesConfirmed(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await api.completeRitual({ intention, rules_confirmed: rulesConfirmed });
      onComplete();
    } catch {
      onComplete(); // don't block trader if API fails
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(8, 10, 18, 0.97)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '580px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          }}>🌅</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-0)' }}>Morning Ritual</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-2)' }}>
              Complete to unlock trading for today · Step {step + 1} of {RITUAL_STEPS.length}
            </p>
          </div>
        </div>

        {/* Step Progress */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {RITUAL_STEPS.map((s, i) => (
            <div key={s} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: i <= step ? 'var(--cyan)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Step 1 — Review Yesterday */}
        {step === 0 && (
          <div>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-0)', fontSize: '1rem' }}>
              📋 Review Yesterday
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: 'var(--text-1)', lineHeight: 1.7 }}>
              Before you trade today, take 60 seconds to recall yesterday's session.
              What went well? What did you deviate from your plan?
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '16px',
              fontSize: '0.85rem',
              color: 'var(--text-2)',
              lineHeight: 1.7,
              marginBottom: '24px',
            }}>
              <strong style={{ color: 'var(--text-1)' }}>Remember:</strong> You are not reviewing P&amp;L.
              You are reviewing <span style={{ color: 'var(--cyan)' }}>process</span> — did you follow your plan?
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep(1)}>
              I've reviewed yesterday → Continue
            </button>
          </div>
        )}

        {/* Step 2 — Set Intention */}
        {step === 1 && (
          <div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-0)', fontSize: '1rem' }}>
              🎯 Set Your Process Intention
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
              Write ONE process goal for today — not "make money". Examples: "I will only take A+ setups" · "I will not enter without a clear stop loss"
            </p>
            <textarea
              value={intention}
              onChange={e => setIntention(e.target.value)}
              placeholder="Today I will..."
              style={{
                width: '100%', minHeight: '90px',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '12px',
                color: 'var(--text-0)', fontSize: '0.9rem', lineHeight: 1.6,
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button
                className="btn btn-primary" style={{ flex: 1 }}
                disabled={intention.trim().length < 5}
                onClick={() => setStep(2)}
              >
                Set intention → Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Confirm Rules */}
        {step === 2 && (
          <div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-0)', fontSize: '1rem' }}>
              ✅ Confirm Your Rules
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
              Tap each rule to confirm you commit to it today.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {rules.map(rule => {
                const confirmed = rulesConfirmed.includes(rule);
                return (
                  <button
                    key={rule}
                    onClick={() => toggleRule(rule)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '8px', textAlign: 'left',
                      background: confirmed ? 'rgba(0, 217, 163, 0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${confirmed ? 'var(--cyan)' : 'var(--border)'}`,
                      color: confirmed ? 'var(--cyan)' : 'var(--text-1)',
                      cursor: 'pointer', fontSize: '0.85rem', width: '100%',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{confirmed ? '✅' : '⬜'}</span>
                    {rule}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary" style={{ flex: 1 }}
                disabled={rulesConfirmed.length < rules.length || submitting}
                onClick={handleComplete}
              >
                {submitting ? 'Saving...' : `🔓 Unlock Trading for Today`}
              </button>
            </div>
            {rulesConfirmed.length < rules.length && (
              <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-3)' }}>
                Confirm all {rules.length} rules to continue
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function buildRulesList(settings) {
  if (!settings) return [
    'I will not exceed my max lot size',
    'I will respect my daily loss limit',
    'I will only trade during my defined sessions',
  ];
  const rules = [];
  if (settings.max_lot_size) rules.push(`Max lot size: ${settings.max_lot_size} lots`);
  if (settings.max_daily_loss_pct) rules.push(`Max daily loss: ${settings.max_daily_loss_pct}%`);
  Object.entries(settings.sessions || {}).forEach(([name, s]) => {
    if (s.enabled) rules.push(`Trade ${name} session only (${s.start}–${s.end}), max ${s.max_trades ?? 1} trade(s)`);
  });
  if (!rules.length) rules.push('Follow my trading plan');
  return rules;
}
