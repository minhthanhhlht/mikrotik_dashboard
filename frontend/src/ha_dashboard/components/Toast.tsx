interface ToastProps {
  message: string
}

/**
 * Toast thông báo kiểu Infra Console (Z-Index 9999)
 */
export default function Toast({ message }: ToastProps) {
  if (!message) return null

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div
        style={{
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--text)',
        }}
        className="flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-mono"
      >
        <span
          style={{ backgroundColor: 'var(--accent-bright)', boxShadow: '0 0 8px var(--accent-glow)' }}
          className="h-2 w-2 rounded-full flex-shrink-0 animate-pulse"
        />
        <span>{message}</span>
      </div>
    </div>
  )
}
