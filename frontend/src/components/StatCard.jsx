/**
 * StatCard — io.net metric card.
 * Gradient top-bar, Outfit display number, JetBrains Mono subtitle.
 */
export function StatCard({ title, value, subtitle, type = 'neutral' }) {
  return (
    <div
      className={`card stat-card ${type}`}
      id={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <div className={`card-value ${type}`}>{value}</div>
      {subtitle && <div className="card-subtitle">{subtitle}</div>}
    </div>
  );
}
