/**
 * ScoreGauge — io.net neon arc gauge.
 * Thicker stroke, color-matched drop-shadow glow, Outfit display value.
 */
export function ScoreGauge({ score = 0 }) {
  const tier  = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs Work' : 'Critical';

  const radius       = 54;
  const circumference = 2 * Math.PI * radius;
  const offset       = circumference - (score / 100) * circumference;

  return (
    <div className={`score-gauge score-${tier}`} id="discipline-score">
      <svg viewBox="0 0 140 140">
        <circle className="gauge-bg"   cx="70" cy="70" r={radius} />
        <circle
          className="gauge-fill"
          cx="70" cy="70" r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-value">{score}</div>
      <div className="score-label">{label}</div>
    </div>
  );
}
