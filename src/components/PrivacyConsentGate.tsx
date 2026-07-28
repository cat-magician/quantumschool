import { useState } from 'react';
import { Atom, Loader2, LogOut } from 'lucide-react';
import PrivacyConsent from './PrivacyConsent';
import { useAuth } from '../lib/AuthContext';

/** Первый вход: согласие ещё не в профиле — блокируем кабинет до подтверждения. */
export default function PrivacyConsentGate() {
  const { recordPrivacyConsent, signOut } = useAuth();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setError('');
    if (!consent) {
      setError('Необходимо подтвердить согласие на обработку персональных данных');
      return;
    }

    setSaving(true);
    const result = await recordPrivacyConsent();
    setSaving(false);

    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-violet-900/10">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-violet-700 rounded-2xl flex items-center justify-center">
            <Atom className="w-7 h-7 text-white" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white text-center mb-2">Добро пожаловать!</h1>
        <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
          Это ваш первый вход. Имя и почта из Яндекс ID будут отображаться в личном кабинете —
          подтвердите согласие на обработку персональных данных, чтобы продолжить.
        </p>

        <PrivacyConsent
          variant="dark"
          consent={consent}
          onConsentChange={setConsent}
          error={error}
        />

        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="mt-6 w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Продолжить в личный кабинет
        </button>

        <button
          type="button"
          onClick={signOut}
          className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </div>
  );
}
