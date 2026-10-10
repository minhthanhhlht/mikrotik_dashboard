export default function StatCard({
  label,
  title,
  value,
  sub,
  subtitle,
  icon,
  badge,
  badgeVariant = 'default',
  accent = 'accent',
}) {
  const cardLabel = label || title || '';
  const cardSub = sub || subtitle || '';

  const accentColors = {
    accent: 'text-[var(--accent-bright)] bg-[var(--accent-bg)] border-[var(--accent-dim)]',
    cyan: 'text-[var(--cyan)] bg-[var(--cyan-bg)] border-[rgba(73,199,240,0.3)]',
    magenta: 'text-[var(--violet)] bg-[var(--violet-bg)] border-[rgba(176,123,245,0.3)]',
    violet: 'text-[var(--violet)] bg-[var(--violet-bg)] border-[rgba(176,123,245,0.3)]',
    amber: 'text-[var(--amber)] bg-[var(--amber-bg)] border-[rgba(245,185,69,0.3)]',
    green: 'text-[var(--green)] bg-[var(--green-bg)] border-[rgba(61,220,151,0.3)]',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  };

  const badgeStyles = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    default: 'bg-[var(--surface-3)] text-[var(--text-dim)] border-[var(--border)]',
  };

  const currentAccent = accentColors[accent] || accentColors.accent;
  const currentBadge = badgeStyles[badgeVariant] || badgeStyles.default;

  return (
    <div className="sk-kpi">
      <div className="sk-kpi__header">
        <div className="flex items-center gap-2 min-w-0">
          <span className="sk-kpi__label truncate">{cardLabel}</span>
          {badge && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold shrink-0 ${currentBadge}`}>
              {badge}
            </span>
          )}
        </div>
        {icon && (
          <span className={`sk-kpi__icon ${currentAccent} shrink-0`}>
            {icon}
          </span>
        )}
      </div>
      <div className="sk-kpi__value">{value ?? '—'}</div>
      {cardSub && (
        <div className="sk-kpi__sub font-mono truncate">{cardSub}</div>
      )}
    </div>
  );
}