import type { LessonPageBlock, LessonPageType } from '../lib/types';
import { formatLessonDate } from '../lib/lessonPageUtils';
import LessonCoverImage from './LessonCoverImage';
import LessonPageBlocks from './LessonPageBlocks';

const COVER_GRADIENT: Record<LessonPageType, string> = {
  lecture: 'from-blue-600/40 via-indigo-700/30 to-slate-900',
  seminar: 'from-violet-600/40 via-purple-700/30 to-slate-900',
};

export default function LessonPageStudentPreview({
  title,
  lessonDate,
  lessonType,
  coverUrl,
  blocks,
}: {
  title: string;
  lessonDate: string;
  lessonType: LessonPageType;
  coverUrl: string;
  blocks: LessonPageBlock[];
}) {
  const trimmedCover = coverUrl.trim();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden border border-white/5 aspect-[21/9] max-h-48 bg-slate-900 relative">
        {trimmedCover ? (
          <LessonCoverImage url={trimmedCover} className="w-full h-full object-cover" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${COVER_GRADIENT[lessonType]} flex items-center justify-center`}>
            <p className="text-sm text-white/40">Обложка не добавлена</p>
          </div>
        )}
      </div>

      <div>
        {lessonDate && (
          <p className="text-sm text-slate-500">{formatLessonDate(lessonDate)}</p>
        )}
        <h3 className="text-2xl font-bold text-white mt-1">{title || 'Без названия'}</h3>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-white/10 rounded-xl">
          Добавьте блоки страницы в редакторе — они появятся здесь
        </p>
      ) : (
        <LessonPageBlocks blocks={blocks} />
      )}
    </div>
  );
}
