import type { Achievement } from './types';

export type AchievementIconKey = 'send' | 'check' | 'star';

export const ACHIEVEMENT_DEFINITIONS: {
  key: AchievementIconKey;
  title: string;
  hint: string;
}[] = [
  {
    key: 'send',
    title: 'Первое ДЗ',
    hint: 'Отправьте любое домашнее задание на проверку — нажмите «Отправить на проверку» на странице ДЗ.',
  },
  {
    key: 'check',
    title: 'ДЗ проверено',
    hint: 'Получите первую оценку от преподавателя за домашнее задание.',
  },
  {
    key: 'star',
    title: 'Отличная работа',
    hint: 'Получите оценку 8 или выше за домашнее задание.',
  },
];

export const ACHIEVEMENT_CATALOG = ACHIEVEMENT_DEFINITIONS.map((d) => d.title);

export const TOTAL_ACHIEVEMENTS_POSSIBLE = ACHIEVEMENT_DEFINITIONS.length;

export const ALL_ACHIEVEMENT_KEYS = ACHIEVEMENT_DEFINITIONS.map((d) => d.key);

export function resolveAchievementKey(a: Pick<Achievement, 'title' | 'icon'>): AchievementIconKey {
  if (a.icon === 'send' || a.icon === 'check' || a.icon === 'star') return a.icon;
  const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.title === a.title);
  return def?.key ?? 'send';
}

export function collectEarnedKeys(achievements: Achievement[], userId: string): AchievementIconKey[] {
  const keys = new Set<AchievementIconKey>();
  for (const a of achievements) {
    if (a.user_id === userId) keys.add(resolveAchievementKey(a));
  }
  return ALL_ACHIEVEMENT_KEYS.filter((k) => keys.has(k));
}

export function formatAchievementsProgress(count: number) {
  return `${count}/${TOTAL_ACHIEVEMENTS_POSSIBLE}`;
}

export function achievementEarnedAt(
  achievements: Achievement[],
  userId: string,
  key: AchievementIconKey,
): string | null {
  const match = achievements.find(
    (a) => a.user_id === userId && resolveAchievementKey(a) === key,
  );
  return match?.earned_at ?? null;
}
