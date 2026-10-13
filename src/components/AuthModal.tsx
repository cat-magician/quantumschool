import { useEffect, useId, useRef } from 'react';
import { X, Atom } from 'lucide-react';
import YandexSignInButton from './YandexSignInButton';
import LoginPasswordForm from './LoginPasswordForm';
import { isYandexOAuthEnabled } from '../lib/yandexAuthConfig';
import { isLoginAuthEnabled } from '../lib/loginAuthConfig';
import { useTouchScrollLock } from '../hooks/useTouchScrollLock';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const yandex = isYandexOAuthEnabled();
  const loginPassword = isLoginAuthEnabled();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useTouchScrollLock(true);

  useEffect(() => {
    // Фокус в окно — для экранного диктора; клавиатуру на телефоне не вызывает.
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] bg-slate-950/80 sm:backdrop-blur-sm touch-pinch-zoom"
      onClick={onClose}
    >
      {/* Крестик — вне прокручиваемой части: форма длиннее экрана телефона,
          и раньше он уезжал вверх вместе с ней. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="max-h-[min(90dvh,calc(100vh-2rem))] overflow-y-auto overscroll-contain touch-pan-y touch-pinch-zoom scrollbar-site bg-slate-900 border border-white/10 rounded-3xl p-4 sm:p-8 shadow-2xl shadow-violet-900/20">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-violet-700 rounded-2xl flex items-center justify-center">
              <Atom className="w-7 h-7 text-white" />
            </div>
          </div>

          <h2 id={titleId} className="text-xl font-bold text-white text-center mb-1">Вход в личный кабинет</h2>
          <p className="text-slate-400 text-sm text-center mb-6">
            {yandex ? 'Через Яндекс ID или по логину' : 'По логину и паролю'}
          </p>

          {yandex && (
            <YandexSignInButton
              size="lg"
              label="Войти с Яндекс ID"
              errorClassName="text-rose-400"
            />
          )}

          {yandex && loginPassword && (
            <div className="flex items-center gap-3 my-6">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500 uppercase tracking-wide">или</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}

          <LoginPasswordForm tone="dark" onSuccess={onClose} />

          {!yandex && !loginPassword && (
            <p className="text-sm text-amber-400 text-center">
              Вход временно недоступен. Обратитесь к организаторам.
            </p>
          )}

          <p className="mt-6 text-center text-xs text-slate-500 leading-relaxed">
            Если аккаунта ещё нет, он создастся при первом входе через Яндекс ID
            или на вкладке «Регистрация».
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-2 right-2 w-11 h-11 rounded-xl bg-slate-900/90 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
