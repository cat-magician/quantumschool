/** Прогресс внутри этапа 1: анкета + эссе на одном экране. */
export default function SelectionStage1Progress({
  questionnaireDone,
  essayDone,
}: {
  questionnaireDone: boolean;
  essayDone: boolean;
}) {
  const currentStep = !questionnaireDone ? 1 : !essayDone ? 2 : 2;
  const allDone = questionnaireDone && essayDone;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3 text-xs mb-2.5">
        <span className={questionnaireDone ? 'text-emerald-400 font-medium' : 'text-blue-300 font-medium'}>
          1. Анкета
        </span>
        <span className={`text-slate-600 ${essayDone ? 'text-emerald-400 font-medium' : questionnaireDone ? 'text-blue-300 font-medium' : ''}`}>
          2. Эссе
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5 gap-0.5">
        <div
          className={`rounded-full transition-all duration-500 ${questionnaireDone ? 'bg-emerald-500 flex-1' : 'bg-blue-500/60 w-[35%]'}`}
        />
        <div
          className={`rounded-full transition-all duration-500 ${
            essayDone ? 'bg-emerald-500 flex-1' : questionnaireDone ? 'bg-blue-500/40 flex-1' : 'w-0'
          }`}
        />
      </div>
      <p className="text-xs text-slate-500 mt-2">
        {allDone
          ? 'Этап 1 завершён — можно перейти к задачам (этап 2) или к результатам'
          : `Шаг ${currentStep} из 2 на этапе 1`}
      </p>
    </div>
  );
}

function StepSectionLabel({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
      {step} из {total} · {label}
    </p>
  );
}

export { StepSectionLabel };
