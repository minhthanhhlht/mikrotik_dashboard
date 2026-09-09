export default function Spinner({ label, size = 'md', className = '' }) {
  if (size === 'sm' || size === 'xs') {
    const dim = size === 'xs' ? 'h-3.5 w-3.5 border-2' : 'h-4 w-4 border-2';
    return (
      <span
        className={`inline-block shrink-0 rounded-full border-current/25 border-t-current animate-spin ${dim} ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary shadow-[0_0_12px_rgba(0,132,255,0.5)]" />
      </div>
      {label && <p className="text-sm font-medium text-ink-soft">{label}</p>}
    </div>
  );
}