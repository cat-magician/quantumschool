import { ExternalLink, MessageCircle } from 'lucide-react';
import type { HomeworkPageBlock } from '../lib/types';
import { HOMEWORK_BLOCK_HEADINGS, homeworkFiles } from '../lib/homeworkPageUtils';
import { parseYandexFormId, isContestLink } from '../lib/selectionConfig';
import { linkifyText } from '../lib/linkifyText';
import BlockPlaceholder from './BlockPlaceholder';
import { DocumentFilesList } from './DocumentAttachment';
import { HomeworkMarkdown } from './LazyMarkdown';
import VideoEmbed from './VideoEmbed';
import ContestLinkCard from './ContestLinkCard';
import YandexFormEmbed from './YandexFormEmbed';

/**
 * Пустой блок условия (текст, файл, картинка, видео) ученику не показываем —
 * это недоделка, а не часть задания. Пустые форма и контест остаются
 * заглушкой: по ней видно, что сдача ещё появится.
 */
function isEmptyContentBlock(block: HomeworkPageBlock): boolean {
  const content = block.content ?? {};
  if (block.block_type === 'text') return !content.body?.trim();
  if (block.block_type === 'document') return homeworkFiles(content).length === 0;
  if (block.block_type === 'image' || block.block_type === 'video') return !content.url?.trim();
  return false;
}

function BlockHeading({ type }: { type: HomeworkPageBlock['block_type'] }) {
  const heading = HOMEWORK_BLOCK_HEADINGS[type];
  if (!heading) return null;
  return <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{heading}</h4>;
}

export default function HomeworkPageBlocks({ blocks }: { blocks: HomeworkPageBlock[] }) {
  const sorted = [...blocks]
    .filter((block) => !isEmptyContentBlock(block))
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      {sorted.map((block) => renderBlock(block))}
    </div>
  );
}

function renderBlock(block: HomeworkPageBlock) {
  const content = block.content ?? {};

  if (block.block_type === 'text') {
    return (
      <section key={block.id} className="space-y-3">
        <BlockHeading type="text" />
        <HomeworkMarkdown source={content.body ?? ''} />
      </section>
    );
  }

  if (block.block_type === 'document') {
    return (
      <section key={block.id} className="space-y-3">
        <BlockHeading type="document" />
        <DocumentFilesList files={homeworkFiles(content)} fallbackTitle="Файл к заданию" />
      </section>
    );
  }

  if (block.block_type === 'image') {
    return (
      <section key={block.id} className="space-y-3">
        <BlockHeading type="image" />
        <figure className="space-y-2">
          <img
            src={content.url?.trim()}
            alt={content.caption?.trim() || 'Изображение к заданию'}
            className="max-w-full rounded-xl border border-white/10"
          />
          {content.caption?.trim() && (
            <figcaption className="text-sm text-slate-500">{content.caption}</figcaption>
          )}
        </figure>
      </section>
    );
  }

  if (block.block_type === 'video') {
    return (
      <section key={block.id} className="space-y-3">
        <BlockHeading type="video" />
        <VideoEmbed url={content.url ?? ''} />
      </section>
    );
  }

  if (block.block_type === 'yandex_form') {
    const formId = parseYandexFormId(content.form_id ?? '');
    return (
      <section key={block.id} className="space-y-3">
        <BlockHeading type="yandex_form" />
        {formId ? (
            <YandexFormEmbed formId={formId} />
        ) : (
          <BlockPlaceholder variant="yandex_form" />
        )}
      </section>
    );
  }

  if (block.block_type === 'contest') {
    const url = content.url?.trim() ?? '';
    const hasContest = !!url && isContestLink(url);
    return (
      <section key={block.id} className="space-y-3">
        <BlockHeading type="contest" />
        {hasContest ? (
          <ContestLinkCard url={url} title="Задачи в Яндекс.Контесте" />
        ) : (
          <BlockPlaceholder variant="contest" />
        )}
      </section>
    );
  }

  if (block.block_type === 'chat') {
    return (
      <section key={block.id} className="space-y-3">
        <BlockHeading type="chat" />
        <HomeworkChatCard body={content.body} url={content.url} />
      </section>
    );
  }

  return null;
}

/**
 * Сдача в чате группы: решение уходит наставникам в чат, на сайте — только
 * куда отправлять и, после проверки, оценка.
 */
export function HomeworkChatCard({ body, url }: { body?: string; url?: string }) {
  const link = url?.trim();
  const chatUrl = link && /^https?:\/\//i.test(link) ? link : null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Решение отправьте в чат группы</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-400">
            {body?.trim() ? linkifyText(body.trim()) : 'Наставник проверит его там, а оценка появится на этой странице.'}
          </p>
        </div>
      </div>
      {chatUrl && (
        <a
          href={chatUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-500 sm:w-auto"
        >
          <ExternalLink className="h-4 w-4" />
          Открыть чат
        </a>
      )}
    </div>
  );
}
