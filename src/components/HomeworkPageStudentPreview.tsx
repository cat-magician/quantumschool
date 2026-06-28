import type { HomeworkPageBlock } from '../lib/types';
import { formatHomeworkDueAt } from '../lib/homeworkPageUtils';
import HomeworkDueBadge from './HomeworkDueBadge';
import HomeworkPageBlocks from './HomeworkPageBlocks';
import HomeworkSubmissionSection from './HomeworkSubmissionSection';

export default function HomeworkPageStudentPreview({
  title,
  dueAt,
  blocks,
  preview = false,
}: {
  title: string;
  dueAt: string | null;
  blocks: HomeworkPageBlock[];
  preview?: boolean;
}) {
  const dueText = dueAt ? formatHomeworkDueAt(dueAt) : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {dueText ? (
            <p className="text-sm text-slate-500">Срок: {dueText}</p>
          ) : (
            <p className="text-sm text-slate-500">Без срока</p>
          )}
          <HomeworkDueBadge dueAt={dueAt} />
        </div>
        <h3 className="text-2xl font-bold text-white mt-1">{title || 'Без названия'}</h3>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-white/10 rounded-xl">
          Добавьте блоки задания в редакторе — они появятся здесь
        </p>
      ) : (
        <HomeworkPageBlocks blocks={blocks} />
      )}

      <HomeworkSubmissionSection preview={preview} />
    </div>
  );
}
