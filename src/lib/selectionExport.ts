import type { UserProfile } from './types';
import { profileContactEmail, profileEmail, profileLogin } from './profileUtils';
import { selectionVerdict } from './selectionDisplayUtils';
import { stageSubmitted } from './selectionFilters';

/**
 * Выгрузка участников отбора в CSV.
 *
 * Разделитель — точка с запятой, в начале BOM: только так Excel с русской
 * локалью открывает файл сразу таблицей и не ломает кириллицу.
 */

const SEPARATOR = ';';
const ROW_END = '\r\n';

const COLUMNS = [
  'Имя',
  'Почта для связи',
  'Тип аккаунта',
  'Почта (Яндекс)',
  'Логин',
  'Логин Яндекса',
  'Почта для восстановления',
  'Город',
  'Школа',
  'Класс',
  'Анкета отправлена',
  'Эссе отправлено',
  'Балл за эссе',
  'Задачи отправлены',
  'Балл за задачи',
  'Решение',
  'Зарегистрирован',
  'ID аккаунта',
] as const;

const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Локальное время — его же показывает выгрузка Яндекс.Форм, удобно сверять. */
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return dateTimeFmt.format(date);
}

function escapeCell(value: string): string {
  if (!/[;"\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

const VERDICT_LABELS = {
  accepted: 'Зачислен',
  rejected: 'Отказ',
  waiting: 'Без решения',
} as const;

export function selectionExportRow(p: UserProfile): string[] {
  const login = profileLogin(p);
  return [
    p.display_name?.trim() ?? '',
    profileContactEmail(p) ?? '',
    login ? 'Логин' : 'Яндекс ID',
    profileEmail(p) ?? '',
    login ?? '',
    p.yandex_login?.trim() ?? '',
    p.recovery_email?.trim() ?? '',
    p.city?.trim() ?? '',
    p.school?.trim() ?? '',
    p.grade?.trim() ?? '',
    formatDateTime(p.questionnaire_submitted_at),
    stageSubmitted(p.stage1_status, p.stage1_submitted_at) ? formatDateTime(p.stage1_submitted_at) || 'отмечено' : '',
    p.stage1_score === null ? '' : String(p.stage1_score),
    stageSubmitted(p.stage2_status, p.stage2_submitted_at) ? formatDateTime(p.stage2_submitted_at) || 'отмечено' : '',
    p.stage2_score === null ? '' : String(p.stage2_score),
    VERDICT_LABELS[selectionVerdict(p.is_enrolled, !!p.selection_rejected)],
    formatDateTime(p.created_at),
    p.id,
  ];
}

export function buildSelectionCsv(rows: UserProfile[]): string {
  const body = rows.map((row) => selectionExportRow(row).map(escapeCell).join(SEPARATOR));
  return [COLUMNS.join(SEPARATOR), ...body].join(ROW_END) + ROW_END;
}

export function selectionExportFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `otbor-${stamp}.csv`;
}

/** Отдаёт файл браузеру. BOM обязателен — без него Excel читает UTF-8 как ANSI. */
export function downloadSelectionCsv(rows: UserProfile[], fileName = selectionExportFileName()): void {
  const blob = new Blob([`\uFEFF${buildSelectionCsv(rows)}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
