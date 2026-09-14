export default function Spinner({ label, size = 'md', className = '' }) {
  if (size === 'sm' || size === 'xs') {
    const dim = size === 'xs' ? 'h-3.5 w-3.5 border-2' : 'h-4 w-4 border-2';
    return (
      <span
        className={`inline-block shrink-0 rounded-full border-[var(--border-strong)] border-t-[var(--accent)] animate-spin ${dim} ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--border)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--accent)]" />
      </div>
      {label && <p className="text-xs font-mono text-[var(--text-dim)]">{label}</p>}
    </div>
  );
}