import type { LessonBlockContent, LessonBlockType, LessonPageType } from './types';

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
      return { url: '', label: 'Перейти к домашнему заданию' };
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
