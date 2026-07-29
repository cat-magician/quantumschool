import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';

/** Чекбокс + кнопка для сдачи через внешнюю форму/контест (без API). */
export function ExternalSubmitConfirm({
  checkboxLabel,
  confirmLabel = 'Подтвердить',
  loading = false,
  onConfirm,
  variant = 'default',
}: {
  checkboxLabel: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  variant?: 'default' | 'primary' | 'violet';
}) {
  const [checked, setChecked] = useState(false);

  const btnClass =
    variant === 'violet'
      ? 'bg-violet-600 hover:bg-violet-500 text-white'
      : variant === 'primary'
        ? 'bg-blue-600 hover:bg-blue-500 text-white'
        : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10';

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 rounded border-white/20 bg-slate-900 text-blue-500 focus:ring-blue-500/40"
        />
        <span className="text-sm text-slate-300 group-hover:text-slate-200 leading-relaxed">
          {checkboxLabel}
        </span>
      </label>
      <button
        type="button"
        onClick={onConfirm}
        disabled={!checked || loading}
        className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${btnClass}`}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Сохранение...
          </span>
        ) : (
          confirmLabel
        )}
      </button>
    </div>
  );
}

export function ExternalFormHint() {
  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
      Без подтверждения ниже сдача не засчитается.
    </div>
  );
}

export function SubmitAcceptedBanner({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90 space-y-1">
      <p className="font-semibold text-emerald-200 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 shrink-0" />
        {title}
      </p>
      {detail && <p className="text-emerald-100/80 leading-relaxed pl-6">{detail}</p>}
    </div>
  );
}
