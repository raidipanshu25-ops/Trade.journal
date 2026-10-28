import { useState, useEffect } from 'react';

export function LandingPage({ onGetStarted }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'fundedfirm');
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const PRIMARY = '#01FFA6';
  const FONT = "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  const BODY = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  const MONO = "'JetBrains Mono', 'Fira Code', monospace";

  return (
    <div className="landing-page" style={{
      minHeight: '100vh',
      background: '#050508',
      color: '#ffffff',
      fontFamily: BODY,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes landing-fade-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landing-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes landing-glow-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.55; }
        }
        @keyframes landing-pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(1,255,166,0.5); }
          50% { box-shadow: 0 0 0 4px rgba(1,255,166,0); }
        }
        @keyframes landing-line-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .ff-nav-link {
          color: rgba(255,255,255,0.55);
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          padding: 8px 18px;
          border-radius: 999px;
          transition: all 0.2s ease;
          cursor: pointer;
          background: none;
          border: none;
          font-family: ${BODY};
          letter-spacing: 0;
        }
        .ff-nav-link:hover {
          color: #ffffff;
          background: rgba(255,255,255,0.06);
        }
        .ff-btn-primary {
          background: ${PRIMARY};
          color: #000000;
          border: none;
          padding: 14px 38px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: ${BODY};
          letter-spacing: -0.01em;
          box-shadow: 0 0 24px rgba(1,255,166,0.2);
          position: relative;
        }
        .ff-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(1,255,166,0.35), 0 8px 32px rgba(1,255,166,0.2);
        }
        .ff-btn-outline {
          background: transparent;
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.12);
          padding: 13px 34px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: ${BODY};
        }
        .ff-btn-outline:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.25);
          transform: translateY(-2px);
        }
        .ff-btn-pill {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 8px 20px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: ${BODY};
        }
        .ff-btn-pill:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.18);
          color: #ffffff;
        }
        .ff-feature-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 36px 30px;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: default;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }
        .ff-feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, ${PRIMARY}, transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .ff-feature-card:hover {
          transform: translateY(-4px);
          border-color: rgba(1,255,166,0.2);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 24px rgba(1,255,166,0.06);
        }
        .ff-feature-card:hover::before { opacity: 1; }
      `}</style>

      {/* ── Ambient glow effects ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-20%', right: '-5%',
          width: '700px', height: '700px',
          background: `radial-gradient(circle, rgba(1,255,166,0.05) 0%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'landing-glow-pulse 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-30%', left: '-10%',
          width: '800px', height: '800px',
          background: `radial-gradient(circle, rgba(1,255,166,0.03) 0%, transparent 70%)`,
          filter: 'blur(100px)',
          animation: 'landing-glow-pulse 8s ease-in-out infinite 2s',
        }} />
      </div>

      {/* ── Navigation ── */}
      <nav style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 56px',
        maxWidth: '1400px',
        margin: '0 auto',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease 0.1s',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Logo Icon */}
          <div style={{
            width: 42, height: 42, borderRadius: '12px',
            background: `linear-gradient(135deg, ${PRIMARY}, #00D98E)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 800, color: '#000',
            fontFamily: MONO,
            letterSpacing: '-1px',
            boxShadow: `0 0 20px rgba(1,255,166,0.15)`,
          }}>TJ</div>
          <div>
            <span style={{
              fontSize: '18px', fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.04em',
              fontFamily: FONT,
              textTransform: 'uppercase',
            }}>Trade<span style={{ color: PRIMARY }}>.</span>Journal</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="ff-nav-link">Features</button>
          <button className="ff-nav-link">Analytics</button>
          <button className="ff-nav-link">Rules</button>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 14px' }} />
          <button onClick={onGetStarted} className="ff-btn-pill">Login</button>
          <button onClick={onGetStarted} className="ff-btn-primary"
            style={{ padding: '10px 28px', fontSize: '13px' }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '100px 56px 50px',
        opacity: visible ? 1 : 0,
        animation: visible ? 'landing-fade-up 0.8s ease forwards' : 'none',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '7px 18px', borderRadius: '999px',
          background: `rgba(1,255,166,0.06)`,
          border: `1px solid rgba(1,255,166,0.15)`,
          fontSize: '11px', fontWeight: 600, color: PRIMARY,
          fontFamily: MONO,
          marginBottom: '36px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          backdropFilter: 'blur(20px)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: PRIMARY,
            animation: 'landing-pulse-dot 2s ease-in-out infinite',
          }} />
          AI-Powered Trading Journal
        </div>

        <h1 style={{
          fontSize: 'clamp(44px, 5.5vw, 72px)',
          fontWeight: 900,
          lineHeight: 1.05,
          margin: '0 0 28px 0',
          color: '#ffffff',
          letterSpacing: '-0.03em',
          fontFamily: FONT,
          maxWidth: '860px',
          textTransform: 'uppercase',
        }}>
          The Trading Journal<br />
          Built for{' '}
          <span style={{
            background: `linear-gradient(90deg, ${PRIMARY} 0%, #00D98E 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Serious Traders</span>
          <span style={{ color: PRIMARY }}>.</span>
        </h1>

        <p style={{
          fontSize: '18px', lineHeight: 1.7,
          color: 'rgba(255,255,255,0.5)',
          maxWidth: '620px',
          margin: '0 auto 44px auto',
          fontWeight: 400,
          fontFamily: BODY,
        }}>
          AI-powered analysis, real-time MT5 sync & discipline tracking.
          <br />Trade smarter. Stay disciplined. Grow consistently.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={onGetStarted} className="ff-btn-primary">
            Start Trading Journal
          </button>
          <button onClick={onGetStarted} className="ff-btn-outline">
            Login →
          </button>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '48px',
          marginTop: '72px',
          paddingTop: '36px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          {[
            { num: '29+', label: 'Trades Synced' },
            { num: '$4.9K', label: 'Account Balance' },
            { num: '24/7', label: 'AI Analysis' },
            { num: '100%', label: 'Discipline Score' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '32px', fontWeight: 800, color: '#ffffff',
                letterSpacing: '-0.02em',
                fontFamily: FONT,
              }}>{s.num}</div>
              <div style={{
                fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '2px',
                fontFamily: MONO,
                marginTop: '6px',
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dashboard Preview ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '960px', margin: '50px auto',
        padding: '0 56px',
        opacity: visible ? 1 : 0,
        animation: visible ? 'landing-fade-up 0.9s ease 0.2s forwards' : 'none',
      }}>
        <div style={{
          width: '100%',
          background: '#08080A',
          borderRadius: '24px',
          padding: '30px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 60px rgba(1,255,166,0.04)',
          animation: visible ? 'landing-float 6s ease-in-out infinite' : 'none',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* Mock header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '20px',
            paddingBottom: '14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <span style={{
              fontSize: '11px', color: 'rgba(255,255,255,0.25)',
              fontFamily: MONO,
              marginLeft: '8px',
            }}>Trade.Journal — Dashboard</span>
          </div>

          {/* Mock stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Account Balance', value: '$4,964.92', color: '#4ade80' },
              { label: 'Today\'s P&L', value: '+$12.47', color: '#4ade80' },
              { label: 'Win Rate', value: '41.4%', color: PRIMARY },
              { label: 'Risk / Reward', value: '1.84', color: PRIMARY },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
                padding: '18px',
              }}>
                <div style={{
                  fontSize: '10px', color: 'rgba(255,255,255,0.3)',
                  fontFamily: MONO,
                  textTransform: 'uppercase', letterSpacing: '1.5px',
                  marginBottom: '10px',
                }}>{s.label}</div>
                <div style={{
                  fontSize: '22px', fontWeight: 800, color: s.color,
                  letterSpacing: '-0.02em',
                  fontFamily: FONT,
                }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Mock chart */}
          <div style={{
            background: 'rgba(255,255,255,0.015)',
            borderRadius: '14px',
            padding: '18px',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.25)',
              fontFamily: MONO,
              textTransform: 'uppercase', letterSpacing: '1.5px',
              marginBottom: '14px',
            }}>Equity Curve</div>
            <svg viewBox="0 0 400 80" style={{ width: '100%', height: '60px' }}>
              <defs>
                <linearGradient id="ffChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,60 L30,55 L60,58 L90,45 L120,48 L150,35 L180,38 L210,25 L240,28 L270,18 L300,22 L330,12 L360,15 L400,8" fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" />
              <path d="M0,60 L30,55 L60,58 L90,45 L120,48 L150,35 L180,38 L210,25 L240,28 L270,18 L300,22 L330,12 L360,15 L400,8 L400,80 L0,80 Z" fill="url(#ffChartGrad)" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── WHAT MAKES US DIFFERENT (CONSOUL INDIA style) ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '1400px', margin: '0 auto',
        padding: '80px 56px 60px',
        opacity: visible ? 1 : 0,
        animation: visible ? 'landing-fade-up 0.9s ease 0.3s forwards' : 'none',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '80px',
          alignItems: 'start',
          marginBottom: '60px',
        }}>
          <h2 style={{
            fontSize: 'clamp(36px, 4vw, 56px)',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            fontFamily: FONT,
            textTransform: 'uppercase',
          }}>
            What Makes<br />Us Different
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.8,
            fontFamily: BODY,
            maxWidth: '480px',
            paddingTop: '8px',
          }}>
            We don't just track trades. We build discipline with AI, enforce your rules in real-time,
            and give you the psychology insights that prop firms use — so your capital stays protected.
          </p>
        </div>

        {/* Numbered feature cards (CONSOUL INDIA style) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
        }}>
          {[
            { num: '01', title: 'Live MT5 Sync', desc: 'Real-time positions, P&L, and account data streamed directly from your MetaTrader 5 terminal.' },
            { num: '02', title: 'AI Trade Coach', desc: 'Instant AI-powered analysis of every trade with pattern recognition and improvement suggestions.' },
            { num: '03', title: 'Discipline Engine', desc: 'Automated rule enforcement — max trades, lot sizes, session limits, and risk management in real-time.' },
            { num: '04', title: 'MT5 Access Control', desc: 'Lock your terminal when rules are broken. Force discipline with automated trading restrictions.' },
          ].map((f, i) => (
            <div key={i} className="ff-feature-card">
              <div style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.2)',
                fontFamily: MONO,
                fontWeight: 500,
                marginBottom: '20px',
                letterSpacing: '2px',
              }}>{f.num}</div>
              <h3 style={{
                fontSize: '17px', fontWeight: 800, margin: '0 0 12px 0',
                color: '#ffffff', letterSpacing: '-0.01em',
                fontFamily: FONT,
                textTransform: 'uppercase',
              }}>{f.title}</h3>
              <p style={{
                fontSize: '14px', lineHeight: 1.7, margin: 0,
                color: 'rgba(255,255,255,0.4)',
                fontFamily: BODY,
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '1400px', margin: '0 auto',
        padding: '40px 56px 80px',
        opacity: visible ? 1 : 0,
        animation: visible ? 'landing-fade-up 0.9s ease 0.5s forwards' : 'none',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <span style={{
            fontSize: '12px', fontWeight: 600, color: PRIMARY,
            textTransform: 'uppercase', letterSpacing: '2px',
            fontFamily: MONO,
            display: 'block', marginBottom: '14px',
          }}>Complete Trading Toolkit</span>
          <h2 style={{
            fontSize: '38px', fontWeight: 800, color: '#ffffff',
            letterSpacing: '-0.02em', marginBottom: '14px',
            fontFamily: FONT,
            textTransform: 'uppercase',
          }}>Everything You Need</h2>
          <p style={{
            fontSize: '16px', color: 'rgba(255,255,255,0.45)', maxWidth: '560px',
            margin: '0 auto', lineHeight: 1.7,
            fontFamily: BODY,
          }}>
            Professional-grade tools designed to help you analyze, improve, and master your trading performance.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}>
          {[
            { icon: '📊', title: 'Live MT5 Sync', desc: 'Real-time positions, P&L, and account data streamed directly from your MetaTrader 5 terminal.' },
            { icon: '🤖', title: 'AI Trade Analysis', desc: 'Get instant AI-powered analysis of every trade with pattern recognition and improvement suggestions.' },
            { icon: '🛡️', title: 'Discipline Engine', desc: 'Automated rule enforcement — max trades, lot sizes, session limits, and risk management in real-time.' },
            { icon: '📈', title: 'Performance Analytics', desc: 'Win rate, profit factor, drawdowns, streaks — deep analytics to find your edge and eliminate weaknesses.' },
            { icon: '🔒', title: 'MT5 Access Control', desc: 'Lock your terminal when rules are broken. Force discipline with automated trading restrictions.' },
            { icon: '📸', title: 'Chart Vision AI', desc: 'Upload chart screenshots and get AI analysis of patterns, support/resistance, and trade setups.' },
          ].map((f, i) => (
            <div key={i} className="ff-feature-card">
              <div style={{
                width: '50px', height: '50px', borderRadius: '14px',
                background: `rgba(1,255,166,0.06)`,
                border: `1px solid rgba(1,255,166,0.1)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', marginBottom: '22px',
              }}>{f.icon}</div>
              <h3 style={{
                fontSize: '16px', fontWeight: 700, margin: '0 0 10px 0',
                color: '#ffffff', letterSpacing: '-0.01em',
                fontFamily: FONT,
                textTransform: 'uppercase',
              }}>{f.title}</h3>
              <p style={{
                fontSize: '14px', lineHeight: 1.7, margin: 0,
                color: 'rgba(255,255,255,0.4)',
                fontFamily: BODY,
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '860px', margin: '0 auto',
        padding: '40px 56px 100px',
        textAlign: 'center',
      }}>
        <div style={{
          background: 'rgba(1,255,166,0.025)',
          border: '1px solid rgba(1,255,166,0.1)',
          borderRadius: '28px',
          padding: '64px 56px',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
            width: '400px', height: '400px',
            background: `radial-gradient(circle, rgba(1,255,166,0.06) 0%, transparent 70%)`,
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }} />
          <h2 style={{
            fontSize: '36px', fontWeight: 800, color: '#ffffff',
            letterSpacing: '-0.02em', marginBottom: '14px',
            fontFamily: FONT,
            position: 'relative',
            textTransform: 'uppercase',
          }}>Ready to Level Up?</h2>
          <p style={{
            fontSize: '16px', color: 'rgba(255,255,255,0.45)',
            marginBottom: '32px',
            fontFamily: BODY,
            position: 'relative',
          }}>Start tracking, analyzing, and improving your trades today.</p>
          <button
            onClick={onGetStarted}
            className="ff-btn-primary"
            style={{ fontSize: '16px', padding: '16px 44px', position: 'relative' }}
          >Start Free — No Credit Card Required</button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: 'relative', zIndex: 5,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '32px 56px',
      }}>
        <div style={{
          maxWidth: '1400px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '8px',
              background: `linear-gradient(135deg, ${PRIMARY}, #00D98E)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 800, color: '#000',
              fontFamily: MONO,
            }}>TJ</div>
            <span style={{
              fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.6)',
              fontFamily: FONT,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>Trade.Journal</span>
          </div>
          <span style={{
            fontSize: '12px', color: 'rgba(255,255,255,0.2)',
            fontFamily: MONO,
          }}>
            © 2025 Trade.Journal · Built for Serious Traders
          </span>
        </div>
      </footer>
    </div>
  );
}
