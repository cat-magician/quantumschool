import type { LessonPageBlock, LessonPageType } from '../lib/types';
import { isEventActive } from '../lib/scheduleUtils';
import LessonEventHeader, { type LessonEventInfo } from './LessonEventHeader';
import LessonPageBlocks from './LessonPageBlocks';

/** Страница занятия глазами ученика — та же шапка и те же блоки. */
export default function LessonPageStudentPreview({
  title,
  lessonDate,
  lessonType,
  coverUrl,
  event,
  blocks,
}: {
  title: string;
  lessonDate: string;
  lessonType: LessonPageType;
  coverUrl: string;
  event: LessonEventInfo | null;
  blocks: LessonPageBlock[];
}) {
  const beforeEnd = event ? isEventActive(event.scheduled_at, event.duration_minutes) : false;
  return (
    <div className="space-y-6">
      <LessonEventHeader
        title={title}
        lessonType={lessonType}
        coverUrl={coverUrl}
        lessonDate={lessonDate}
        event={event}
      />
      <LessonPageBlocks
        blocks={blocks}
        emptyState={beforeEnd
          ? {
            title: 'Запись и конспект появятся после занятия',
            text: 'Преподаватель добавит их на эту страницу — загляните сюда, когда занятие закончится.',
          }
          : undefined}
      />
    </div>
  );
}
