import type { DocumentFile } from '../lib/types';
import { isLessonImageUrl } from '../lib/pdfDocumentUtils';
import LessonCoverImage from './LessonCoverImage';
import PdfDocumentViewer from './PdfDocumentViewer';

/**
 * Файл на странице занятия или задания: картинка показывается как есть,
 * PDF и презентации — во встроенном просмотре.
 */
export default function DocumentAttachment({
  url,
  title,
  size,
  fallbackTitle,
}: {
  url: string;
  title?: string;
  size?: number;
  fallbackTitle?: string;
}) {
  if (isLessonImageUrl(url)) {
    return (
      <div className="mx-auto w-full max-w-[900px] overflow-hidden rounded-xl bg-white border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.12)] p-2">
        {title?.trim() && (
          <p className="text-sm font-medium text-slate-800 px-2 py-2">{title.trim()}</p>
        )}
        <LessonCoverImage
          url={url}
          className="w-full max-h-[min(75vh,900px)] object-contain rounded-lg bg-slate-100"
        />
      </div>
    );
  }

  return <PdfDocumentViewer url={url} title={title} size={size} fallbackTitle={fallbackTitle} />;
}

/** Файлы блока одним столбцом — у ученика и в предпросмотре редактора. */
export function DocumentFilesList({ files, fallbackTitle }: { files: DocumentFile[]; fallbackTitle?: string }) {
  return (
    <div className="space-y-3">
      {files.map((file, index) => (
        <DocumentAttachment
          key={`${file.url}-${index}`}
          url={file.url.trim()}
          title={file.title}
          size={file.size}
          fallbackTitle={fallbackTitle}
        />
      ))}
    </div>
  );
}
