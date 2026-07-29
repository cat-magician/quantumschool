import { ArrowRight, GraduationCap, X } from 'lucide-react';

export default function EnrolledWelcomeModal({
  onGoToLearning,
  onDismiss,
}: {
  onGoToLearning: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
        aria-label="Закрыть"
        onClick={onDismiss}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-emerald-950/30 overflow-hidden">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-400"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-8 pb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Вас зачислили на обучение</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Открылись разделы «Обучение», «Расписание» и «Прогресс». Материалы и домашние задания — в обучении.
          </p>
          <button
            type="button"
            onClick={onGoToLearning}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
          >
            Перейти к обучению
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-3 w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
          >
            Посмотрю позже
          </button>
        </div>
      </div>
    </div>
  );
}
