export default function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary shadow-[0_0_12px_rgba(0,132,255,0.5)]" />
      </div>
      {label && <p className="text-sm font-medium text-ink-soft">{label}</p>}
    </div>
  );
}