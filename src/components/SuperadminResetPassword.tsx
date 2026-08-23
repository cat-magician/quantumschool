import { useState } from 'react';
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react';
import { useAppDialog } from '../lib/AppDialogContext';
import { generatePassword, superadminSetLoginPassword } from '../lib/adminUserUtils';

/**
 * Выдать новый пароль участнику, который входит по логину. Писем в системе
 * нет — пароль показывается суперадмину, дальше он передаёт его сам.
 */
export default function SuperadminResetPassword({
  userId,
  userName,
  login,
  className = '',
}: {
  userId: string;
  userName: string;
  login: string;
  className?: string;
}) {
  const { confirm, toast } = useAppDialog();
  const [working, setWorking] = useState(false);
  const [issued, setIssued] = useState('');
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Выдать новый пароль?',
      message: `Старый пароль «${userName}» (логин ${login}) перестанет работать сразу. `
        + 'Новый пароль появится здесь — передайте его участнику сами.',
      confirmLabel: 'Выдать пароль',
    });
    if (!ok) return;

    const password = generatePassword();
    setWorking(true);
    const { error } = await superadminSetLoginPassword(userId, password);
    setWorking(false);

    if (error) {
      toast(error, 'error');
      return;
    }

    setIssued(password);
    setCopied(false);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
    } catch {
      toast('Скопируйте пароль вручную', 'warning');
    }
  };

  if (issued) {
    return (
      <div className={`flex items-center gap-2 min-w-0 ${className}`}>
        <code className="h-9 px-3 flex items-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-mono tracking-wide">
          {issued}
        </code>
        <button
          type="button"
          onClick={() => { void copyPassword(); }}
          aria-label="Скопировать пароль"
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { void handleReset(); }}
      disabled={working}
      className={`flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium bg-white/5 text-slate-400 border border-white/10 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/20 transition-colors disabled:opacity-50 ${className}`}
    >
      {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
      <span>Новый пароль</span>
    </button>
  );
}
