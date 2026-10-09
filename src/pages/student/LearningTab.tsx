import { useEffect, useState } from 'react';
import { StudentLessonList, StudentLessonPageView } from '../../components/StudentLessonViews';
import { StudentHomeworkList, StudentHomeworkPageView } from '../../components/StudentHomeworkViews';

export type LearningSubTab = 'lectures' | 'seminars' | 'homework';

export default function StudentLearningTab({
  subTab,
  contentPageId,
  onContentPageChange,
  onOpenHomeworkPage,
  backLabel,
  onBack,
}: {
  subTab: LearningSubTab;
  contentPageId?: string | null;
  onContentPageChange?: (pageId: string | null) => void;
  onOpenHomeworkPage?: (pageId: string) => void;
  /** Страницу открыли не из списка (из расписания) — «назад» ведёт туда. */
  backLabel?: string;
  onBack?: () => void;
}) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [openHomeworkId, setOpenHomeworkId] = useState<string | null>(null);

  useEffect(() => {
    setOpenLessonId(null);
    setOpenHomeworkId(null);
    if (!contentPageId) return;
    if (subTab === 'homework') setOpenHomeworkId(contentPageId);
    else if (subTab === 'lectures' || subTab === 'seminars') setOpenLessonId(contentPageId);
  }, [subTab, contentPageId]);

  const openLesson = (pageId: string) => {
    setOpenLessonId(pageId);
    onContentPageChange?.(pageId);
  };

  const closeLesson = () => {
    setOpenLessonId(null);
    onContentPageChange?.(null);
  };

  const openHomework = (pageId: string) => {
    if (onOpenHomeworkPage) {
      onOpenHomeworkPage(pageId);
      return;
    }
    setOpenHomeworkId(pageId);
    onContentPageChange?.(pageId);
  };

  const closeHomework = () => {
    setOpenHomeworkId(null);
    onContentPageChange?.(null);
  };

  if (openLessonId) {
    return (
      <StudentLessonPageView
        pageId={openLessonId}
        onBack={onBack ?? closeLesson}
        backLabel={backLabel}
        onOpenHomework={openHomework}
      />
    );
  }

  if (openHomeworkId) {
    return (
      <StudentHomeworkPageView
        pageId={openHomeworkId}
        onBack={onBack ?? closeHomework}
        backLabel={backLabel}
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {subTab === 'lectures' && (
        <StudentLessonList lessonType="lecture" onOpen={openLesson} />
      )}
      {subTab === 'seminars' && (
        <StudentLessonList lessonType="seminar" onOpen={openLesson} />
      )}
      {subTab === 'homework' && (
        <StudentHomeworkList onOpen={openHomework} />
      )}
    </div>
  );
}
