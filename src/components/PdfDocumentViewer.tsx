import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { isYandexDiskUrl } from '../lib/yandexDiskImageUtils';
import {
  pdfViewerTitle,
  resolveLessonDocument,
  type LessonDocumentKind,
  type ResolvedLessonDocument,
} from '../lib/pdfDocumentUtils';

const KIND_HINT: Record<LessonDocumentKind, string> = {
  pdf: 'PDF',
  office: 'Презентация / документ',
  download_only: 'Файл',
};

export default function PdfDocumentViewer({
  url,
  title,
}: {
  url: string;
  title?: string;
}) {
  const rawUrl = url.trim();
  const [doc, setDoc] = useState<ResolvedLessonDocument | null>(null);
  const [displayTitle, setDisplayTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDoc(null);

    resolveLessonDocument(rawUrl)
      .then((resolved) => {
        if (cancelled) return;
        setDoc(resolved);
        setDisplayTitle(pdfViewerTitle(title, rawUrl, resolved.fileName));
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
  }, [rawUrl, title]);

  const openUrl = doc?.sourceUrl ?? rawUrl;
  const downloadUrl = doc?.downloadUrl ?? rawUrl;
  const canEmbed = doc?.kind === 'pdf' || doc?.kind === 'office';
  const loadingHint = isYandexDiskUrl(rawUrl) ? 'Получаем файл с Яндекс.Диска…' : 'Загрузка документа…';

  return (
    <div className="mx-auto w-full max-w-[900px] overflow-hidden rounded-xl bg-white border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">
              {displayTitle || pdfViewerTitle(title, rawUrl)}
            </p>
            {doc && (
              <p className="text-[11px] text-slate-500 truncate">{KIND_HINT[doc.kind]}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Открыть
          </a>
          <a
            href={downloadUrl}
            download={doc?.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Скачать
          </a>
        </div>
      </div>

      <div className="relative bg-slate-100 min-h-[420px] max-h-[min(75vh,900px)]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
              Открыть на Яндекс.Диске
            </a>
          </div>
        )}

        {!loading && !error && doc && canEmbed && (
          <iframe
            src={doc.viewerUrl}
            title={displayTitle}
            className="block w-full h-[min(75vh,900px)] min-h-[420px] border-0 bg-white"
            allow="fullscreen"
          />
        )}

        {!loading && !error && doc?.kind === 'download_only' && (
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
      </div>
    </div>
  );
}
