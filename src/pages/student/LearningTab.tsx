import { useEffect, useState } from 'react';
import { StudentLessonList, StudentLessonPageView } from '../../components/StudentLessonViews';
import { StudentHomeworkList, StudentHomeworkPageView } from '../../components/StudentHomeworkViews';

export type LearningSubTab = 'lectures' | 'seminars' | 'homework';

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
