import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  type PDFContext,
  type PDFObject,
} from 'pdf-lib';

/**
 * Сжатие PDF перед загрузкой. Тяжёлыми PDF делают картинки: сканы страниц и
 * фотографии на слайдах. Их уменьшаем до MAX_SIDE по длинной стороне (A4 —
 * около 170 dpi, читается и на телефоне) и пережимаем в JPEG. Текст, формулы
 * и векторную графику не трогаем. Картинку, которую не умеем разобрать
 * (CMYK, JPEG 2000, маски, палитры), оставляем как есть. Если файл не стал
 * заметно меньше или после пересборки не открывается — возвращаем null, и
 * грузится исходный.
 *
 * Модуль тяжёлый (pdf-lib) и подгружается только при загрузке PDF.
 */

const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.75;
/** Картинка лежала без потерь — пережимаем бережнее. */
const LOSSLESS_SOURCE_QUALITY = 0.82;
/** Мелочь (значки, логотипы) пережимать незачем. */
const MIN_STREAM_BYTES = 48 * 1024;
/** Замена окупается, только если картинка заметно похудела. */
const KEEP_RATIO = 0.85;
/** Меньше стольких цветов — схема или скриншот, а не фото: JPEG её испортит. */
const FLAT_COLOR_LIMIT = 256;

export type PdfCompressProgress = (done: number, total: number) => void;

const name = (value: string) => PDFName.of(value);
const NAME = {
  Subtype: name('Subtype'),
  Image: name('Image'),
  Width: name('Width'),
  Height: name('Height'),
  BitsPerComponent: name('BitsPerComponent'),
  ColorSpace: name('ColorSpace'),
  Filter: name('Filter'),
  DecodeParms: name('DecodeParms'),
  Decode: name('Decode'),
  DL: name('DL'),
  ImageMask: name('ImageMask'),
  Mask: name('Mask'),
  SMask: name('SMask'),
  Matte: name('Matte'),
  DCTDecode: name('DCTDecode'),
  FlateDecode: name('FlateDecode'),
  DeviceRGB: name('DeviceRGB'),
  DeviceGray: name('DeviceGray'),
  ICCBased: name('ICCBased'),
  N: name('N'),
  Predictor: name('Predictor'),
  Colors: name('Colors'),
  Columns: name('Columns'),
  ColorTransform: name('ColorTransform'),
};

type Candidate = {
  ref: PDFRef;
  stream: PDFRawStream;
  width: number;
  height: number;
  components: 1 | 3;
  colorSpace: PDFObject;
  source: 'jpeg' | 'flate';
  predictor: number;
};

type Encoded = { bytes: Uint8Array; width: number; height: number; filter: PDFName; colorSpace: PDFObject };

export async function compressPdf(
  bytes: Uint8Array,
  onProgress?: PdfCompressProgress,
): Promise<Uint8Array | null> {
  let doc: PDFDocument;
  try {
    // Зашифрованные PDF pdf-lib не пересобирает — такие грузятся как есть.
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    return null;
  }
  const pageCount = doc.getPageCount();
  const candidates = findCandidates(doc.context);
  if (candidates.length === 0) return null;

  let replaced = 0;
  for (let i = 0; i < candidates.length; i++) {
    onProgress?.(i, candidates.length);
    const candidate = candidates[i];
    const encoded = await recompress(candidate).catch(() => null);
    if (encoded && encoded.bytes.length < candidate.stream.contents.length * KEEP_RATIO) {
      replaceImage(doc.context, candidate, encoded);
      replaced++;
    }
    // Даём браузеру перерисовать счётчик между картинками.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  onProgress?.(candidates.length, candidates.length);
  if (replaced === 0) return null;

  try {
    const out = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
    if (out.length >= bytes.length * 0.95) return null;
    const check = await PDFDocument.load(out, { updateMetadata: false });
    if (check.getPageCount() !== pageCount) return null;
    return out;
  } catch {
    return null;
  }
}

function findCandidates(context: PDFContext): Candidate[] {
  const images: [PDFRef, PDFRawStream][] = [];
  const masks = new Set<PDFRef>();
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    if (object.dict.get(NAME.Subtype) !== NAME.Image) continue;
    images.push([ref, object]);
    for (const key of [NAME.SMask, NAME.Mask]) {
      const mask = object.dict.get(key);
      if (mask instanceof PDFRef) masks.add(mask);
    }
  }

  const candidates: Candidate[] = [];
  for (const [ref, stream] of images) {
    // Маски — альфа-каналы чужих картинок, их пиксели не трогаем.
    if (masks.has(ref)) continue;
    const candidate = describe(context, ref, stream);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function describe(context: PDFContext, ref: PDFRef, stream: PDFRawStream): Candidate | null {
  const dict = stream.dict;
  if (stream.contents.length < MIN_STREAM_BYTES) return null;
  const imageMask = dict.lookup(NAME.ImageMask);
  if (imageMask instanceof PDFBool && imageMask.asBoolean()) return null;
  if (dict.has(NAME.Decode)) return null;
  // Маска по цветовому ключу ([min max …]) после JPEG перестанет совпадать с пикселями.
  if (dict.lookup(NAME.Mask) instanceof PDFArray) return null;
  const smask = dict.lookup(NAME.SMask);
  if (smask instanceof PDFRawStream && smask.dict.has(NAME.Matte)) return null;
  if (numberOf(dict.lookup(NAME.BitsPerComponent)) !== 8) return null;

  const width = numberOf(dict.lookup(NAME.Width));
  const height = numberOf(dict.lookup(NAME.Height));
  if (!width || !height) return null;

  const colorSpace = dict.get(NAME.ColorSpace);
  const components = colorSpace ? componentsOf(context, colorSpace) : null;
  if (!colorSpace || !components) return null;

  const filter = filterOf(dict.lookup(NAME.Filter));
  let parms = dict.lookup(NAME.DecodeParms);
  if (parms instanceof PDFArray) parms = parms.size() === 1 ? parms.lookup(0) : undefined;
  if (filter === NAME.DCTDecode) {
    // ColorTransform меняет смысл каналов, браузер его не знает.
    if (parms instanceof PDFDict && parms.has(NAME.ColorTransform)) return null;
    return { ref, stream, width, height, components, colorSpace, source: 'jpeg', predictor: 1 };
  }
  if (filter === NAME.FlateDecode) {
    let predictor = 1;
    if (parms instanceof PDFDict) {
      predictor = numberOf(parms.lookup(NAME.Predictor)) ?? 1;
      const colors = numberOf(parms.lookup(NAME.Colors)) ?? 1;
      const columns = numberOf(parms.lookup(NAME.Columns)) ?? 1;
      if (predictor >= 10 && (colors !== components || columns !== width)) return null;
    }
    // TIFF-предиктор (2) встречается редко — не разбираем.
    if (predictor !== 1 && predictor < 10) return null;
    return { ref, stream, width, height, components, colorSpace, source: 'flate', predictor };
  }
  return null;
}

function numberOf(object: PDFObject | undefined): number | null {
  return object instanceof PDFNumber ? object.asNumber() : null;
}

/** Один фильтр — его имя; цепочки фильтров не разбираем. */
function filterOf(object: PDFObject | undefined): PDFName | null {
  if (object instanceof PDFName) return object;
  if (object instanceof PDFArray && object.size() === 1) {
    const only = object.lookup(0);
    return only instanceof PDFName ? only : null;
  }
  return null;
}

/** Серое (1) или RGB (3); CMYK, палитры, Lab и прочее — null. */
function componentsOf(context: PDFContext, colorSpace: PDFObject): 1 | 3 | null {
  const resolved = colorSpace instanceof PDFRef ? context.lookup(colorSpace) : colorSpace;
  if (resolved === NAME.DeviceRGB) return 3;
  if (resolved === NAME.DeviceGray) return 1;
  if (resolved instanceof PDFArray && resolved.size() === 2 && resolved.lookup(0) === NAME.ICCBased) {
    const profile = resolved.lookup(1);
    const n = profile instanceof PDFRawStream ? numberOf(profile.dict.lookup(NAME.N)) : null;
    return n === 3 ? 3 : n === 1 ? 1 : null;
  }
  return null;
}

async function recompress(candidate: Candidate): Promise<Encoded | null> {
  const { width, height } = candidate;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  // RGB-картинки сохраняют свой профиль: пиксели декодируем без перевода
  // цвета. Серые после canvas становятся RGB.
  const colorSpace = candidate.components === 3 ? candidate.colorSpace : NAME.DeviceRGB;

  if (candidate.source === 'jpeg') {
    const blob = new Blob([stripExif(candidate.stream.contents)], { type: 'image/jpeg' });
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    try {
      if (bitmap.width !== width || bitmap.height !== height) return null;
      const canvas = drawScaled(bitmap, targetWidth, targetHeight);
      const jpeg = await canvasToJpeg(canvas, JPEG_QUALITY);
      return { bytes: jpeg, width: targetWidth, height: targetHeight, filter: NAME.DCTDecode, colorSpace };
    } finally {
      bitmap.close();
    }
  }

  const raw = await inflate(candidate.stream.contents);
  const pixels = candidate.predictor >= 10
    ? unpredictPng(raw, width, candidate.components)
    : raw;
  if (!pixels || pixels.length < width * height * candidate.components) return null;

  if (isFlatGraphic(pixels, width * height, candidate.components)) {
    // Схему или скриншот не превращаем в JPEG — только уменьшаем, без потерь.
    if (scale === 1) return null;
    const canvas = drawScaled(pixelsToCanvas(pixels, width, height, candidate.components), targetWidth, targetHeight);
    const scaled = canvasPixels(canvas, candidate.components);
    return {
      bytes: await deflate(scaled),
      width: targetWidth,
      height: targetHeight,
      filter: NAME.FlateDecode,
      colorSpace: candidate.colorSpace,
    };
  }

  const canvas = drawScaled(pixelsToCanvas(pixels, width, height, candidate.components), targetWidth, targetHeight);
  const jpeg = await canvasToJpeg(canvas, LOSSLESS_SOURCE_QUALITY);
  return { bytes: jpeg, width: targetWidth, height: targetHeight, filter: NAME.DCTDecode, colorSpace };
}

function replaceImage(context: PDFContext, candidate: Candidate, encoded: Encoded) {
  const dict = candidate.stream.dict.clone(context);
  dict.delete(NAME.DecodeParms);
  dict.delete(NAME.DL);
  dict.set(NAME.Filter, encoded.filter);
  dict.set(NAME.Width, PDFNumber.of(encoded.width));
  dict.set(NAME.Height, PDFNumber.of(encoded.height));
  dict.set(NAME.BitsPerComponent, PDFNumber.of(8));
  dict.set(NAME.ColorSpace, encoded.colorSpace);
  // Length pdf-lib пересчитает при сохранении. SMask остаётся прежним:
  // PDF растягивает маску на картинку, совпадать размерами им не обязательно.
  context.assign(candidate.ref, PDFRawStream.of(dict, encoded.bytes));
}

/**
 * Без EXIF: PDF ориентацию из него не применяет, а браузер при декодировании
 * повернул бы пиксели, и картинка встала бы в рамку боком.
 */
function stripExif(jpeg: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const parts: Uint8Array[] = [jpeg.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= jpeg.length && jpeg[offset] === 0xff) {
    const marker = jpeg[offset + 1];
    if (marker === 0xda) break; // дальше сами данные картинки
    const length = (jpeg[offset + 2] << 8) | jpeg[offset + 3];
    if (marker !== 0xe1) parts.push(jpeg.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  parts.push(jpeg.subarray(offset));
  return concat(parts);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** PNG-предикторы Flate (10–15): у каждой строки свой фильтр в первом байте. */
function unpredictPng(data: Uint8Array, columns: number, bytesPerPixel: number): Uint8Array | null {
  const rowLength = columns * bytesPerPixel;
  const rows = Math.floor(data.length / (rowLength + 1));
  const out = new Uint8Array(rows * rowLength);
  let previous = new Uint8Array(rowLength);
  for (let row = 0; row < rows; row++) {
    const start = row * (rowLength + 1);
    const type = data[start];
    const source = data.subarray(start + 1, start + 1 + rowLength);
    const current = out.subarray(row * rowLength, (row + 1) * rowLength);
    for (let i = 0; i < rowLength; i++) {
      const left = i >= bytesPerPixel ? current[i - bytesPerPixel] : 0;
      const up = previous[i];
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      let value = source[i];
      if (type === 1) value += left;
      else if (type === 2) value += up;
      else if (type === 3) value += (left + up) >> 1;
      else if (type === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (type !== 0) return null;
      current[i] = value & 0xff;
    }
    previous = current;
  }
  return out;
}

function isFlatGraphic(pixels: Uint8Array, pixelCount: number, components: 1 | 3): boolean {
  const step = Math.max(1, Math.floor(pixelCount / 50_000));
  const seen = new Set<number>();
  for (let i = 0; i < pixelCount; i += step) {
    const offset = i * components;
    const key = components === 3
      ? (pixels[offset] << 16) | (pixels[offset + 1] << 8) | pixels[offset + 2]
      : pixels[offset];
    seen.add(key);
    if (seen.size > FLAT_COLOR_LIMIT) return false;
  }
  return true;
}

function pixelsToCanvas(pixels: Uint8Array, width: number, height: number, components: 1 | 3): HTMLCanvasElement {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, source = 0, target = 0; i < width * height; i++, target += 4) {
    if (components === 3) {
      rgba[target] = pixels[source];
      rgba[target + 1] = pixels[source + 1];
      rgba[target + 2] = pixels[source + 2];
      source += 3;
    } else {
      const gray = pixels[source++];
      rgba[target] = gray;
      rgba[target + 1] = gray;
      rgba[target + 2] = gray;
    }
    rgba[target + 3] = 255;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas;
}

function drawScaled(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasPixels(canvas: HTMLCanvasElement, components: 1 | 3): Uint8Array {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const out = new Uint8Array(canvas.width * canvas.height * components);
  for (let i = 0, source = 0, target = 0; i < canvas.width * canvas.height; i++, source += 4) {
    out[target++] = data[source];
    if (components === 3) {
      out[target++] = data[source + 1];
      out[target++] = data[source + 2];
    }
  }
  return out;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('canvas.toBlob failed');
  return new Uint8Array(await blob.arrayBuffer());
}
