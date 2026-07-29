import type { ReactNode } from 'react';
import BlockPlaceholder from './BlockPlaceholder';

type Stage = 'essay' | 'contest' | 'questionnaire';

const STUDENT_COPY: Record<Stage, { title: string; text: string }> = {
  questionnaire: {
    title: 'Анкета пока не открыта',
    text: 'Организаторы ещё не опубликовали форму. Это нормально — вернитесь позже или посмотрите другие этапы.',
  },
  essay: {
    title: 'Эссе пока не открыто',
    text: 'Форма для мотивационного эссе появится здесь после публикации. Пока можно пройти другие этапы отбора.',
  },
  contest: {
    title: 'Контест пока не открыт',
    text: 'Задачи второго этапа появятся здесь после публикации. Следите за обновлениями на главной.',
  },
};

export default function StageComingSoon({
  stage,
  minHeight = 420,
  onGoHome,
  onGoResults,
}: {
  stage: Stage;
  minHeight?: number;
  onGoHome?: () => void;
  onGoResults?: () => void;
}) {
  const variant = stage === 'contest' ? 'contest' : stage === 'questionnaire' ? 'questionnaire' : 'yandex_form';
  const studentCopy = STUDENT_COPY[stage];
  const showStudentHints = !!(onGoHome || onGoResults);

  const actions: ReactNode = showStudentHints ? (
    <>
      {onGoHome && (
        <button
          type="button"
          onClick={onGoHome}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-200 border border-slate-300/30 hover:bg-slate-700 transition-colors"
        >
          На главную
        </button>
      )}
      {onGoResults && (
        <button
          type="button"
          onClick={onGoResults}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          Результаты
        </button>
      )}
    </>
  ) : undefined;

  return (
    <BlockPlaceholder
      variant={variant}
      minHeight={minHeight}
      title={showStudentHints ? studentCopy.title : undefined}
      text={showStudentHints ? studentCopy.text : undefined}
      actions={actions}
    />
  );
}
