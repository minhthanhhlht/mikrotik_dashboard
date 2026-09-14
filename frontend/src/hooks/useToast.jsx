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

      setToasts((prev) => [...prev.slice(-4), newToast]);

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
      {/* Toast Overlay Container - Z-Index 9999 */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-5 top-5 z-[9999] flex max-h-screen w-full max-w-sm flex-col gap-2.5"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const iconColor = isSuccess
            ? 'var(--green)'
            : isError
            ? 'var(--red)'
            : isWarning
            ? 'var(--amber)'
            : 'var(--accent-bright)';

          const iconSymbol = isSuccess ? '✓' : isError ? '✕' : isWarning ? '!' : 'ℹ';

          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-2)] p-3.5 shadow-[var(--shadow-lg)] backdrop-blur-md transition-all duration-200"
              role="alert"
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] font-mono font-bold text-xs"
                style={{
                  color: iconColor,
                  background: isSuccess
                    ? 'var(--green-bg)'
                    : isError
                    ? 'var(--red-bg)'
                    : isWarning
                    ? 'var(--amber-bg)'
                    : 'var(--accent-bg)',
                }}
              >
                {iconSymbol}
              </div>

              <div className="flex-1 min-w-0">
                {t.title && (
                  <h4
                    className="text-xs font-mono font-bold uppercase tracking-wider"
                    style={{ color: iconColor }}
                  >
                    {t.title}
                  </h4>
                )}
                <p className="mt-0.5 text-xs text-[var(--text)] break-words leading-relaxed">
                  {t.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--text-faint)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                title="Đóng"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
