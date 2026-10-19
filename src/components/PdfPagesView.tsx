import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { PDFDocumentProxy } from '../lib/pdfRender';

type Loaded = {
  doc: PDFDocumentProxy;
  render: typeof import('../lib/pdfRender').renderPage;
  /** Высота к ширине первой страницы — до отрисовки так стоят и остальные. */
  aspect: number;
};

/**
 * PDF прямо на странице, страницами-картинками: телефоны во фрейме PDF не
 * показывают. Страницы рисуются по мере прокрутки; увеличивают их щипком,
 * как любую страницу сайта.
 */
export default function PdfPagesView({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    setLoaded(null);
    setFailed(false);
    import('../lib/pdfRender')
      .then(async ({ openPdf, renderPage }) => {
        if (cancelled) return;
        const task = openPdf(url);
        stop = () => { void task.destroy(); };
        const doc = await task.promise;
        const first = await doc.getPage(1);
        const view = first.getViewport({ scale: 1 });
        if (!cancelled) setLoaded({ doc, render: renderPage, aspect: view.height / view.width });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [url]);

  if (failed) {
    return (
      <p className="px-4 py-6 text-center text-sm text-slate-600">
        Этот файл не получилось показать на странице — откройте или скачайте его кнопками ниже.
      </p>
    );
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center gap-3 px-6 py-10 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <p className="text-sm">Загружаем страницы…</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: loaded.doc.numPages }, (_, index) => (
        <PdfPage key={index} loaded={loaded} pageNumber={index + 1} title={title} />
      ))}
    </div>
  );
}

function PdfPage({ loaded, pageNumber, title }: { loaded: Loaded; pageNumber: number; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [aspect, setAspect] = useState(loaded.aspect);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    // Рисуем страницу, когда до неё остаётся пара экранов.
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loaded.render(loaded.doc, pageNumber, el.clientWidth)
        .then(({ blob, aspect: pageAspect }) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setAspect(pageAspect);
          setSrc(objectUrl);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, { rootMargin: '1200px 0px' });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loaded, pageNumber]);

  const pages = loaded.doc.numPages;
  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-md bg-white shadow-sm"
      style={{ aspectRatio: String(1 / aspect) }}
    >
      {src ? (
        <img src={src} alt={`${title}, страница ${pageNumber}`} className="block h-full w-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          {failed ? <span className="text-xs">Страница не нарисовалась</span> : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      )}
      {pages > 1 && (
        <span className="absolute bottom-1.5 right-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-[10px] tabular-nums text-white">
          {pageNumber} / {pages}
        </span>
      )}
    </div>
  );
}
