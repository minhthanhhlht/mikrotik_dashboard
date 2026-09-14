export default function StatCard({ label, value, sub, icon, accent = 'accent' }) {
  const accentColors = {
    accent: 'text-[var(--accent-bright)] bg-[var(--accent-bg)] border-[var(--accent-dim)]',
    cyan: 'text-[var(--cyan)] bg-[var(--cyan-bg)] border-[rgba(73,199,240,0.3)]',
    magenta: 'text-[var(--violet)] bg-[var(--violet-bg)] border-[rgba(176,123,245,0.3)]',
    violet: 'text-[var(--violet)] bg-[var(--violet-bg)] border-[rgba(176,123,245,0.3)]',
    amber: 'text-[var(--amber)] bg-[var(--amber-bg)] border-[rgba(245,185,69,0.3)]',
    green: 'text-[var(--green)] bg-[var(--green-bg)] border-[rgba(61,220,151,0.3)]',
  };

  const currentAccent = accentColors[accent] || accentColors.accent;

  return (
    <div className="sk-kpi">
      <div className="sk-kpi__header">
        <span className="sk-kpi__label">{label}</span>
        <span className={`sk-kpi__icon ${currentAccent}`}>
          {icon}
        </span>
      </div>
      <div className="sk-kpi__value">{value ?? '—'}</div>
      {sub && (
        <div className="sk-kpi__sub font-mono truncate">{sub}</div>
      )}
    </div>
  );
}