import type { HomeworkPageBlock } from '../lib/types';
import { HOMEWORK_BLOCK_HEADINGS } from '../lib/homeworkPageUtils';
import { parseYandexFormId, isContestLink } from '../lib/selectionConfig';
import BlockPlaceholder from './BlockPlaceholder';
import { HomeworkMarkdown } from './LazyMarkdown';
import VideoEmbed from './VideoEmbed';
import ContestLinkCard from './ContestLinkCard';
import YandexFormEmbed from './YandexFormEmbed';

/**
 * Пустой блок условия (текст, картинка, видео) ученику не показываем — это
 * недоделка, а не часть задания. Пустые форма и контест остаются заглушкой:
 * по ней видно, что сдача ещё появится.
 */
function isEmptyContentBlock(block: HomeworkPageBlock): boolean {
  const content = block.content ?? {};
  if (block.block_type === 'text') return !content.body?.trim();
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

  return null;
}
