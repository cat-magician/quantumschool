import type { LessonBlockContent } from '../lib/types';
import { linkifyText } from '../lib/linkifyText';
import {
  extractDocumentUrlFromText,
  isLessonDocumentUrl,
  isLessonImageUrl,
} from '../lib/pdfDocumentUtils';
import BlockPlaceholder from './BlockPlaceholder';
import LessonCoverImage from './LessonCoverImage';
import PdfDocumentViewer from './PdfDocumentViewer';

function TextBlock({ body }: { body: string }) {
  return (
    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
      {linkifyText(body)}
    </div>
  );
}

/** Материалы занятия: PDF-конспект + дополнительные ссылки. */
export default function LessonMaterialsBlock({ content }: { content: LessonBlockContent }) {
  const pdfUrl =
    content.pdf_url?.trim() ||
    extractDocumentUrlFromText(content.body ?? '') ||
    '';
  const body = content.body?.trim() ?? '';
  const showBody = !!body && (!pdfUrl || body.replace(pdfUrl, '').trim().length > 0);
  const hasDoc = !!pdfUrl && isLessonDocumentUrl(pdfUrl);
  const isImage = hasDoc && isLessonImageUrl(pdfUrl);

  if (!hasDoc && !showBody) {
    return <BlockPlaceholder variant="materials" />;
  }

  return (
    <div className="space-y-4">
      {hasDoc && isImage && (
        <div className="mx-auto w-full max-w-[900px] overflow-hidden rounded-xl bg-white border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.12)] p-2">
          {content.pdf_title?.trim() && (
            <p className="text-sm font-medium text-slate-800 px-2 py-2">{content.pdf_title.trim()}</p>
          )}
          <LessonCoverImage
            url={pdfUrl}
            className="w-full max-h-[min(75vh,900px)] object-contain rounded-lg bg-slate-100"
          />
        </div>
      )}
      {hasDoc && !isImage && (
        <PdfDocumentViewer url={pdfUrl} title={content.pdf_title} />
      )}
      {showBody && <TextBlock body={body} />}
    </div>
  );
}
