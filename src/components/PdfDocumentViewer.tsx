import { useEffect, useState } from 'react';
import { ChevronUp, Download, ExternalLink, Eye, FileText, Loader2 } from 'lucide-react';
import { isYandexDiskUrl } from '../lib/yandexDiskImageUtils';
import { TOUCH_POINTER_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { formatFileSize } from '../lib/contentDocumentUtils';
import {
  lessonDocumentDownloadUrl,
  pdfViewerTitle,
  resolveLessonDocument,
  type LessonDocumentKind,
  type ResolvedLessonDocument,
} from '../lib/pdfDocumentUtils';
import PdfPagesView from './PdfPagesView';

const KIND_HINT: Record<LessonDocumentKind, string> = {
  pdf: 'PDF',
  office: 'Презентация / документ',
  download_only: 'Файл',
};

export default function PdfDocumentViewer({
  url,
  title,
  size,
  fallbackTitle,
}: {
  url: string;
  title?: string;
  /** Размер файла в байтах, если известен (сохранён при загрузке). */
  size?: number;
  /** Заголовок, когда ни название, ни имя файла его не дают. */
  fallbackTitle?: string;
}) {
  const rawUrl = url.trim();
  const [doc, setDoc] = useState<ResolvedLessonDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Браузер скачивает PDF целиком, едва его показали, а страницу занятия
  // открывают и ради записи. Поэтому файл грузится, только когда его
  // попросили показать, открыть или скачать.
  const [shown, setShown] = useState(false);

  // Только от ссылки: пока в редакторе печатают название, документ не
  // перезагружается на каждую букву.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDoc(null);
    setShown(false);

    resolveLessonDocument(rawUrl)
      .then((resolved) => {
        if (!cancelled) setDoc(resolved);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить материал');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rawUrl]);

  const displayTitle = pdfViewerTitle(title, rawUrl, doc?.fileName, fallbackTitle);
  const touch = useMediaQuery(TOUCH_POINTER_QUERY);
  const openUrl = doc?.sourceUrl ?? rawUrl;
  const downloadUrl = lessonDocumentDownloadUrl(doc?.downloadUrl ?? rawUrl, displayTitle);
  const fileSize = size ?? doc?.size;
  const ready = !loading && !error && !!doc;
  // PDF во фрейме телефоны не показывают: Chrome и Яндекс Браузер на Android
  // оставляют пустое окно или сразу качают файл, iPhone рисует одну первую
  // страницу. Там страницы рисует pdf.js. Документы Office идут через
  // веб-просмотрщик Microsoft, он работает и на телефоне.
  const pdfOnTouch = ready && doc.kind === 'pdf' && touch;
  const canFrame = ready && ((doc.kind === 'pdf' && !touch) || doc.kind === 'office');
  const canShow = canFrame || pdfOnTouch;
  const loadingHint = isYandexDiskUrl(rawUrl) ? 'Получаем файл с Яндекс.Диска…' : 'Загрузка документа…';

  const openLink = (className: string) => (
    <a href={openUrl} target="_blank" rel="noopener noreferrer" className={className}>
      <ExternalLink className="w-4 h-4" />
      Открыть
    </a>
  );
  const downloadLink = (className: string) => (
    <a
      href={downloadUrl}
      download={doc?.fileName}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <Download className="w-4 h-4" />
      Скачать
    </a>
  );
  const touchButton = 'inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors';
  // На телефоне «Открыть» и «Скачать» — крупными кнопками под содержимым.
  const touchActions = touch && ready && (
    <div className="grid grid-cols-2 gap-2 px-4 pb-4">
      {openLink(touchButton)}
      {downloadLink(touchButton)}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[900px] overflow-hidden rounded-xl bg-white border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 line-clamp-2 break-words">
              {displayTitle}
            </p>
            {doc && (
              <p className="text-[11px] text-slate-500 truncate">
                {KIND_HINT[doc.kind]}
                {fileSize ? ` · ${formatFileSize(fileSize)}` : ''}
              </p>
            )}
          </div>
        </div>
        {!touch && (
          <div className="flex items-center gap-2 shrink-0">
            {openLink('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors')}
            {downloadLink('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors')}
          </div>
        )}
      </div>

      <div className={`relative bg-slate-100 ${canFrame && shown ? 'max-h-[min(75vh,900px)] min-h-[420px]' : ''}`}>
        {loading && (
          <div className="flex items-center justify-center gap-3 px-6 py-10 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-sm">{loadingHint}</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
            <FileText className="w-10 h-10 text-slate-400" />
            <p className="text-sm text-slate-600 max-w-md">{error}</p>
            <a
              href={rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              {isYandexDiskUrl(rawUrl) ? 'Открыть на Яндекс.Диске' : 'Открыть файл'}
            </a>
          </div>
        )}

        {canShow && !shown && (
          <div className="flex justify-center px-4 py-5">
            <button
              type="button"
              onClick={() => setShown(true)}
              className={`inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors ${
                touch ? 'w-full min-h-12 text-[15px]' : 'min-h-11'
              }`}
            >
              <Eye className="w-4 h-4" />
              Показать здесь
            </button>
          </div>
        )}

        {canFrame && shown && (
          <iframe
            src={doc.viewerUrl}
            title={displayTitle}
            className="block w-full h-[min(75vh,900px)] min-h-[420px] border-0 bg-white"
            allow="fullscreen"
          />
        )}

        {pdfOnTouch && shown && (
          <>
            <PdfPagesView url={doc.viewerUrl} title={displayTitle} />
            <div className="flex justify-center px-4 pb-3">
              <button
                type="button"
                onClick={() => setShown(false)}
                className="inline-flex items-center gap-1.5 min-h-11 px-4 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <ChevronUp className="w-4 h-4" />
                Свернуть
              </button>
            </div>
          </>
        )}

        {ready && doc.kind === 'download_only' && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
            <FileText className="w-10 h-10 text-slate-400" />
            <p className="text-sm text-slate-600 max-w-md">
              Этот тип файла нельзя показать на странице. Скачайте его или откройте на Яндекс.Диске.
            </p>
            {doc.fileName && (
              <p className="text-xs text-slate-500">{doc.fileName}</p>
            )}
          </div>
        )}

        {touchActions}
      </div>
    </div>
  );
}
