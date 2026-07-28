/** Компактная подсказка для преподавателей: отправил ли ученик анкету этапа 1. */
export default function QuestionnaireStatusHint({
  submittedAt,
  compact = false,
}: {
  submittedAt?: string | null;
  compact?: boolean;
}) {
  const sent = Boolean(submittedAt?.trim());

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] leading-none ${
          sent ? 'text-slate-500' : 'text-slate-600'
        }`}
        title={sent ? 'Анкета этапа 1 отмечена как отправленная' : 'Анкета этапа 1 не отмечена'}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${sent ? 'bg-slate-500' : 'bg-slate-700'}`} />
        Анкета {sent ? 'есть' : '—'}
      </span>
    );
  }

  return (
    <span className={`text-xs ${sent ? 'text-slate-500' : 'text-slate-600'}`}>
      Анкета этапа 1: {sent ? 'отмечена как отправленная' : 'не отмечена'}
    </span>
  );
}
