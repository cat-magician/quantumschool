import type { HomeworkBlockContent, HomeworkBlockType, HomeworkPage } from './types';
import { formatDueDate } from './homeworkUtils';
import { toDatetimeLocalValue } from './scheduleUtils';

export const HOMEWORK_BLOCK_LABELS: Record<HomeworkBlockType, string> = {
  text: 'Задачи (Markdown)',
  image: 'Изображение',
  video: 'Видео',
  yandex_form: 'Яндекс.Форма (сдача)',
  contest: 'Яндекс.Контест (сдача)',
};

/** Блоки с условием задания */
export const HOMEWORK_CONTENT_BLOCK_TYPES: HomeworkBlockType[] = ['text', 'image', 'video'];

/** Блоки для приёма ответов */
export const HOMEWORK_SUBMISSION_BLOCK_TYPES: HomeworkBlockType[] = ['yandex_form', 'contest'];

export const HOMEWORK_BLOCK_TYPES: HomeworkBlockType[] = [
  ...HOMEWORK_CONTENT_BLOCK_TYPES,
  ...HOMEWORK_SUBMISSION_BLOCK_TYPES,
];

export function defaultHomeworkBlockContent(type: HomeworkBlockType): HomeworkBlockContent {
  switch (type) {
    case 'text':
      return { body: '' };
    case 'image':
      return { url: '', caption: '' };
    case 'video':
      return { url: '' };
    case 'yandex_form':
      return { form_id: '' };
    case 'contest':
      return { url: '' };
    default:
      return {};
  }
}

export function createDefaultHomeworkBlocks(): {
  block_type: HomeworkBlockType;
  sort_order: number;
  content: HomeworkBlockContent;
}[] {
  return [
    { block_type: 'text', sort_order: 0, content: { body: '' } },
    { block_type: 'yandex_form', sort_order: 1, content: { form_id: '' } },
  ];
}

export function formatHomeworkDueAt(iso: string | null | undefined) {
  if (!iso) return null;
  return formatDueDate(iso);
}

export function homeworkDueInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  return toDatetimeLocalValue(iso);
}

/** Порядок списка в админке: черновики → ближайший срок → недавно меняли. */
export const HOMEWORK_ADMIN_LIST_ORDER = [
  'is_published ASC',
  'due_at ASC NULLS LAST',
  'updated_at DESC',
] as const;

/** Для ученика: только опубликованные, ближайший срок сверху. */
export const HOMEWORK_STUDENT_LIST_ORDER = [
  'due_at ASC NULLS LAST',
  'updated_at DESC',
] as const;

export type HomeworkListSort = 'date' | 'deadline';

/** По умолчанию — порядок публикации; по клику — по сроку сдачи. */
export function sortHomeworkPagesForStudent<T extends Pick<HomeworkPage, 'created_at' | 'due_at' | 'updated_at'>>(
  pages: T[],
  sort: HomeworkListSort,
): T[] {
  const sorted = [...pages];
  if (sort === 'deadline') {
    return sorted.sort((a, b) => {
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }
  return sorted.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export type HomeworkDueUrgency = 'overdue' | 'burning';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function homeworkDueUrgency(dueAt: string | null | undefined): HomeworkDueUrgency | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  if (due < now) return 'overdue';
  if (due - now <= TWO_DAYS_MS) return 'burning';
  return null;
}

export function homeworkListDueText(dueAt: string | null | undefined) {
  if (!dueAt) return 'Без срока';
  return `Срок: ${formatHomeworkDueAt(dueAt)}`;
}

export function isHomeworkSubmissionBlock(type: HomeworkBlockType) {
  return type === 'yandex_form' || type === 'contest';
}

/** Восстанавливает LaTeX-команды после кривого JSON/SQL. */
function repairHomeworkLatex(text: string): string {
  let body = text.replace(/\u2028|\u2029/g, '\n');

  // SQL/JSON иногда сохраняет «\n» как два символа, а не перенос строки
  body = body.replace(/\\n/g, '\n');

  // $|+ + CR + angle (битый \rangle из JSON)
  body = body.replace(/\$\|\+\rangle/g, '$|+\\rangle$');
  body = body.replace(/\$H\|0\rangle/g, '$H|0\\rangle$');

  // Уже в $…$, но rangle разорван переносом
  body = body.replace(/\$\|\+\s*[\n\r ]+\s*\\?rangle\$/gi, '$|+\\rangle$');
  body = body.replace(/\$H\|0\s*[\n\r ]+\s*\\?rangle\$/gi, '$H|0\\rangle$');

  // Без $…$ — оборачиваем один раз (не трогаем уже корректный $|+\rangle$)
  body = body.replace(/(?<!\$)\|\+\s*[\n\r ]+\s*\\?rangle(?!\$)/gi, '$|+\\rangle$');

  body = body.replace(/\r\n?/g, '\n');
  body = body.replace(/\r(?=[a-zA-Z])/g, '\\r');
  body = body.replace(/\t(?=[a-zA-Z])/g, '\\t');
  body = body.replace(/\r/g, ' ');

  body = body
    .replace(/\$(\s+)igma_([xyz])\s*\$/gi, '$\\sigma_$2$')
    .replace(/\$\s*\\?sigma_([xyz])\s*\$/gi, '$\\sigma_$1$')
    .replace(/\$sigma_([xyz])\s*\$/gi, '$\\sigma_$1$');

  body = body.replace(/[ \t]+\n[ \t]*/g, '\n');
  body = body.replace(/(?<!\n)\n(?!\n)/g, ' ');

  return body;
}

/**
 * Собирает markdown: заголовки и списки отдельно, всё остальное — один абзац.
 * Убирает случайные переносы из SQL («Паули» + новая строка + «$\\sigma_z$»).
 */
function composeHomeworkMarkdown(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const sections: string[] = [];
  let heading: string | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (heading) {
      sections.push(heading);
      if (bodyLines.length) sections.push(bodyLines.join(' '));
    } else if (bodyLines.length) {
      sections.push(bodyLines.join(' '));
    }
    heading = null;
    bodyLines = [];
  };

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      flush();
      heading = line;
      continue;
    }
    if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line) || /^>/.test(line)) {
      flush();
      sections.push(line);
      continue;
    }
    bodyLines.push(line);
  }

  flush();
  return sections.join('\n\n');
}

/** Подготовка текста домашки перед markdown+KaTeX. */
export function normalizeHomeworkMarkdown(body: string) {
  if (!body?.trim()) return '';
  return composeHomeworkMarkdown(repairHomeworkLatex(body));
}
