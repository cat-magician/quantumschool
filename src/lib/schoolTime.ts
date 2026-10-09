/**
 * Время школы — московское. Занятия и сроки показываются и вводятся по
 * Москве с пометкой «по мск», а не по часам браузера: ученики из разных
 * часовых поясов видят одно и то же время, а преподаватель в другом городе
 * не сдвигает занятие, вводя своё местное время. Дату страницы занятия база
 * тоже считает по Москве (sync_lesson_page_from_event).
 *
 * Значения полей — строки, как у input type="date"/"datetime-local":
 * 'YYYY-MM-DD' и 'YYYY-MM-DDTHH:mm', только это московские дата и время.
 *
 * Показ — в одном из двух видов (TimeView). Сотрудникам — по Москве, как
 * они время и задают. Ученику — по часам его устройства (пояс браузер берёт
 * из настроек телефона или компьютера), а если он не в Москве, рядом —
 * московское для сверки с объявлениями: «19:00 · 17:00 по мск».
 */

export type TimeView = 'school' | 'viewer';

export const SCHOOL_TIME_ZONE = 'Europe/Moscow';

/** Пометка к любому времени события: «17:00 по мск». */
export const SCHOOL_TIME_SUFFIX = 'по мск';

const pad = (n: number) => String(n).padStart(2, '0');

const wallFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

type WallParts = { year: number; month: number; day: number; hour: number; minute: number };

function wallParts(date: Date): WallParts {
  const parts: Record<string, string> = {};
  for (const part of wallFmt.formatToParts(date)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** Московские дата и время момента: 'YYYY-MM-DDTHH:mm' — значение для полей. */
export function toSchoolInputValue(moment: string | Date): string {
  const p = wallParts(new Date(moment));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Московская дата момента: 'YYYY-MM-DD'. */
export function toSchoolDateValue(moment: string | Date): string {
  return toSchoolInputValue(moment).slice(0, 10);
}

/** Сегодня по Москве: 'YYYY-MM-DD'. */
export function schoolTodayValue(): string {
  return toSchoolDateValue(new Date());
}

/** На сколько минут Москва впереди UTC в этот момент (с 2014 года — всегда 180). */
export function schoolOffsetMinutes(atMs: number): number {
  const p = wallParts(new Date(atMs));
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((wallAsUtc - Math.floor(atMs / 60_000) * 60_000) / 60_000);
}

/** Московские 'YYYY-MM-DDTHH:mm' → момент в мс; null — если это не дата со временем. */
export function schoolInputToMs(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const wallAsUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const guess = wallAsUtc - schoolOffsetMinutes(wallAsUtc) * 60_000;
  return wallAsUtc - schoolOffsetMinutes(guess) * 60_000;
}

/** Московские 'YYYY-MM-DDTHH:mm' → ISO для базы. */
export function schoolInputToIso(value: string): string {
  const ms = schoolInputToMs(value);
  return new Date(ms ?? value).toISOString();
}

/** Начало московского дня 'YYYY-MM-DD' — момент в мс. */
export function schoolDayStartMs(dateValue: string): number {
  return schoolInputToMs(`${dateValue}T00:00`) ?? new Date(`${dateValue}T00:00:00`).getTime();
}

/** Разница в днях между датами 'YYYY-MM-DD' (b позже a — положительная). */
export function daysBetweenDateValues(a: string, b: string): number {
  const toUtc = (v: string) => Date.UTC(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Часовой пояс вида: московский или пояс устройства (undefined). */
export function zoneFor(view: TimeView): string | undefined {
  return view === 'school' ? SCHOOL_TIME_ZONE : undefined;
}

/** Часы устройства в этот момент совпадают с московскими. */
export function viewerOnSchoolTime(atMs: number): boolean {
  return -new Date(atMs).getTimezoneOffset() === schoolOffsetMinutes(atMs);
}

function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** День момента в нужном виде: 'YYYY-MM-DD'. */
export function dateValueIn(moment: string | Date, view: TimeView): string {
  return view === 'school' ? toSchoolDateValue(moment) : localDateValue(new Date(moment));
}

/** Сегодня в нужном виде: 'YYYY-MM-DD'. */
export function todayValueIn(view: TimeView): string {
  return dateValueIn(new Date(), view);
}

/** Начало дня 'YYYY-MM-DD' в нужном виде — момент в мс. */
export function dayStartMsIn(dateValue: string, view: TimeView): number {
  if (view === 'school') return schoolDayStartMs(dateValue);
  return new Date(Number(dateValue.slice(0, 4)), Number(dateValue.slice(5, 7)) - 1, Number(dateValue.slice(8, 10))).getTime();
}

const schoolClockFmt = new Intl.DateTimeFormat('ru-RU', {
  timeZone: SCHOOL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});
const schoolDayFmt = new Intl.DateTimeFormat('ru-RU', {
  timeZone: SCHOOL_TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

/**
 * Хвост к показанному времени: « по мск», если оно и так московское, иначе
 * « · 17:00 по мск» — московское время того же момента (с датой, если в
 * Москве в этот момент другой день).
 */
export function schoolTimeNote(moment: Date, view: TimeView): string {
  const ms = moment.getTime();
  if (view === 'school' || viewerOnSchoolTime(ms)) return ` ${SCHOOL_TIME_SUFFIX}`;
  const otherDay = toSchoolDateValue(moment) !== localDateValue(moment);
  return ` · ${schoolClockFmt.format(moment)} ${SCHOOL_TIME_SUFFIX}${otherDay ? `, ${schoolDayFmt.format(moment)}` : ''}`;
}
