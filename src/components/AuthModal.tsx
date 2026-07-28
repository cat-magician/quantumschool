import { X, Atom } from 'lucide-react';
import YandexSignInButton from './YandexSignInButton';
import { isYandexOAuthEnabled } from '../lib/yandexAuthConfig';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] overflow-y-auto scrollbar-site bg-slate-900 border border-white/10 rounded-3xl p-4 sm:p-8 shadow-2xl shadow-violet-900/20 my-auto"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-violet-700 rounded-2xl flex items-center justify-center">
            <Atom className="w-7 h-7 text-white" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-1">Вход в личный кабинет</h2>
        <p className="text-slate-400 text-sm text-center mb-6">Через Яндекс ID</p>

        {isYandexOAuthEnabled() ? (
          <YandexSignInButton
            size="lg"
            label="Войти с Яндекс ID"
            errorClassName="text-rose-400"
          />
        ) : (
          <p className="text-sm text-amber-400 text-center">
            Вход через Яндекс ID временно недоступен. Обратитесь к организаторам.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-500 leading-relaxed">
          Если аккаунта ещё нет, он создастся при первом входе.
        </p>
      </div>
    </div>
  );
}
