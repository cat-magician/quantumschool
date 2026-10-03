import { Suspense, type ComponentProps } from 'react';
import { lazyChunk } from '../lib/lazyChunk';

// Markdown с формулами (react-markdown + KaTeX) — самая тяжёлая библиотека
// кабинета, а нужна она только там, где есть такой текст: в ДЗ, инструкции
// к контесту и предпросмотре редактора. Грузим её при первом показе.
const MarkdownContentImpl = lazyChunk(() => import('./MarkdownContent'));
const HomeworkMarkdownImpl = lazyChunk(() => import('./HomeworkMarkdown'));

function MarkdownPlaceholder() {
  return (
    <div className="space-y-2 py-1 animate-pulse" aria-hidden>
      <div className="h-3 rounded bg-white/10 w-full" />
      <div className="h-3 rounded bg-white/10 w-5/6" />
      <div className="h-3 rounded bg-white/10 w-2/3" />
    </div>
  );
}

export function MarkdownContent(props: ComponentProps<typeof MarkdownContentImpl>) {
  // Пустой текст рендерится в ничто — без мигания заглушкой.
  if (!props.content.trim()) return null;
  return (
    <Suspense fallback={<MarkdownPlaceholder />}>
      <MarkdownContentImpl {...props} />
    </Suspense>
  );
}

export function HomeworkMarkdown(props: ComponentProps<typeof HomeworkMarkdownImpl>) {
  if (!props.source.trim()) return null;
  return (
    <Suspense fallback={<MarkdownPlaceholder />}>
      <HomeworkMarkdownImpl {...props} />
    </Suspense>
  );
}
