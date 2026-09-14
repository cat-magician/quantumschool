import MarkdownContent from './MarkdownContent';

/**
 * Инструкция к контесту этапа 2. Стоит над кнопкой перехода: контест
 * открывается в новой вкладке, и правила нужно прочитать до того, как уйти
 * туда. Ширина — как у карточки контеста под ней.
 */
export default function ContestInstructions({ source }: { source: string }) {
  if (!source.trim()) return null;

  return (
    <section className="mx-auto mb-4 w-full max-w-[650px] rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 sm:px-5">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Инструкция</h4>
      <MarkdownContent
        content={source}
        lineBreaks
        className="mt-2 [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_strong]:text-white"
      />
    </section>
  );
}
