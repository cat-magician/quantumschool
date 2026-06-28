import { useEffect, useState } from 'react';
import { StudentLessonList, StudentLessonPageView } from '../../components/StudentLessonViews';
import { StudentHomeworkList, StudentHomeworkPageView } from '../../components/StudentHomeworkViews';

export type LearningSubTab = 'lectures' | 'seminars' | 'homework';

const SUB_DESCRIPTIONS: Record<LearningSubTab, string> = {
  lectures: 'Записи, материалы и конспекты лекций.',
  seminars: 'Записи, материалы и конспекты семинаров.',
  homework: 'Домашние задания — условие, сдача через форму или контест и подтверждение отправки.',
};

export default function StudentLearningTab({ subTab }: { subTab: LearningSubTab }) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [openHomeworkId, setOpenHomeworkId] = useState<string | null>(null);

  useEffect(() => {
    setOpenLessonId(null);
    setOpenHomeworkId(null);
  }, [subTab]);

  if (openLessonId) {
    return (
      <StudentLessonPageView
        pageId={openLessonId}
        onBack={() => setOpenLessonId(null)}
      />
    );
  }

  if (openHomeworkId) {
    return (
      <StudentHomeworkPageView
        pageId={openHomeworkId}
        onBack={() => setOpenHomeworkId(null)}
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-slate-400 text-sm leading-relaxed">{SUB_DESCRIPTIONS[subTab]}</p>

      {subTab === 'lectures' && (
        <StudentLessonList lessonType="lecture" onOpen={setOpenLessonId} />
      )}
      {subTab === 'seminars' && (
        <StudentLessonList lessonType="seminar" onOpen={setOpenLessonId} />
      )}
      {subTab === 'homework' && (
        <StudentHomeworkList onOpen={setOpenHomeworkId} />
      )}
    </div>
  );
}
