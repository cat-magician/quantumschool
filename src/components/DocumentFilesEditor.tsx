import { useRef, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, FileText, FileUp, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useAppDialog } from '../lib/AppDialogContext';
import type { DocumentFile } from '../lib/types';
import {
  LESSON_DOCUMENT_ACCEPT,
  LESSON_DOCUMENT_HINT,
  documentTitleFromFileName,
  formatFileSize,
  isSupabaseLessonDocumentUrl,
  uploadLessonDocument,
  type DocumentUploadProgress,
} from '../lib/contentDocumentUtils';
import { isLessonDocumentUrl } from '../lib/pdfDocumentUtils';
import { isYandexDiskUrl } from '../lib/yandexDiskImageUtils';

function progressText(progress: DocumentUploadProgress, file: File): string {
  if (progress.stage === 'upload') return 'отправляем…';
  if (file.type !== 'application/pdf') return 'сжимаем картинку…';
  return progress.total > 0
    ? `сжимаем картинки внутри: ${progress.done} из ${progress.total}`
    : 'сжимаем…';
}

/** «PDF · 889 КБ», «Яндекс.Диск», «Ссылка · PDF». */
function fileMeta(file: DocumentFile): string {
  const url = file.url.trim();
  if (isYandexDiskUrl(url)) return 'Яндекс.Диск';
  const ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)?.[1]?.toUpperCase();
  const kind = isSupabaseLessonDocumentUrl(url) ? ext ?? 'Файл' : `Ссылка${ext ? ` · ${ext}` : ''}`;
  return file.size ? `${kind} · ${formatFileSize(file.size)}` : kind;
}

/**
 * Файлы блока: загрузить сразу несколько (или перетащить), переименовать,
 * переставить, убрать. Каждый файл перед загрузкой сжимается.
 */
export default function DocumentFilesEditor({
  files,
  onChange,
}: {
  files: DocumentFile[];
  onChange: (files: DocumentFile[]) => void;
}) {
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  // Файлы грузятся по очереди, и список меняется между загрузками: берём свежий.
  const filesRef = useRef(files);
  filesRef.current = files;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState<{ text: string; error: boolean }[]>([]);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [dragging, setDragging] = useState(false);

  const uploadAll = async (list: File[]) => {
    if (!user || list.length === 0 || busy) return;
    setBusy(true);
    setNotes([]);
    const results: { text: string; error: boolean }[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const who = list.length > 1 ? `«${file.name}» (${i + 1} из ${list.length})` : `«${file.name}»`;
      setStatus(`${who}: сжимаем…`);
      const uploaded = await uploadLessonDocument(user.id, file, (progress) => {
        setStatus(`${who}: ${progressText(progress, file)}`);
      });
      if (uploaded.error !== null) {
        results.push({ text: `«${file.name}»: ${uploaded.error}`, error: true });
        continue;
      }
      const next = [
        ...filesRef.current,
        { url: uploaded.url, title: documentTitleFromFileName(file.name), size: uploaded.size },
      ];
      filesRef.current = next;
      onChange(next);
      results.push({
        text: uploaded.size < uploaded.originalSize
          ? `«${file.name}»: сжато ${formatFileSize(uploaded.originalSize)} → ${formatFileSize(uploaded.size)}`
          : `«${file.name}»: загружен, ${formatFileSize(uploaded.size)}`,
        error: false,
      });
    }
    setBusy(false);
    setStatus('');
    setNotes(results);
  };

  const update = (index: number, patch: Partial<DocumentFile>) => {
    onChange(files.map((file, i) => (i === index ? { ...file, ...patch } : file)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...files];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    onChange(next);
  };

  const remove = async (index: number) => {
    const name = files[index].title?.trim() || 'без названия';
    const ok = await confirm({
      title: 'Убрать файл?',
      message: `«${name}» пропадёт со страницы после сохранения.`,
      confirmLabel: 'Убрать',
      danger: true,
    });
    if (ok) onChange(files.filter((_, i) => i !== index));
  };

  const addLink = () => {
    const url = link.trim();
    if (!/^https?:\/\//i.test(url) || !isLessonDocumentUrl(url)) {
      setLinkError('Такую ссылку на странице не показать. Подойдёт публичная ссылка Яндекс.Диска или прямая ссылка на PDF — или загрузите файл.');
      return;
    }
    onChange([...files, { url, title: '' }]);
    setLink('');
    setLinkError('');
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void uploadAll(Array.from(event.dataTransfer.files));
  };

  const uploadButton = (label: string) => (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={busy || !user}
      className="inline-flex w-full sm:w-auto items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
      {busy ? 'Загрузка…' : label}
    </button>
  );

  return (
    <div
      className={`space-y-3 rounded-xl transition-shadow ${dragging ? 'ring-2 ring-blue-500/60' : ''}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={LESSON_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void uploadAll(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />

      {files.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/15 bg-slate-950/40 px-4 py-6 text-center">
          <FileText className="w-7 h-7 text-slate-500" aria-hidden />
          <p className="text-sm text-slate-300">Загрузите файлы или перетащите их сюда</p>
          {uploadButton('Загрузить файлы')}
          <p className="text-[11px] text-slate-600 leading-relaxed max-w-md">{LESSON_DOCUMENT_HINT}</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li key={`${file.url}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
                <input
                  value={file.title ?? ''}
                  onChange={(event) => update(index, { title: event.target.value })}
                  placeholder="Название файла"
                  aria-label="Название файла"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm"
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[11px] text-slate-500">{fileMeta(file)}</span>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 py-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Открыть
                  </a>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="p-2.5 sm:p-1.5 rounded-lg hover:bg-white/5 text-slate-500 disabled:opacity-30"
                      aria-label="Файл выше"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === files.length - 1}
                      className="p-2.5 sm:p-1.5 rounded-lg hover:bg-white/5 text-slate-500 disabled:opacity-30"
                      aria-label="Файл ниже"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { void remove(index); }}
                      className="p-2.5 sm:p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-300"
                      aria-label="Убрать файл"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {uploadButton('Добавить файлы')}
            <p className="text-[11px] text-slate-600 leading-relaxed">{LESSON_DOCUMENT_HINT}</p>
          </div>
        </>
      )}

      {status && <p className="text-[11px] text-slate-400" role="status">{status}</p>}
      {notes.length > 0 && (
        <ul className="space-y-0.5" role="status">
          {notes.map((note) => (
            <li key={note.text} className={`text-[11px] ${note.error ? 'text-rose-400' : 'text-emerald-400'}`}>
              {note.text}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={link}
          onChange={(event) => {
            setLink(event.target.value);
            setLinkError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addLink();
            }
          }}
          placeholder="Или ссылка: Яндекс.Диск, PDF"
          aria-label="Ссылка на файл"
          className="flex-1 min-w-[12rem] px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
        />
        <button
          type="button"
          onClick={addLink}
          disabled={!link.trim()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50"
        >
          Добавить ссылку
        </button>
      </div>
      {linkError && <p className="text-[11px] text-rose-400">{linkError}</p>}
    </div>
  );
}
