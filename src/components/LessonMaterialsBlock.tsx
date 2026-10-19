import type { DocumentFile, LessonBlockContent } from '../lib/types';
import { linkifyText } from '../lib/linkifyText';
import { materialsFiles } from '../lib/lessonPageUtils';
import {
  extractDocumentUrlFromText,
  isLessonDocumentUrl,
} from '../lib/pdfDocumentUtils';
import BlockPlaceholder from './BlockPlaceholder';
import { DocumentFilesList } from './DocumentAttachment';

function TextBlock({ body }: { body: string }) {
  return (
    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
      {linkifyText(body)}
    </div>
  );
}

/** Материалы занятия: файлы (конспект, слайды) и дополнительные ссылки текстом. */
export default function LessonMaterialsBlock({ content }: { content: LessonBlockContent }) {
  const body = content.body?.trim() ?? '';
  const files = materialsFiles(content);
  // В самых старых блоках ссылка на PDF лежала прямо в тексте.
  const bodyUrl = files.length === 0 ? extractDocumentUrlFromText(body) : null;
  const shown: DocumentFile[] = files.length > 0
    ? files
    : bodyUrl && isLessonDocumentUrl(bodyUrl) ? [{ url: bodyUrl }] : [];
  const text = bodyUrl && shown.length > 0 ? body.replace(bodyUrl, '').trim() : body;

  if (shown.length === 0 && !text) {
    return <BlockPlaceholder variant="materials" />;
  }

  return (
    <div className="space-y-4">
      {shown.length > 0 && <DocumentFilesList files={shown} />}
      {text && <TextBlock body={text} />}
    </div>
  );
}
