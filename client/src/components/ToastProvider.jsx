import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext } from '../context/ToastContext';
import { normalizeApiError } from '../api/errors';

const TONES = {
  success: {
    icon: CheckCircle2,
    shell: 'border-green-200 bg-white',
    accent: 'text-green-600',
    bar: 'bg-green-500',
  },
  error: {
    icon: AlertCircle,
    shell: 'border-red-200 bg-white',
    accent: 'text-red-600',
    bar: 'bg-red-500',
  },
  info: {
    icon: Info,
    shell: 'border-slate-200 bg-white',
    accent: 'text-[#0d3b5c]',
    bar: 'bg-[#0d3b5c]',
  },
};

let nextToastId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ tone = 'info', title, message, reference = null, duration }) => {
      const id = nextToastId;
      nextToastId += 1;
      const ttl = duration ?? (tone === 'error' ? 9000 : 5500);

      setToasts((current) => [
        ...current.slice(-3),
        { id, tone, title: title || message, message: title ? message : null, reference },
      ]);

      if (ttl > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), ttl),
        );
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const toast = useMemo(
    () => ({
      show,
      success: (message, options = {}) => show({ ...options, tone: 'success', message }),
      info: (message, options = {}) => show({ ...options, tone: 'info', message }),
      error: (error, fallback = 'Something went wrong. Please try again.', options = {}) => {
        const apiError = normalizeApiError(error, fallback);
        return show({
          ...options,
          tone: 'error',
          title: apiError.message,
          message: null,
          reference: apiError.reference,
        });
      },
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-20 z-[1200] flex flex-col items-center gap-3 sm:inset-x-auto sm:right-6 sm:items-end"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toastItem) => {
          const tone = TONES[toastItem.tone] ?? TONES.info;
          const Icon = tone.icon;
          return (
            <div
              key={toastItem.id}
              role={toastItem.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border shadow-lg animate-fade-up ${tone.shell}`}
            >
              <div className="flex items-start gap-3 p-4">
                <Icon size={20} className={`mt-0.5 shrink-0 ${tone.accent}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{toastItem.title}</p>
                  {toastItem.message && (
                    <p className="mt-0.5 text-sm text-slate-600">{toastItem.message}</p>
                  )}
                  {toastItem.reference && (
                    <p className="mt-1 text-xs text-slate-400">{toastItem.reference}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toastItem.id)}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </div>
              <div className={`h-0.5 w-full ${tone.bar}`} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
