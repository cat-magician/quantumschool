import type { HomeworkPageBlock } from '../lib/types';
import { HOMEWORK_BLOCK_LABELS } from '../lib/homeworkPageUtils';
import { parseYandexFormId, normalizeContestUrl } from '../lib/selectionConfig';
import BlockPlaceholder from './BlockPlaceholder';
import HomeworkMarkdown from './HomeworkMarkdown';
import VideoEmbed from './VideoEmbed';
import YandexContestEmbed, { isContestEmbeddable } from './YandexContestEmbed';
import YandexFormEmbed from './YandexFormEmbed';

export default function HomeworkPageBlocks({ blocks }: { blocks: HomeworkPageBlock[] }) {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order);

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
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {HOMEWORK_BLOCK_LABELS.text}
        </h4>
        {content.body?.trim() ? (
          <HomeworkMarkdown source={content.body} />
        ) : (
          <BlockPlaceholder variant="text" />
        )}
      </section>
    );
  }

  if (block.block_type === 'image') {
    return (
      <section key={block.id} className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {HOMEWORK_BLOCK_LABELS.image}
        </h4>
        {content.url?.trim() ? (
          <figure className="space-y-2">
            <img
              src={content.url.trim()}
              alt={content.caption?.trim() || 'Изображение к заданию'}
              className="max-w-full rounded-xl border border-white/10"
            />
            {content.caption?.trim() && (
              <figcaption className="text-sm text-slate-500">{content.caption}</figcaption>
            )}
          </figure>
        ) : (
          <BlockPlaceholder variant="image" />
        )}
      </section>
    );
  }

  if (block.block_type === 'video') {
    return (
      <section key={block.id} className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {HOMEWORK_BLOCK_LABELS.video}
        </h4>
        {content.url?.trim() ? (
          <VideoEmbed url={content.url} />
        ) : (
          <BlockPlaceholder variant="video" />
        )}
      </section>
    );
  }

  if (block.block_type === 'yandex_form') {
    const formId = parseYandexFormId(content.form_id ?? '');
    return (
      <section key={block.id} className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {HOMEWORK_BLOCK_LABELS.yandex_form}
        </h4>
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
    const embeddable = url && isContestEmbeddable(normalizeContestUrl(url) ?? '');
    return (
      <section key={block.id} className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {HOMEWORK_BLOCK_LABELS.contest}
        </h4>
        {embeddable ? (
          <YandexContestEmbed url={url} />
        ) : (
          <BlockPlaceholder variant="contest" />
        )}
      </section>
    );
  }

  return null;
}
