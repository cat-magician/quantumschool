import { Link } from 'react-router-dom';

interface PrivacyConsentProps {
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  parentalConfirm: boolean;
  onParentalConfirmChange: (value: boolean) => void;
  error?: string;
}

export default function PrivacyConsent({
  consent,
  onConsentChange,
  parentalConfirm,
  onParentalConfirmChange,
  error,
}: PrivacyConsentProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
          required
        />
        <span className="text-sm text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
          Я даю{' '}
          <Link to="/privacy" target="_blank" className="text-blue-600 hover:text-blue-700 font-medium underline">
            согласие на обработку персональных данных
          </Link>{' '}
          в соответствии с{' '}
          <Link to="/privacy" target="_blank" className="text-blue-600 hover:text-blue-700 font-medium underline">
            Политикой конфиденциальности
          </Link>
          . *
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={parentalConfirm}
          onChange={(e) => onParentalConfirmChange(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
          required
        />
        <span className="text-sm text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
          Мне исполнилось 14 лет, либо согласие на обработку моих персональных данных дано моим законным
          представителем (родителем или опекуном) в соответствии с Федеральным законом № 152-ФЗ. *
        </span>
      </label>

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
    </div>
  );
}
