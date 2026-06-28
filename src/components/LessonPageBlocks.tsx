import { ExternalLink } from 'lucide-react';
import type { LessonPageBlock } from '../lib/types';
import { linkifyText } from '../lib/linkifyText';
import { LESSON_BLOCK_LABELS } from '../lib/lessonPageUtils';
import BlockPlaceholder from './BlockPlaceholder';
import LessonMaterialsBlock from './LessonMaterialsBlock';
import VideoEmbed from './VideoEmbed';

function TextBlock({ body }: { body: string }) {
  return (
    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
      {linkifyText(body)}
    </div>
  );
}

export default function LessonPageBlocks({ blocks }: { blocks: LessonPageBlock[] }) {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      {sorted.map((block) => {
        const content = block.content ?? {};

        if (block.block_type === 'recording') {
          return (
            <section key={block.id} className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {LESSON_BLOCK_LABELS.recording}
              </h3>
              {content.url?.trim() ? (
                <VideoEmbed url={content.url} />
              ) : (
                <BlockPlaceholder variant="recording" />
              )}
            </section>
          );
        }

        if (block.block_type === 'text') {
          return (
            <section key={block.id} className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {LESSON_BLOCK_LABELS.text}
              </h3>
              {content.body?.trim() ? (
                <TextBlock body={content.body} />
              ) : (
                <BlockPlaceholder variant="text" />
              )}
            </section>
          );
        }

        if (block.block_type === 'materials') {
          return (
            <section key={block.id} className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {LESSON_BLOCK_LABELS.materials}
              </h3>
              <LessonMaterialsBlock content={content} />
            </section>
          );
        }

        if (block.block_type === 'homework_link') {
          return (
            <section key={block.id} className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {LESSON_BLOCK_LABELS.homework_link}
              </h3>
              {content.url?.trim() ? (
                <a
                  href={content.url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-200 hover:bg-violet-600/30 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  {content.label?.trim() || 'Перейти к домашнему заданию'}
                </a>
              ) : (
                <BlockPlaceholder variant="homework_link" />
              )}
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
