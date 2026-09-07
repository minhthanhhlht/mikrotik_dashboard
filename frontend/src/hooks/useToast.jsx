import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ message, type = 'success', title = '', duration = 3500 }) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newToast = { id, message, type, title, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Giữ tối đa 5 popup đồng thời

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
      return id;
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      show: addToast,
      success: (msg, title = 'Thành công') => addToast({ message: msg, type: 'success', title }),
      error: (msg, title = 'Thất bại') => addToast({ message: msg, type: 'error', title, duration: 4500 }),
      warning: (msg, title = 'Cảnh báo') => addToast({ message: msg, type: 'warning', title }),
      info: (msg, title = 'Thông tin') => addToast({ message: msg, type: 'info', title }),
      remove: removeToast,
    }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Overlay Container */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[9999] flex max-h-screen w-full max-w-sm flex-col gap-3"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const borderClass = isSuccess
            ? 'border-primary/40 bg-white/95 text-ink shadow-[0_10px_30px_rgba(0,132,255,0.22)]'
            : isError
            ? 'border-danger/40 bg-white/95 text-ink shadow-[0_10px_30px_rgba(225,29,72,0.22)]'
            : isWarning
            ? 'border-warning/40 bg-white/95 text-ink shadow-[0_10px_30px_rgba(217,119,6,0.22)]'
            : 'border-tertiary/40 bg-white/95 text-ink shadow-[0_10px_30px_rgba(124,58,237,0.22)]';

          const iconBg = isSuccess
            ? 'bg-gradient-to-br from-primary to-[#00a2ff] text-white shadow-[0_0_12px_rgba(0,132,255,0.6)]'
            : isError
            ? 'bg-gradient-to-br from-danger to-[#f43f5e] text-white shadow-[0_0_12px_rgba(225,29,72,0.6)]'
            : isWarning
            ? 'bg-gradient-to-br from-warning to-[#f59e0b] text-white shadow-[0_0_12px_rgba(217,119,6,0.6)]'
            : 'bg-gradient-to-br from-tertiary to-[#a855f7] text-white shadow-[0_0_12px_rgba(124,58,237,0.6)]';

          const titleColor = isSuccess
            ? 'text-primary'
            : isError
            ? 'text-danger'
            : isWarning
            ? 'text-warning'
            : 'text-tertiary';

          const iconSymbol = isSuccess ? '✓' : isError ? '✕' : isWarning ? '!' : 'ℹ';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 backdrop-blur-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${borderClass}`}
              role="alert"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${iconBg}`}
              >
                {iconSymbol}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                {t.title && (
                  <h4 className={`text-xs font-bold tracking-tight uppercase ${titleColor}`}>
                    {t.title}
                  </h4>
                )}
                <p className="mt-0.5 text-xs font-semibold text-ink break-words leading-relaxed">
                  {t.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 rounded-lg p-1 text-ink-faint transition hover:bg-ink/5 hover:text-ink"
                title="Đóng"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
