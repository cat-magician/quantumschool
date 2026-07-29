import {
  fetchYandexPublicDownloadUrl,
  fetchYandexPublicResourceMeta,
  isDirectImageUrl,
  isYandexDiskUrl,
} from './yandexDiskImageUtils';
import { isSupabaseLessonDocumentUrl, looksLikeImageDocumentUrl } from './contentDocumentUtils';

const PDF_EXT = /\.pdf(\?|#|$)/i;
const OFFICE_EXT = /\.(pptx?|docx?|xlsx?|odp|ods|odt)(\?|#|$)/i;

const OFFICE_MIME_PREFIXES = [
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-',
  'application/msword',
  'application/mspowerpoint',
  'application/msexcel',
  'application/vnd.oasis.opendocument',
];

export type LessonDocumentKind = 'pdf' | 'office' | 'download_only';

export type ResolvedLessonDocument = {
  kind: LessonDocumentKind;
  viewerUrl: string;
  downloadUrl: string;
  fileName?: string;
  sourceUrl: string;
};

export function extractPdfUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+\.pdf(?:[^\s<>"']*)?/i);
  return match?.[0] ?? null;
}

/** PDF или публичная ссылка Яндекс.Диска из текста блока. */
export function extractDocumentUrlFromText(text: string): string | null {
  const pdf = extractPdfUrlFromText(text);
  if (pdf) return pdf;

  const yandex = text.match(/https?:\/\/(?:disk(?:\.360)?\.yandex\.(?:ru|com)|yadi\.sk)\/[^\s<>"']+/i);
  return yandex?.[0] ?? null;
}

export function looksLikePdfUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (PDF_EXT.test(trimmed)) return true;
  try {
    const path = new URL(trimmed).pathname.toLowerCase();
    return path.endsWith('.pdf');
  } catch {
    return false;
  }
}

export function isLessonDocumentUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isSupabaseLessonDocumentUrl(trimmed)) return true;
  if (looksLikeImageDocumentUrl(trimmed) || isDirectImageUrl(trimmed)) return true;
  if (isYandexDiskUrl(trimmed)) return true;
  if (looksLikePdfUrl(trimmed)) return true;
  if (OFFICE_EXT.test(trimmed)) return true;
  return false;
}

export function isLessonImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (looksLikeImageDocumentUrl(trimmed) || isDirectImageUrl(trimmed)) return true;
  if (isSupabaseLessonDocumentUrl(trimmed) && looksLikeImageDocumentUrl(trimmed)) return true;
  return false;
}

export function filenameFromUrl(url: string, fallback = 'document.pdf'): string {
  try {
    const name = decodeURIComponent(new URL(url.trim()).pathname.split('/').pop() ?? '');
    if (name && name !== '/') return name;
  } catch {
    /* ignore */
  }
  return fallback;
}

function isOfficeFile(name: string, mimeType?: string): boolean {
  if (OFFICE_EXT.test(name)) return true;
  if (!mimeType) return false;
  const lower = mimeType.toLowerCase();
  return OFFICE_MIME_PREFIXES.some((p) => lower.startsWith(p));
}

function isPdfFile(name: string, mimeType?: string): boolean {
  if (PDF_EXT.test(name)) return true;
  return mimeType === 'application/pdf';
}

function officeEmbedUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

async function resolveYandexDiskDocument(publicUrl: string): Promise<ResolvedLessonDocument> {
  const meta = await fetchYandexPublicResourceMeta(publicUrl);

  if (meta.type === 'dir') {
    throw new Error('Укажите ссылку на файл на Яндекс.Диске, а не на папку.');
  }

  const downloadUrl = await fetchYandexPublicDownloadUrl(publicUrl);
  const name = meta.name ?? filenameFromUrl(publicUrl, 'material');
  const mime = meta.mime_type;

  if (isPdfFile(name, mime)) {
    return {
      kind: 'pdf',
      viewerUrl: downloadUrl,
      downloadUrl,
      fileName: name,
      sourceUrl: publicUrl,
    };
  }

  if (isOfficeFile(name, mime)) {
    return {
      kind: 'office',
      viewerUrl: officeEmbedUrl(downloadUrl),
      downloadUrl,
      fileName: name,
      sourceUrl: publicUrl,
    };
  }

  return {
    kind: 'download_only',
    viewerUrl: publicUrl,
    downloadUrl,
    fileName: name,
    sourceUrl: publicUrl,
  };
}

/** Подготовка ссылки для встроенного просмотра (PDF, презентации с Я.Диска и др.). */
export async function resolveLessonDocument(rawUrl: string): Promise<ResolvedLessonDocument> {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error('Пустая ссылка');

  if (isSupabaseLessonDocumentUrl(trimmed)) {
    if (looksLikeImageDocumentUrl(trimmed)) {
      throw new Error('Изображение отображается напрямую на странице');
    }
    if (looksLikePdfUrl(trimmed)) {
      return {
        kind: 'pdf',
        viewerUrl: trimmed,
        downloadUrl: trimmed,
        fileName: filenameFromUrl(trimmed),
        sourceUrl: trimmed,
      };
    }
  }

  if (isYandexDiskUrl(trimmed)) {
    return resolveYandexDiskDocument(trimmed);
  }

  if (looksLikePdfUrl(trimmed)) {
    return {
      kind: 'pdf',
      viewerUrl: trimmed,
      downloadUrl: trimmed,
      fileName: filenameFromUrl(trimmed),
      sourceUrl: trimmed,
    };
  }

  if (OFFICE_EXT.test(trimmed)) {
    return {
      kind: 'office',
      viewerUrl: officeEmbedUrl(trimmed),
      downloadUrl: trimmed,
      fileName: filenameFromUrl(trimmed, 'presentation.pptx'),
      sourceUrl: trimmed,
    };
  }

  throw new Error('Поддерживаются публичные ссылки Яндекс.Диска и прямые ссылки на PDF или Office-файлы.');
}

/** @deprecated используйте resolveLessonDocument */
export async function resolvePdfDocumentUrl(rawUrl: string): Promise<string> {
  const doc = await resolveLessonDocument(rawUrl);
  return doc.viewerUrl;
}

export function pdfViewerTitle(
  title: string | undefined,
  url: string,
  fileName?: string,
): string {
  const custom = title?.trim();
  if (custom) return custom;
  if (fileName?.trim()) {
    return fileName.replace(/\.(pdf|pptx?|docx?|xlsx?)$/i, '').replace(/[-_]+/g, ' ');
  }
  const fromUrl = filenameFromUrl(url, '');
  if (fromUrl && fromUrl !== 'document.pdf') {
    return fromUrl.replace(/\.(pdf|pptx?|docx?|xlsx?)$/i, '').replace(/[-_]+/g, ' ');
  }
  return 'Материалы занятия';
}
