const ACCENTS = {
  cyan: 'from-primary to-[#7cc4ff] shadow-[0_0_22px_rgba(0,132,255,0.45)]',
  magenta: 'from-secondary to-[#f472b6] shadow-[0_0_22px_rgba(217,70,239,0.4)]',
  violet: 'from-tertiary to-[#a78bfa] shadow-[0_0_22px_rgba(124,58,237,0.4)]',
  amber: 'from-warning to-[#f59e0b] shadow-[0_0_22px_rgba(217,119,6,0.4)]',
};

export default function StatCard({ label, value, sub, icon, accent = 'cyan' }) {
  return (
    <div className="glass glass-glow rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${ACCENTS[accent] || ACCENTS.cyan}`}
        >
          {icon}
        </span>
      </div>
      <div className="data-display mt-2.5">{value ?? '—'}</div>
      {sub && (
        <p className="mt-1 truncate text-xs font-medium text-ink-faint">{sub}</p>
      )}
    </div>
  );
}