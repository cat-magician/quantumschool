import type { Achievement, AchievementDefinition } from './types';
import { publicAsset } from './appPaths';

/** Рисунки первых трёх достижений — показываются, пока у них нет своей картинки. */
export type AchievementIconKey = 'send' | 'check' | 'star';

export const LEGACY_ACHIEVEMENT_ART: Record<string, AchievementIconKey> = {
  homework_first_submit: 'send',
  homework_first_graded: 'check',
  homework_excellent: 'star',
};

/** Выданные до каталога достижения хранят только название. */
const LEGACY_TITLE_CODES: Record<string, string> = {
  'Первое ДЗ': 'homework_first_submit',
  'ДЗ проверено': 'homework_first_graded',
  'Отличная работа': 'homework_excellent',
};

/** Пока в базе нет каталога (schema.sql не прогнан), «Прогресс» показывает эти три. */
export const FALLBACK_ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    code: 'homework_first_submit',
    title: 'Первое ДЗ',
    description: 'Вы отправили работу на проверку',
    hint: 'Отправьте любое домашнее задание на проверку — кнопка «Отправить на проверку» на странице задания.',
    image_url: '',
    sort_order: 10,
  },
  {
    code: 'homework_first_graded',
    title: 'ДЗ проверено',
    description: 'Преподаватель проверил вашу работу и поставил оценку',
    hint: 'Получите первую оценку от преподавателя за домашнее задание.',
    image_url: '',
    sort_order: 20,
  },
  {
    code: 'homework_excellent',
    title: 'Отличная работа',
    description: 'Оценка за домашнее задание — не меньше 80% от максимума',
    hint: 'Получите за домашнее задание не меньше 80% от максимального балла.',
    image_url: '',
    sort_order: 30,
  },
];

export function achievementCode(a: Pick<Achievement, 'code' | 'title'>): string | null {
  return a.code?.trim() || LEGACY_TITLE_CODES[a.title?.trim() ?? ''] || null;
}

/** Код достижения → когда ученик его получил. */
export function earnedAchievementDates(achievements: Achievement[], userId: string): Map<string, string> {
  const dates = new Map<string, string>();
  for (const a of achievements) {
    if (a.user_id !== userId) continue;
    const code = achievementCode(a);
    if (code && !dates.has(code)) dates.set(code, a.earned_at);
  }
  return dates;
}

/** Полученные достижения из каталога, в порядке каталога. */
export function collectEarnedCodes(
  achievements: Achievement[],
  userId: string,
  catalog: AchievementDefinition[],
): string[] {
  const dates = earnedAchievementDates(achievements, userId);
  return catalog.filter((d) => dates.has(d.code)).map((d) => d.code);
}

export function formatAchievementsProgress(count: number, total: number) {
  return `${count}/${total}`;
}

/** Путь от корня сайта превращается в адрес с учётом base path сборки. */
export function achievementImageSrc(imageUrl: string | null | undefined): string | null {
  const url = imageUrl?.trim();
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return publicAsset(url);
}

/** Что показать в окне «Вы получили новое достижение!». */
export type AchievementUnlock = {
  /** Строка в achievements — по ней окно отмечается просмотренным. */
  id: string;
  code: string | null;
  title: string;
  description: string;
  imageSrc: string | null;
};

/** null — достижения нет в каталоге (выключено): окно по нему не показываем. */
export function toAchievementUnlock(
  row: Achievement,
  catalog: AchievementDefinition[],
): AchievementUnlock | null {
  const code = achievementCode(row);
  const definition = code ? catalog.find((d) => d.code === code) : undefined;
  if (!definition) return null;
  return {
    id: row.id,
    code,
    title: definition.title,
    description: definition.description,
    imageSrc: achievementImageSrc(definition.image_url),
  };
}
