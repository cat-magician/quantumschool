import type {
  LessonBlockContent, LessonBlockType, LessonPage, LessonPageBlock, LessonPageType, ScheduleEvent,
} from './types';

export const LESSON_TYPE_LABELS: Record<LessonPageType, string> = {
  lecture: 'Лекция',
  seminar: 'Семинар',
};

export const LESSON_BLOCK_LABELS: Record<LessonBlockType, string> = {
  recording: 'Запись занятия',
  text: 'Текст',
  materials: 'Конспект и материалы',
  homework_link: 'Домашнее задание',
};

export const LESSON_BLOCK_TYPES: LessonBlockType[] = [
  'recording',
  'text',
  'materials',
  'homework_link',
];

export function defaultBlockContent(type: LessonBlockType): LessonBlockContent {
  switch (type) {
    case 'recording':
      return { url: '' };
    case 'text':
    case 'materials':
      return { body: '', pdf_url: '', pdf_title: '' };
    case 'homework_link':
      return { homework_page_id: '', label: 'Перейти к домашнему заданию' };
    default:
      return {};
  }
}

export function createDefaultBlocks(): {
  block_type: LessonBlockType;
  sort_order: number;
  content: LessonBlockContent;
}[] {
  return LESSON_BLOCK_TYPES.map((block_type, sort_order) => ({
    block_type,
    sort_order,
    content: defaultBlockContent(block_type),
  }));
}

export function formatLessonDate(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function lessonDateInputValue(dateStr: string) {
  return dateStr.slice(0, 10);
}

/** Пустой блок ученику не показываем: на опубликованной странице он выглядел бы недоделкой. */
export function isLessonBlockEmpty(block: Pick<LessonPageBlock, 'block_type' | 'content'>): boolean {
  const c = block.content ?? {};
  switch (block.block_type) {
    case 'recording':
      return !c.url?.trim();
    case 'text':
      return !c.body?.trim();
    case 'materials':
      return !c.pdf_url?.trim() && !c.body?.trim();
    case 'homework_link':
      return !c.homework_page_id?.trim() && !c.url?.trim();
    default:
      return true;
  }
}

/** Время занятия со страницы: у страницы в расписании — её событие. */
export type LessonEventTime = Pick<ScheduleEvent, 'id' | 'scheduled_at' | 'duration_minutes'>;

export type LessonPageWithEvent = LessonPage & {
  schedule_events?: LessonEventTime[] | LessonEventTime | null;
};

/** Списку лекций и семинаров — со временем занятия из расписания. */
export const LESSON_LIST_SELECT = '*, schedule_events(id, scheduled_at, duration_minutes)';

export function lessonEventTime(page: LessonPageWithEvent): LessonEventTime | null {
  const raw = page.schedule_events;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

/**
 * Предстоящие занятия — ближайшее сверху, прошедшие — свежее сверху, как в
 * расписании. Без времени в расписании занятие длится весь свой день.
 */
export function splitLessonsByTime<T extends LessonPageWithEvent>(pages: T[], now = Date.now()) {
  const items = pages.map((page) => {
    const event = lessonEventTime(page);
    const start = event
      ? new Date(event.scheduled_at).getTime()
      : new Date(`${page.lesson_date.slice(0, 10)}T00:00:00`).getTime();
    const end = event
      ? start + event.duration_minutes * 60_000
      : new Date(`${page.lesson_date.slice(0, 10)}T23:59:59`).getTime();
    return { page, event, start, end };
  });
  return {
    upcoming: items.filter((x) => x.end > now).sort((a, b) => a.start - b.start),
    past: items.filter((x) => x.end <= now).sort((a, b) => b.start - a.start),
  };
}
