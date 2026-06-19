import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ToastVariant = 'info' | 'warning' | 'error' | 'success';

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type AppDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, variant?: ToastVariant) => void;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setConfirmState({ ...options, resolve });
  }), []);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4500),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts]);

  return (
    <AppDialogContext.Provider value={{ confirm, toast }}>
      {children}

      {confirmState && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                confirmState.danger ? 'bg-rose-500/15 text-rose-400' : 'bg-blue-500/15 text-blue-400'
              }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white">{confirmState.title}</h3>
                {confirmState.message && (
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">{confirmState.message}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors"
              >
                {confirmState.cancelLabel ?? 'Отмена'}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  confirmState.danger
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {confirmState.confirmLabel ?? 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 w-[min(100%,24rem)] px-4 pointer-events-none">
        {toasts.map((t) => (
          <ToastBanner
            key={t.id}
            message={t.message}
            variant={t.variant}
            onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </AppDialogContext.Provider>
  );
}

function ToastBanner({
  message, variant, onClose,
}: {
  message: string;
  variant: ToastVariant;
  onClose: () => void;
}) {
  const styles: Record<ToastVariant, { box: string; icon: typeof Info }> = {
    info: { box: 'bg-slate-800 border-white/10 text-slate-200', icon: Info },
    warning: { box: 'bg-amber-950/95 border-amber-500/30 text-amber-100', icon: AlertTriangle },
    error: { box: 'bg-rose-950/95 border-rose-500/30 text-rose-100', icon: AlertTriangle },
    success: { box: 'bg-emerald-950/95 border-emerald-500/30 text-emerald-100', icon: CheckCircle },
  };
  const { box, icon: Icon } = styles[variant];

  return (
    <div className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md animate-fade-in ${box}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <p className="text-sm leading-relaxed flex-1">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-white/10 text-current/70 transition-colors flex-shrink-0"
        aria-label="Закрыть"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error('useAppDialog must be used within AppDialogProvider');
  }
  return ctx;
}
