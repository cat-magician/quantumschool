import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { isYandexOAuthEnabled } from '../lib/yandexAuthConfig';

const SIZES = {
  md: {
    frame: 'h-12',
    label: 'text-[15px]',
    logo: 'w-7 h-7',
    spinner: 'w-5 h-5',
    radius: 'rounded-xl',
    gap: 'gap-3',
  },
  lg: {
    frame: 'h-[4.25rem]',
    label: 'text-[17px]',
    logo: 'w-10 h-10',
    spinner: 'w-6 h-6',
    radius: 'rounded-2xl',
    gap: 'gap-3.5',
  },
  xl: {
    frame: 'h-20',
    label: 'text-lg',
    logo: 'w-12 h-12',
    spinner: 'w-7 h-7',
    radius: 'rounded-2xl',
    gap: 'gap-4',
  },
} as const;

/** Логотип Яндекс ID — размер через className, без фиксированных width/height у svg. */
export function YandexIdLogo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 ${className}`}
      shapeRendering="geometricPrecision"
    >
      <circle cx="12" cy="12" r="12" fill="#FC3F1D" />
      <path
        fill="#fff"
        d="M13.32 6.5h-2.07c-1.96 0-3.12 1.07-3.12 2.74 0 1.52.82 2.35 2.27 3.32l-2.5 4.55h2.61l2.04-3.85h1.34v3.85h2.33V6.5h-2.8zm-.32 4.65h-1c-1.15 0-1.8-.66-1.8-1.71 0-1.02.63-1.59 1.77-1.59h1.03v3.3z"
      />
    </svg>
  );
}

export default function YandexSignInButton({
  label = 'Войти с Яндекс ID',
  disabled = false,
  teacherApplication = false,
  className = '',
  errorClassName = 'text-rose-600',
  size = 'md',
}: {
  label?: string;
  disabled?: boolean;
  teacherApplication?: boolean;
  className?: string;
  errorClassName?: string;
  size?: keyof typeof SIZES;
}) {
  const { signInWithYandex } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Возврат «назад» с Яндекса достаёт страницу из bfcache — снимаем ожидание,
  // иначе оверлей останется висеть поверх живой страницы. Хук до раннего
  // return: порядок хуков не должен зависеть от флага.
  useEffect(() => {
    const reset = () => setLoading(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  if (!isYandexOAuthEnabled()) return null;

  const handleClick = async () => {
    setError('');
    setLoading(true);

    const result = await signInWithYandex({ teacherApplication });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Успех: signInWithOAuth только запускает переход, браузер уходит с
    // страницы заметно позже. Ожидание не снимаем — иначе оверлей и спиннер
    // гаснут через миллисекунды, и всё оставшееся время кнопка выглядит
    // мёртвой, хотя переход идёт.
  };

  const s = SIZES[size];

  return (
    <div className={className}>
      {/*
        Пока браузер ждёт редирект Supabase на Яндекс, наша страница остаётся
        на экране. Если Auth отвечает медленно, ждать можно десятки секунд —
        лучше сказать об этом, чем оставить человека с замершей кнопкой.
      */}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6"
        >
          <div className="max-w-sm w-full text-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold mb-1.5">Открываем Яндекс ID</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Страница Яндекса может открыться не сразу — не нажимайте кнопку повторно.
            </p>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={`w-full ${s.frame} ${s.radius} px-6 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${s.gap} bg-white border border-black/10 hover:border-black/20 hover:bg-[#fafafa] text-black shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_28px_rgba(0,0,0,0.1)] active:scale-[0.99]`}
      >
        {loading ? (
          <Loader2 className={`${s.spinner} animate-spin text-slate-500`} />
        ) : (
          <YandexIdLogo className={s.logo} />
        )}
        <span className={`${s.label} leading-none tracking-tight`}>{label}</span>
      </button>
      {error && (
        <p className={`mt-2 text-sm ${errorClassName}`}>
          {error}
        </p>
      )}
    </div>
  );
}
