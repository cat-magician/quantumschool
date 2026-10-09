import { ExternalLink, Presentation } from 'lucide-react';
import type { LessonPageBlock } from '../lib/types';
import { linkifyText } from '../lib/linkifyText';
import { LESSON_BLOCK_HEADINGS, isLessonBlockEmpty } from '../lib/lessonPageUtils';
import LessonMaterialsBlock from './LessonMaterialsBlock';
import VideoEmbed from './VideoEmbed';

function BlockHeading({ type }: { type: LessonPageBlock['block_type'] }) {
  const heading = LESSON_BLOCK_HEADINGS[type];
  if (!heading) return null;
  return <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{heading}</h3>;
}

export type LessonBlocksEmptyState = { title: string; text: string };

const DEFAULT_EMPTY: LessonBlocksEmptyState = {
  title: 'Материалы скоро появятся',
  text: 'Преподаватель ещё не добавил запись и конспект.',
};

function TextBlock({ body }: { body: string }) {
  return (
    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
      {linkifyText(body)}
    </div>
  );
}

/**
 * Блоки страницы занятия. Пустые не показываются: до занятия записи нет,
 * и заглушки «появится после публикации» на опубликованной странице только
 * сбивают с толку. Если пусто всё — одна короткая заметка, когда ждать.
 */
export default function LessonPageBlocks({
  blocks,
  onOpenHomework,
  emptyState = DEFAULT_EMPTY,
}: {
  blocks: LessonPageBlock[];
  onOpenHomework?: (pageId: string) => void;
  emptyState?: LessonBlocksEmptyState;
}) {
  const sorted = [...blocks]
    .filter((block) => !isLessonBlockEmpty(block))
    .sort((a, b) => a.sort_order - b.sort_order);

  if (sorted.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-5">
        <Presentation className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm font-medium text-slate-200">{emptyState.title}</p>
          <p className="text-sm text-slate-500 mt-0.5">{emptyState.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sorted.map((block) => {
        const content = block.content ?? {};

        if (block.block_type === 'recording') {
          return (
            <section key={block.id} className="space-y-3">
              <BlockHeading type="recording" />
              <VideoEmbed url={content.url ?? ''} />
            </section>
          );
        }

        if (block.block_type === 'text') {
          return (
            <section key={block.id} className="space-y-3">
              <BlockHeading type="text" />
              <TextBlock body={content.body ?? ''} />
            </section>
          );
        }

        if (block.block_type === 'materials') {
          return (
            <section key={block.id} className="space-y-3">
              <BlockHeading type="materials" />
              <LessonMaterialsBlock content={content} />
            </section>
          );
        }

        if (block.block_type === 'homework_link') {
          const pageId = content.homework_page_id?.trim();
          const legacyUrl = content.url?.trim();
          const label = content.label?.trim() || 'Перейти к домашнему заданию';

          return (
            <section key={block.id} className="space-y-3">
              <BlockHeading type="homework_link" />
              {pageId && onOpenHomework ? (
                <button
                  type="button"
                  onClick={() => onOpenHomework(pageId)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-200 hover:bg-violet-600/30 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              ) : legacyUrl ? (
                <a
                  href={legacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-200 hover:bg-violet-600/30 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  {label}
                </a>
              ) : (
                // Предпросмотр в редакторе: перейти некуда, но кнопку видно.
                <span className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-200 text-sm font-medium">
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  {label}
                </span>
              )}
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
