import { useState } from 'react';
import { GraduationCap, Sparkles, X } from 'lucide-react';
import {
  dismissTeacherPromotedBanner,
  shouldShowTeacherPromotedBanner,
} from '../lib/teacherPromotionNotice';

export function TeacherApplicationPendingBanner() {
  return (
    <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-100/90">
      <p className="font-medium text-violet-200 flex items-center gap-2">
        <GraduationCap className="w-4 h-4 shrink-0" />
        Заявка на преподавателя на рассмотрении
      </p>
      <p className="mt-1 text-violet-100/80 leading-relaxed pl-6">
        Пока можете участвовать в отборе как школьник. Если заявку одобрят, кабинет переключится на режим преподавателя.
      </p>
    </div>
  );
}

export function TeacherPromotedBanner({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(() => shouldShowTeacherPromotedBanner(userId));

  if (!visible) return null;

  const dismiss = () => {
    dismissTeacherPromotedBanner(userId);
    setVisible(false);
  };

  return (
    <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90 relative">
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-lg text-emerald-300/70 hover:text-emerald-200 hover:bg-emerald-500/10 transition-colors"
        aria-label="Закрыть"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="font-medium text-emerald-200 flex items-center gap-2 pr-8">
        <Sparkles className="w-4 h-4 shrink-0" />
        Вы одобрены как преподаватель
      </p>
      <p className="mt-1 text-emerald-100/80 leading-relaxed pl-6 pr-6">
        Кабинет переключён на режим преподавателя. Проверка работ, материалы и ученики — в меню слева.
      </p>
    </div>
  );
}
