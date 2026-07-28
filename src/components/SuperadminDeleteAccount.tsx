import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useAppDialog } from '../lib/AppDialogContext';
import { superadminDeleteUserAccount } from '../lib/adminUserUtils';

export default function SuperadminDeleteAccount({
  userId,
  userName,
  onDeleted,
  className = '',
}: {
  userId: string;
  userName: string;
  onDeleted?: () => void;
  className?: string;
}) {
  const { confirm, toast } = useAppDialog();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Удалить аккаунт?',
      message: `«${userName}» будет удалён без возможности восстановления вместе с данными отбора. Используйте для ботов и ошибочных регистраций.`,
      confirmLabel: 'Удалить аккаунт',
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    const { error } = await superadminDeleteUserAccount(userId);
    setDeleting(false);

    if (error) {
      toast(error, 'error');
      return;
    }

    toast('Аккаунт удалён', 'success');
    onDeleted?.();
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      title="Удалить аккаунт"
      aria-label="Удалить аккаунт"
      className={`flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/25 transition-colors disabled:opacity-50 ${className}`}
    >
      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
