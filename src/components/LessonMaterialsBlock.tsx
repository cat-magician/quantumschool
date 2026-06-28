import type { LessonBlockContent } from '../lib/types';
import { linkifyText } from '../lib/linkifyText';
import { extractDocumentUrlFromText, isLessonDocumentUrl } from '../lib/pdfDocumentUtils';
import BlockPlaceholder from './BlockPlaceholder';
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

  if (!hasDoc && !showBody) {
    return <BlockPlaceholder variant="materials" />;
  }

  return (
    <div className="space-y-4">
      {hasDoc && (
        <PdfDocumentViewer url={pdfUrl} title={content.pdf_title} />
      )}
      {showBody && <TextBlock body={body} />}
    </div>
  );
}
