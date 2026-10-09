/**
 * Значения полей даты и времени. Формы хранят строки, как input type="date" и
 * type="datetime-local": 'YYYY-MM-DD' и 'YYYY-MM-DDTHH:mm' по часам браузера —
 * так их сохраняли и раньше, поэтому сохранение форм не меняется.
 */

const pad = (n: number) => String(n).padStart(2, '0');

const DAY_MS = 86_400_000;

export type TimeParts = { hours: number; minutes: number };

export function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimeValue({ hours, minutes }: TimeParts): string {
  return `${pad(hours)}:${pad(minutes)}`;
}

/**
 * Время так, как его набирают руками: «17», «1730», «17:30», «17.30», «9 30»,
 * «17ч30». Без минут — ровный час. null — если это не время суток.
 */
export function parseTimeInput(raw: string): TimeParts | null {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/\s*(мин(ут[аы]?)?|min|м)\.?$/u, '')
    .replace(/\s*[чh]\.?\s*/gu, ':')
    .replace(/[\s.,\-–]+/g, ':')
    .replace(/:+/g, ':')
    .replace(/^:|:$/g, '');

  let match: RegExpExecArray | null;
  let hours: number;
  let minutes: number;
  if ((match = /^(\d{1,2})$/.exec(text))) {
    hours = Number(match[1]);
    minutes = 0;
  } else if ((match = /^(\d)(\d{2})$/.exec(text)) || (match = /^(\d{2})(\d{2})$/.exec(text))) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else if ((match = /^(\d{1,2}):(\d{1,2})$/.exec(text))) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else {
    return null;
  }
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** 'YYYY-MM-DDTHH:mm' → дата и время; неполное значение — пустые части. */
export function splitDatetimeValue(value: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? { date: match[1], time: match[2] } : { date: '', time: '' };
}

export function joinDatetimeValue(date: string, time: string): string {
  return date && time ? `${date}T${time}` : '';
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** На сколько календарных дней дата позже сегодняшней (вчера — −1). */
export function daysFromToday(date: Date, now = new Date()): number {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((day - today) / DAY_MS);
}

export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** «сегодня», «завтра», «через 3 дня», «вчера», «5 дней назад». */
export function relativeDayLabel(date: Date, now = new Date()): string {
  const diff = daysFromToday(date, now);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  if (diff === -1) return 'вчера';
  if (diff > 0) return `через ${diff} ${pluralRu(diff, ['день', 'дня', 'дней'])}`;
  return `${-diff} ${pluralRu(-diff, ['день', 'дня', 'дней'])} назад`;
}

/** Время суток с шагом: '00:00', '00:15', … */
export function timeOptions(stepMinutes: number): string[] {
  const options: string[] = [];
  for (let t = 0; t < 24 * 60; t += stepMinutes) {
    options.push(formatTimeValue({ hours: Math.floor(t / 60), minutes: t % 60 }));
  }
  return options;
}

/**
 * Длительность, как её пишут: «75», «90 мин», «1:15», «1ч 15», «1,5 ч».
 * Результат в минутах; null — если не разобрать.
 */
export function parseDurationInput(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(',', '.');
  let match: RegExpExecArray | null;
  if ((match = /^(\d{1,3})\s*(мин(ут[аы]?)?|м|min)?\.?$/u.exec(text))) {
    return Number(match[1]);
  }
  if ((match = /^(\d{1,2}(?:\.\d+)?)\s*(ч(ас(а|ов)?)?|h)\.?$/u.exec(text))) {
    return Math.round(Number(match[1]) * 60);
  }
  if ((match = /^(\d{1,2})\s*(?:ч(?:ас(?:а|ов)?)?\.?|h|:)\s*(\d{1,2})\s*(мин(ут[аы]?)?|м|min)?\.?$/u.exec(text))) {
    const minutes = Number(match[2]);
    return minutes < 60 ? Number(match[1]) * 60 + minutes : null;
  }
  return null;
}
