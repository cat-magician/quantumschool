import { useId, useState } from 'react';
import { ChevronDown, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { FormSelect } from './FormControls';
import { FORM_KIND_LABELS, type ColumnMapping, type FormKind } from '../lib/identityMatching';
import type { TableData } from '../lib/tableImport';

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'code', label: 'Код участника' },
  { key: 'name', label: 'ФИО' },
  { key: 'email', label: 'Почта' },
  { key: 'submittedAt', label: 'Время отправки' },
  { key: 'work', label: 'Ссылка на работу' },
  { key: 'login', label: 'Логин или ник' },
  { key: 'city', label: 'Город' },
  { key: 'school', label: 'Школа' },
  { key: 'grade', label: 'Класс' },
];

/**
 * Выгрузка отдаёт время в поясе владельца формы, а сравниваем мы с метками
 * нашей базы в поясе браузера. Поправку задаём руками: угадать её из файла
 * нельзя, зоны в нём просто нет.
 */
const OFFSET_OPTIONS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((hours) => ({
  value: String(hours),
  label: hours === 0
    ? 'Как в файле'
    : `${hours > 0 ? '+' : '−'}${Math.abs(hours)} ч`,
}));

const FORM_KINDS: FormKind[] = ['questionnaire', 'essay', 'contest'];

function columnOptions(headers: string[]) {
  return [
    { value: '', label: 'Нет такой колонки' },
    ...headers.map((header, index) => ({
      value: String(index),
      label: header.trim() || `Колонка ${index + 1}`,
    })),
  ];
}

/**
 * Приём файлов. Брать можно сразу несколько: формы связаны между собой, и
 * разбирать их вместе точнее, чем по очереди.
 */
export function FormDropzone({
  parsing,
  error,
  onFilesSelected,
  compact = false,
}: {
  parsing: boolean;
  error: string | null;
  onFilesSelected: (files: File[]) => void;
  /** Когда файлы уже загружены, зона ужимается до одной строки. */
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const handle = (files: FileList | null) => {
    const list = files ? [...files] : [];
    if (list.length > 0) onFilesSelected(list);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files);
        }}
        className={`rounded-2xl border border-dashed transition-colors ${
          dragging ? 'border-blue-500/60 bg-blue-500/5' : 'border-white/15 bg-slate-900/40'
        }`}
      >
        <label
          htmlFor={inputId}
          className={`flex flex-col items-center gap-2 text-center cursor-pointer ${
            compact ? 'px-4 py-4' : 'px-6 py-10'
          }`}
        >
          {parsing
            ? <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            : <Upload className={compact ? 'w-4 h-4 text-slate-500' : 'w-6 h-6 text-slate-500'} />}
          <span className="text-sm text-white font-medium">
            {parsing ? 'Читаем файлы…' : compact ? 'Добавить ещё выгрузку' : 'Перетащите выгрузки или выберите файлы'}
          </span>
          {!compact && (
            <span className="text-xs text-slate-500">
              Анкета, эссе, монитор Контеста и zip-архив посылок — можно всё сразу:
              архив с монитором склеятся сами. Файлы разбираются в браузере и никуда
              не уходят
            </span>
          )}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,.xlsx,.zip"
          multiple
          className="sr-only"
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}

/** Одна загруженная выгрузка: какая это форма и как размечены её колонки. */
export default function FormImportPanel({
  kind,
  onKindChange,
  fileName,
  table,
  mapping,
  onMappingChange,
  offsetHours,
  onOffsetChange,
  onRemove,
  note,
}: {
  kind: FormKind;
  onKindChange: (kind: FormKind) => void;
  fileName: string;
  table: TableData;
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  offsetHours: number;
  onOffsetChange: (hours: number) => void;
  onRemove: () => void;
  /** Из чего собрана таблица, если она не один файл. */
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">{fileName}</p>
          <p className="text-xs text-slate-500">
            {table.rows.length} строк, {table.headers.length} колонок
          </p>
          {note && <p className="text-xs text-blue-300/80 mt-0.5">{note}</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          Колонки
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-white/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Убрать
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FORM_KINDS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={kind === item}
            onClick={() => onKindChange(item)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              kind === item
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            {FORM_KIND_LABELS[item]}
          </button>
        ))}
      </div>

      {open && (
        <div id={panelId} className="pt-3 border-t border-white/5 space-y-3">
          <p className="text-xs text-slate-500">
            Определены по заголовкам — поправьте, если угадано неверно. Обязательна хотя бы
            одна: код участника, ФИО, почта или логин. Если в форме есть код, остальное не
            понадобится.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MAPPING_FIELDS.map((field) => (
              <div key={field.key} className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {field.label}
                </p>
                <FormSelect
                  value={mapping[field.key] === null ? '' : String(mapping[field.key])}
                  onChange={(value) => onMappingChange({
                    ...mapping,
                    [field.key]: value === '' ? null : Number(value),
                  })}
                  options={columnOptions(table.headers)}
                />
              </div>
            ))}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Поправка времени
              </p>
              <FormSelect
                value={String(offsetHours)}
                onChange={(value) => onOffsetChange(Number(value))}
                options={OFFSET_OPTIONS}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
