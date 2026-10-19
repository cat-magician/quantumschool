import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/**
 * pdf.js для просмотра PDF на телефоне: там браузер не показывает PDF внутри
 * страницы. Сборка legacy работает и на старых телефонах. Модуль тяжёлый и
 * подгружается, только когда ученик нажал «Показать здесь».
 */
GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };

export function openPdf(url: string): PDFDocumentLoadingTask {
  return getDocument({
    url,
    // Сканы с JBIG2 и JPEG 2000 декодируются wasm-модулями (см. vite.config.ts).
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
    // Не тянуть файл заранее: если сервер отдаёт его кусками, придёт только
    // то, что нужно для пролистанных страниц.
    disableAutoFetch: true,
    disableStream: true,
  });
}

/** Больше ~6 Мп на страницу старые телефоны рисуют с трудом. */
const MAX_PAGE_PIXELS = 6_000_000;

/**
 * Страница картинкой под ширину cssWidth. Плотность с запасом в полтора раза:
 * страницу увеличивают щипком, и текст должен остаться чётким.
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  cssWidth: number,
): Promise<{ blob: Blob; aspect: number }> {
  const page = await doc.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const density = Math.min(window.devicePixelRatio || 1, 2.5) * 1.5;
    let scale = (cssWidth * density) / base.width;
    if (base.width * base.height * scale * scale > MAX_PAGE_PIXELS) {
      scale = Math.sqrt(MAX_PAGE_PIXELS / (base.width * base.height));
    }
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });
    // Холст больше не нужен — картинка уже в blob; память телефона не держим.
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new Error('Не удалось нарисовать страницу');
    return { blob, aspect: base.height / base.width };
  } finally {
    page.cleanup();
  }
}
