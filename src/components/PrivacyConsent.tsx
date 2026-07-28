import { Link } from 'react-router-dom';

interface PrivacyConsentProps {
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  error?: string;
  variant?: 'light' | 'dark';
}

export default function PrivacyConsent({
  consent,
  onConsentChange,
  error,
  variant = 'light',
}: PrivacyConsentProps) {
  const isDark = variant === 'dark';

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsentChange(e.target.checked)}
          className={`mt-1 w-4 h-4 rounded focus:ring-blue-500/30 ${
            isDark
              ? 'border-white/20 bg-white/5 text-violet-500'
              : 'border-slate-300 text-blue-600 focus:ring-blue-500/30'
          }`}
          required
        />
        <span className={`text-sm leading-relaxed transition-colors ${
          isDark
            ? 'text-slate-400 group-hover:text-slate-300'
            : 'text-slate-600 group-hover:text-slate-800'
        }`}>
          Я даю{' '}
          <Link
            to="/privacy"
            target="_blank"
            className={`font-medium underline ${
              isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            согласие на обработку персональных данных
          </Link>
          {' '}в соответствии с{' '}
          <Link
            to="/privacy"
            target="_blank"
            className={`font-medium underline ${
              isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            Политикой конфиденциальности
          </Link>
          . *
        </span>
      </label>

      {error && (
        <p className={`text-sm ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>{error}</p>
      )}
    </div>
  );
}
