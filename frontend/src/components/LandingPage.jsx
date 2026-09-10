import { useState, useEffect } from 'react';

export function LandingPage({ onGetStarted }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-0, #0a0a0c)',
      color: 'var(--text-1, #e4e4e7)',
      fontFamily: "var(--font, 'Inter', sans-serif)",
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Animated background mesh */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 60% at 20% 10%, rgba(34,211,238,0.08) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(59,130,246,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 40% 40% at 50% 50%, rgba(139,92,246,0.04) 0%, transparent 60%)
        `,
      }} />

      {/* Floating particles */}
      <style>{`
        @keyframes float-particle { 0%,100% { transform: translateY(0) scale(1); opacity: 0.3; } 50% { transform: translateY(-30px) scale(1.2); opacity: 0.6; } }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 20px rgba(34,211,238,0.2); } 50% { box-shadow: 0 0 40px rgba(34,211,238,0.4); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-up-delay { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .landing-hero-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 32px rgba(34,211,238,0.3) !important; }
        .landing-secondary-btn:hover { background: var(--bg-3, #1a1a1e) !important; border-color: rgba(34,211,238,0.4) !important; }
        .feature-card:hover { transform: translateY(-4px) !important; border-color: rgba(34,211,238,0.3) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important; }
      `}</style>

      {/* Nav */}
      <nav style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 700, color: '#fff',
            fontFamily: "var(--mono, 'JetBrains Mono', monospace)",
          }}>TJ</div>
          <span style={{
            fontSize: '18px', fontWeight: 700,
            fontFamily: "var(--font-display, 'Inter', sans-serif)",
            background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Trading Journal</span>
        </div>
        <button
          onClick={onGetStarted}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--text-1, #e4e4e7)',
            padding: '8px 24px', borderRadius: '8px',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            fontFamily: "var(--font, 'Inter', sans-serif)",
            transition: 'all 0.2s ease',
          }}
          className="landing-secondary-btn"
        >Sign In</button>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative', zIndex: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
        paddingTop: '80px', paddingBottom: '60px',
        maxWidth: '800px', margin: '0 auto',
        animation: visible ? 'slide-up 0.8s ease forwards' : 'none',
        opacity: visible ? 1 : 0,
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '20px',
          background: 'rgba(34,211,238,0.08)',
          border: '1px solid rgba(34,211,238,0.15)',
          fontSize: '12px', fontWeight: 500, color: '#22d3ee',
          fontFamily: "var(--mono, 'JetBrains Mono', monospace)",
          marginBottom: '28px',
          animation: 'pulse-glow 3s ease-in-out infinite',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee' }} />
          AI-Powered Trading Intelligence
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 5vw, 56px)',
          fontWeight: 800, lineHeight: 1.1,
          fontFamily: "var(--font-display, 'Inter', sans-serif)",
          margin: '0 0 20px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Master Your Trades.<br/>
          <span style={{
            background: 'linear-gradient(135deg, #22d3ee, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Elevate Your Edge.</span>
        </h1>

        <p style={{
          fontSize: '16px', lineHeight: 1.7,
          color: 'var(--text-2, #71717a)',
          maxWidth: '560px', margin: '0 0 36px 0',
          fontFamily: "var(--font, 'Inter', sans-serif)",
        }}>
          AI-powered trade analysis, real-time MT5 sync, discipline tracking,
          and actionable insights — all in one beautiful dashboard built for serious traders.
        </p>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={onGetStarted}
            className="landing-hero-btn"
            style={{
              background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
              border: 'none', color: '#fff',
              padding: '14px 36px', borderRadius: '10px',
              fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              fontFamily: "var(--font, 'Inter', sans-serif)",
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 20px rgba(34,211,238,0.2)',
            }}
          >Get Started — It's Free</button>
          <button
            onClick={onGetStarted}
            className="landing-secondary-btn"
            style={{
              background: 'var(--bg-2, #131316)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-1, #e4e4e7)',
              padding: '14px 28px', borderRadius: '10px',
              fontSize: '15px', fontWeight: 500, cursor: 'pointer',
              fontFamily: "var(--font, 'Inter', sans-serif)",
              transition: 'all 0.2s ease',
            }}
          >Sign In →</button>
        </div>
      </section>

      {/* Features */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '1000px', margin: '0 auto',
        padding: '40px 40px 80px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
        animation: visible ? 'slide-up-delay 1s ease 0.3s forwards' : 'none',
        opacity: visible ? 1 : 0,
      }}>
        {[
          { icon: '📊', title: 'Live MT5 Sync', desc: 'Real-time positions, P&L, and account data streamed directly from your MetaTrader 5 terminal.' },
          { icon: '🤖', title: 'AI Trade Analysis', desc: 'Get instant AI-powered analysis of every trade with pattern recognition and improvement suggestions.' },
          { icon: '🛡️', title: 'Discipline Engine', desc: 'Automated rule enforcement — max trades, lot sizes, session limits, and risk management in real-time.' },
          { icon: '📈', title: 'Performance Analytics', desc: 'Win rate, profit factor, drawdowns, streaks — deep analytics to find your edge and eliminate weaknesses.' },
          { icon: '🔒', title: 'MT5 Access Control', desc: 'Lock your terminal when rules are broken. Force discipline with automated trading restrictions.' },
          { icon: '📸', title: 'Chart Vision AI', desc: 'Upload chart screenshots and get AI analysis of patterns, support/resistance, and trade setups.' },
        ].map((f, i) => (
          <div key={i} className="feature-card" style={{
            background: 'var(--bg-2, #131316)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            padding: '28px',
            transition: 'all 0.3s ease',
            cursor: 'default',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '14px' }}>{f.icon}</div>
            <h3 style={{
              fontSize: '15px', fontWeight: 700, margin: '0 0 8px 0',
              fontFamily: "var(--font-display, 'Inter', sans-serif)",
              color: 'var(--text-1, #e4e4e7)',
            }}>{f.title}</h3>
            <p style={{
              fontSize: '13px', lineHeight: 1.6, margin: 0,
              color: 'var(--text-2, #71717a)',
              fontFamily: "var(--font, 'Inter', sans-serif)",
            }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 5,
        textAlign: 'center', padding: '30px 40px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: '12px', color: 'var(--text-3, #52525b)',
        fontFamily: "var(--mono, 'JetBrains Mono', monospace)",
      }}>
        AI-Powered Trading Journal &middot; Built for Serious Traders
      </footer>
    </div>
  );
}
