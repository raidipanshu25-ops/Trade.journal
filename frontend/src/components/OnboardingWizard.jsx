import React, { useState, useEffect } from 'react';

export function OnboardingWizard({ syncToken, isConnected, onComplete, onSkip }) {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // If it becomes connected while on step 4, we stay on step 4 which now shows success
  }, [isConnected, step]);

  const handleCopyToken = () => {
    if (syncToken) {
      navigator.clipboard.writeText(syncToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const containerStyle = {
    maxWidth: '540px',
    margin: '60px auto',
    padding: '40px',
    background: 'var(--bg-1)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-elevated)',
    color: 'var(--text-0)',
    fontFamily: 'var(--font)',
    position: 'relative',
    overflow: 'hidden'
  };

  const titleStyle = {
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: '12px',
    textAlign: 'center',
    background: 'var(--gradient-brand)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px'
  };

  const subtitleStyle = {
    fontSize: '0.95rem',
    color: 'var(--text-2)',
    textAlign: 'center',
    marginBottom: '32px',
    lineHeight: 1.5,
  };

  const btnPrimaryStyle = {
    display: 'inline-block',
    width: '100%',
    padding: '12px',
    background: 'var(--cyan)',
    color: 'var(--bg-0)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
    boxShadow: 'var(--cyan-glow-sm)'
  };

  const btnSecondaryStyle = {
    ...btnPrimaryStyle,
    background: 'var(--bg-3)',
    color: 'var(--text-0)',
    border: '1px solid var(--border)',
    boxShadow: 'none'
  };

  const stepWrapperStyle = {
    animation: 'fadeSlideUp 0.4s ease-out forwards',
  };

  return (
    <>
      <style>
        {`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes wizardPulseCircle {
            0% { box-shadow: 0 0 0 0 var(--cyan-border); }
            70% { box-shadow: 0 0 0 15px transparent; }
            100% { box-shadow: 0 0 0 0 transparent; }
          }
        `}
      </style>
      <div style={containerStyle}>
        {step === 1 && (
          <div style={stepWrapperStyle}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '16px',
                background: 'var(--cyan-dim)', border: '1px solid var(--cyan-border)',
                margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                </svg>
              </div>
              <h1 style={titleStyle}>Welcome to Trading Journal</h1>
              <p style={subtitleStyle}>
                Connect your MetaTrader 5 to automatically sync and analyze your trades
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '40px' }}>
                <button style={btnPrimaryStyle} onClick={() => setStep(2)}>
                  Get Started
                </button>
                <button 
                  onClick={onSkip}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-2)', 
                    cursor: 'pointer', fontSize: '0.85rem', marginTop: '8px', padding: '8px'
                  }}
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={stepWrapperStyle}>
            <h2 style={{ ...titleStyle, fontSize: '1.4rem', background: 'none', WebkitTextFillColor: 'var(--text-0)' }}>
              Do you have MetaTrader 5 installed?
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '32px' }}>
              <div 
                style={{
                  padding: '24px 16px', background: 'var(--bg-2)', borderRadius: '12px', 
                  border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'center',
                  transition: 'border 0.2s',
                }}
                onClick={() => setStep(3)}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--cyan)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: '2rem', marginBottom: '16px' }}>💻</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Yes, I have MT5</div>
              </div>
              
              <div 
                style={{
                  padding: '24px 16px', background: 'var(--bg-2)', borderRadius: '12px', 
                  border: '1px solid var(--border)', textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⬇️</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px' }}>No, I need to download it</div>
                <a 
                  href="https://www.metatrader5.com/en/download" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ fontSize: '0.85rem', color: 'var(--cyan)', textDecoration: 'none', fontWeight: 500 }}
                >
                  Download MT5 ↗
                </a>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '12px', lineHeight: 1.4 }}>
                  Install it, login to your account, then click 'Yes' to continue.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setStep(1)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-2)', 
                cursor: 'pointer', fontSize: '0.85rem', marginTop: '24px', padding: 0
              }}
            >
              ← Back
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={stepWrapperStyle}>
            <h2 style={{ ...titleStyle, fontSize: '1.4rem', background: 'none', WebkitTextFillColor: 'var(--text-0)' }}>
              Download Connector
            </h2>
            
            <div style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px', marginTop: '24px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Your Sync Token</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={syncToken || ''} 
                  style={{
                    flex: 1, padding: '10px 12px', background: 'var(--bg-0)', border: '1px solid var(--border)', 
                    borderRadius: '6px', color: 'var(--text-0)', fontFamily: 'var(--mono)', fontSize: '0.85rem', outline: 'none'
                  }}
                />
                <button 
                  onClick={handleCopyToken}
                  style={{
                    padding: '0 16px', background: 'var(--cyan-dim)', color: 'var(--cyan)',
                    border: '1px solid var(--cyan-border)', borderRadius: '6px', cursor: 'pointer',
                    fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s'
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.88rem', color: 'var(--text-1)', lineHeight: 1.6, marginBottom: '32px' }}>
              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '16px', margin: 0 }}>
                <li>Install <strong>Python 3.11+</strong> from python.org</li>
                <li><a href="/connector.zip" style={{ color: 'var(--cyan)', fontWeight: 500, textDecoration: 'none' }}>Download the MT5 Connector files</a></li>
                <li>
                  Open a terminal and run:
                  <div style={{ background: 'var(--bg-0)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: '0.75rem', marginTop: '6px', color: 'var(--text-0)' }}>
                    pip install MetaTrader5 httpx websockets python-dotenv
                  </div>
                </li>
                <li>
                  Create a <code style={{ fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>.env</code> file in the connector folder with:
                  <div style={{ background: 'var(--bg-0)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: '0.75rem', marginTop: '6px', color: 'var(--text-0)', whiteSpace: 'pre-wrap' }}>
                    RENDER_BACKEND_URL=http://localhost:8000<br/>
                    SYNC_TOKEN={syncToken || 'YOUR_TOKEN'}
                  </div>
                </li>
                <li>
                  Run the script:
                  <div style={{ background: 'var(--bg-0)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: '0.75rem', marginTop: '6px', color: 'var(--text-0)' }}>
                    python local_sync_agent.py
                  </div>
                </li>
              </ol>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ ...btnSecondaryStyle, flex: 1 }} onClick={() => setStep(2)}>Back</button>
              <button style={{ ...btnPrimaryStyle, flex: 2 }} onClick={() => setStep(4)}>I'm running the script</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ ...stepWrapperStyle, textAlign: 'center', padding: '32px 0' }}>
            {!isConnected ? (
              <>
                <div 
                  style={{
                    width: '64px', height: '64px', borderRadius: '50%', background: 'var(--cyan-dim)',
                    border: '1px solid var(--cyan)', margin: '0 auto 32px',
                    animation: 'wizardPulseCircle 2s infinite', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--cyan)' }} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-0)' }}>Waiting for your MT5 connector...</h2>
                <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>Keep this page open. We'll automatically detect when data arrives.</p>
                
                <button 
                  onClick={() => setStep(3)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-2)', 
                    cursor: 'pointer', fontSize: '0.85rem', marginTop: '40px', padding: 0
                  }}
                >
                  ← Back to Instructions
                </button>
              </>
            ) : (
              <div style={stepWrapperStyle}>
                <div 
                  style={{
                    width: '64px', height: '64px', borderRadius: '50%', background: 'var(--green-dim)',
                    border: '1px solid var(--green-border)', margin: '0 auto 32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)',
                    boxShadow: 'var(--green-glow)'
                  }}
                >
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-0)' }}>Connection Successful!</h2>
                <p style={{ color: 'var(--text-2)', marginBottom: '40px', fontSize: '0.95rem' }}>Your MT5 data is now actively syncing in the background.</p>
                <button style={{ ...btnPrimaryStyle, background: 'var(--green)', color: '#000', boxShadow: 'var(--green-glow)' }} onClick={onComplete}>
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
