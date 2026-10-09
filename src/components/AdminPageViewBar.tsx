import { Eye, Loader2, Pencil, Save, Send } from 'lucide-react';

/**
 * Полоса над страницей лекции, семинара или ДЗ, открытой сотрудником.
 * Страница показана так, как её видят ученики, а отсюда — в редактор,
 * опубликовать черновик или сохранить правки, сделанные в редакторе.
 */
export default function AdminPageViewBar({
  published,
  dirty,
  saving,
  onEdit,
  onPublish,
  onSave,
}: {
  published: boolean;
  /** В редакторе есть несохранённые правки — ученики видят прежнюю версию. */
  dirty: boolean;
  saving: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onSave: () => void;
}) {
  const tone = dirty || !published
    ? 'bg-amber-500/10 border-amber-500/25 text-amber-100'
    : 'bg-white/5 border-white/10 text-slate-300';
  const text = dirty
    ? 'Изменения не сохранены — ученики видят прежнюю версию'
    : published
      ? 'Так страницу видят ученики'
      : 'Черновик — ученики пока не видят эту страницу';

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3 ${tone}`}>
      <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Eye className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        {text}
      </p>
      <div className="flex flex-wrap gap-2">
        {dirty && (
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить
          </button>
        )}
        {!published && (
          <button
            type="button"
            disabled={saving}
            onClick={onPublish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving && !dirty ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Опубликовать
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
        >
          <Pencil className="h-4 w-4" />
          Редактировать
        </button>
      </div>
    </div>
  );
}
