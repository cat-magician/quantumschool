import type { ContestSubmission } from './contestReview';

/**
 * Когда участник решал контест — по сквозным номерам посылок.
 *
 * Контест не отдаёт время посылок: в архиве все файлы проштампованы моментом
 * сборки, в мониторе только баллы. Но номера посылок сквозные на весь Контест
 * и растут со временем, а для некоторых номеров время известно — это опоры:
 *
 * - дата внутри загруженного решения: PDF помнит, когда его собрали, фото —
 *   когда сняли. Посылка не раньше этой даты, обычно через минуты;
 * - отметка «я отправил» у тех, кто уже узнан наверняка: связь сохранена или
 *   совпал логин. Её ставят после последней посылки, обычно сразу.
 *
 * Между опорами время восстанавливается, но не по прямой: ночью посылок по
 * всему Контесту в разы меньше, чем днём, и прямая через ночь ошибается на
 * часы. Поэтому часы сначала пересчитываются в «активное время» — ночной час
 * весит меньше дневного, — и интерполяция идёт в нём. На настоящем архиве это
 * сократило ошибку через ночь примерно втрое.
 *
 * Опора бывает неверной: фото сняли за два часа до отправки, «я отправил»
 * нажали назавтра. Такая резко расходится с соседями и отбрасывается, причём
 * файл подозревается в ранней ошибке, а отметка — в поздней: иначе они не
 * ошибаются.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MSK_OFFSET = 3 * HOUR;

/**
 * Относительная активность Контеста по часам московского времени: днём 1,
 * глубокой ночью в разы меньше. Форма прикидочная — точно её без времени
 * посылок не узнать, — но проверена на опорах настоящего архива.
 */
const HOURLY_ACTIVITY = [
  0.4, 0.25, 0.15, 0.15, 0.15, 0.15, 0.25, 0.35, 0.6, 0.85, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9, 0.75, 0.55,
];
const ACTIVITY_BEFORE_HOUR = HOURLY_ACTIVITY.reduce<number[]>(
  (sums, weight) => [...sums, sums[sums.length - 1] + weight],
  [0],
);
const DAY_ACTIVITY = ACTIVITY_BEFORE_HOUR[24] * HOUR;

/** Момент → «активное время»: сколько дневных миллисекунд прошло с начала эпохи. */
function toActivity(at: number): number {
  const local = at + MSK_OFFSET;
  const day = Math.floor(local / DAY);
  const rest = local - day * DAY;
  const hour = Math.floor(rest / HOUR);
  return day * DAY_ACTIVITY
    + ACTIVITY_BEFORE_HOUR[hour] * HOUR
    + HOURLY_ACTIVITY[hour] * (rest - hour * HOUR);
}

function fromActivity(value: number): number {
  const day = Math.floor(value / DAY_ACTIVITY);
  let rest = value - day * DAY_ACTIVITY;
  let hour = 0;
  while (hour < 23 && ACTIVITY_BEFORE_HOUR[hour + 1] * HOUR <= rest) hour++;
  rest -= ACTIVITY_BEFORE_HOUR[hour] * HOUR;
  return day * DAY + hour * HOUR + rest / HOURLY_ACTIVITY[hour] - MSK_OFFSET;
}

export type ClockAnchor = {
  submissionId: number;
  at: number;
  /**
   * `file` — дата внутри решения: посылка не раньше, так что ошибиться она
   * может только в раннюю сторону. `mark` — отметка «я отправил»: её ставят
   * после, и ошибается она в позднюю.
   */
  kind: 'file' | 'mark';
  participantId: string;
};

export type ClockReading = {
  at: number;
  /** Насколько оценка может ошибаться, в мс. */
  error: number;
};

export type ContestClock = {
  read: (submissionId: number) => ClockReading;
  /** Опоры, на которых шкала держится. */
  anchors: ClockAnchor[];
  /** Сколько опор отброшено: противоречили соседям. */
  rejected: number;
};

/**
 * Ошибка растёт с удалённостью от ближайшей опоры: на опорах настоящего
 * архива она не превышала 0,3 этого расстояния, а за краями шкалы, где уже
 * не интерполяция, а экстраполяция, берём с запасом.
 */
const ERROR_SHARE_INSIDE = 0.3;
const ERROR_SHARE_OUTSIDE = 0.5;
/** Меньше не бывает: между сборкой файла и посылкой проходят минуты. */
const MIN_ERROR = 5 * MINUTE;

/** Опору отбрасываем, если она расходится с соседями втрое сильнее ожидаемого. */
const OUTLIER_RATIO = 3;
/** Ошибка не в свою сторону — поздний файл, ранняя отметка — втрое менее вероятна. */
const UNTYPICAL_SHARE = 1 / 3;

function readClock(chain: ClockAnchor[], submissionId: number): ClockReading {
  const first = chain[0];
  const last = chain[chain.length - 1];
  const value = (anchor: ClockAnchor) => toActivity(anchor.at);
  // За краями — средний темп по всей шкале: у пары крайних опор он случаен.
  const rate = (value(last) - value(first)) / (last.submissionId - first.submissionId);

  let activity: number;
  if (submissionId <= first.submissionId) {
    activity = value(first) - (first.submissionId - submissionId) * rate;
  } else if (submissionId >= last.submissionId) {
    activity = value(last) + (submissionId - last.submissionId) * rate;
  } else {
    let hi = 1;
    while (chain[hi].submissionId < submissionId) hi++;
    const a = chain[hi - 1];
    const b = chain[hi];
    activity = value(a)
      + ((submissionId - a.submissionId) / (b.submissionId - a.submissionId)) * (value(b) - value(a));
  }

  const at = fromActivity(activity);
  const nearest = Math.min(...chain.map((anchor) => Math.abs(anchor.at - at)));
  const outside = submissionId < first.submissionId || submissionId > last.submissionId;
  return {
    at,
    error: Math.max(MIN_ERROR, nearest * (outside ? ERROR_SHARE_OUTSIDE : ERROR_SHARE_INSIDE)),
  };
}

/**
 * Время не может идти назад. Из пары, где оно убывает, уходит та опора, для
 * которой такая ошибка обычна: поздняя отметка или старый файл.
 */
function keepIncreasing(sorted: ClockAnchor[]): ClockAnchor[] {
  const kept = [...sorted];
  let i = 1;
  while (i < kept.length) {
    const earlier = kept[i - 1];
    if (kept[i].at > earlier.at) {
      i++;
      continue;
    }
    kept.splice(earlier.kind === 'mark' ? i - 1 : i, 1);
    i = Math.max(1, i - 1);
  }
  return kept;
}

/** Опоры, резко расходящиеся с соседями, — по одной, пока такие есть. */
function rejectOutliers(chain: ClockAnchor[]): ClockAnchor[] {
  let kept = chain;
  while (kept.length > 3) {
    let worst: { index: number; suspicion: number } | null = null;
    // Крайние сверять не с чем: предсказание за краем — уже экстраполяция.
    for (let i = 1; i < kept.length - 1; i++) {
      const reading = readClock([...kept.slice(0, i), ...kept.slice(i + 1)], kept[i].submissionId);
      const miss = kept[i].at - reading.at;
      const typical = kept[i].kind === 'file' ? miss < 0 : miss > 0;
      const suspicion = (Math.abs(miss) / reading.error) * (typical ? 1 : UNTYPICAL_SHARE);
      if (!worst || suspicion > worst.suspicion) worst = { index: i, suspicion };
    }
    if (!worst || worst.suspicion <= OUTLIER_RATIO) break;
    const drop = worst.index;
    kept = kept.filter((_, i) => i !== drop);
  }
  return kept;
}

/** Позже сборки архива посылок быть не может. */
export function fitContestClock(anchors: ClockAnchor[], notAfter = Infinity): ContestClock | null {
  // На одну посылку — одна опора: дата файла надёжнее отметки.
  const bySubmission = new Map<number, ClockAnchor>();
  for (const anchor of anchors) {
    if (!Number.isFinite(anchor.at) || anchor.at > notAfter) continue;
    const same = bySubmission.get(anchor.submissionId);
    if (!same || (same.kind === 'mark' && anchor.kind === 'file')) {
      bySubmission.set(anchor.submissionId, anchor);
    }
  }

  const sorted = [...bySubmission.values()].sort((a, b) => a.submissionId - b.submissionId);
  const chain = rejectOutliers(keepIncreasing(sorted));
  if (chain.length < 2) return null;

  return {
    read: (submissionId) => {
      const reading = readClock(chain, submissionId);
      return { at: Math.min(reading.at, notAfter), error: reading.error };
    },
    anchors: chain,
    rejected: sorted.length - chain.length,
  };
}

export type TimeWindow = { from: number; to: number };

export type ContestTiming = TimeWindow & {
  /** Самая поздняя дата внутри его решений — факт, а не оценка. */
  madeAt: number | null;
};

/** Участник контеста, про которого точно известно, кто он на сайте. */
export type KnownParticipant = {
  participantId: string;
  /** Аккаунт сайта: у одного человека бывает два аккаунта в Контесте. */
  personId: string;
  /** Отметка «я отправил». */
  markedAt: number;
};

export type ClockSummary = {
  files: number;
  marks: number;
  rejected: number;
};

/**
 * Когда каждый участник решал: окно от первой посылки до последней, с запасом
 * на неточность. Собственная отметка человека в его оценку не входит — иначе
 * сверять её было бы не с чем.
 */
export function contestTimings(
  submissions: ContestSubmission[],
  known: KnownParticipant[],
  builtAt: number | null = null,
): { timings: Map<string, ContestTiming>; summary: ClockSummary | null } {
  const spans = new Map<string, { first: number; last: number; madeAt: number | null }>();
  for (const s of submissions) {
    const span = spans.get(s.participantId) ?? { first: s.submissionId, last: s.submissionId, madeAt: null };
    span.first = Math.min(span.first, s.submissionId);
    span.last = Math.max(span.last, s.submissionId);
    if (s.madeAt != null && (span.madeAt === null || s.madeAt > span.madeAt)) span.madeAt = s.madeAt;
    spans.set(s.participantId, span);
  }

  const anchors: ClockAnchor[] = submissions
    .filter((s) => s.madeAt != null)
    .map((s) => ({ submissionId: s.submissionId, at: s.madeAt!, kind: 'file', participantId: s.participantId }));

  // Отметка у человека одна, а аккаунтов в Контесте бывает два: она ставится
  // после последней посылки из всех.
  const latestByPerson = new Map<string, { participantId: string; last: number; markedAt: number }>();
  for (const person of known) {
    const span = spans.get(person.participantId);
    if (!span) continue;
    const previous = latestByPerson.get(person.personId);
    if (!previous || span.last > previous.last) {
      latestByPerson.set(person.personId, { participantId: person.participantId, last: span.last, markedAt: person.markedAt });
    }
  }
  for (const mark of latestByPerson.values()) {
    anchors.push({ submissionId: mark.last, at: mark.markedAt, kind: 'mark', participantId: mark.participantId });
  }

  const notAfter = builtAt ?? Infinity;
  const shared = fitContestClock(anchors, notAfter);
  const timings = new Map<string, ContestTiming>();
  if (!shared) return { timings, summary: null };

  for (const [participantId, span] of spans) {
    const own = (a: ClockAnchor) => a.kind === 'mark' && a.participantId === participantId;
    const clock = anchors.some(own) ? fitContestClock(anchors.filter((a) => !own(a)), notAfter) : shared;
    if (!clock) continue;

    const first = clock.read(span.first);
    const last = clock.read(span.last);
    // Посылка с файлом не раньше даты внутри него — это факт, оценка его не отменяет.
    const to = Math.max(Math.min(last.at + last.error, notAfter), span.madeAt ?? -Infinity);
    timings.set(participantId, {
      from: Math.min(first.at - first.error, to),
      to,
      madeAt: span.madeAt,
    });
  }

  return {
    timings,
    summary: {
      files: shared.anchors.filter((a) => a.kind === 'file').length,
      marks: shared.anchors.filter((a) => a.kind === 'mark').length,
      rejected: shared.rejected,
    },
  };
}

/** «Я отправил» жмут после последней посылки — бывает, что и через час. */
export const MARK_LAG = HOUR;

/**
 * Где отметка относительно окна: 0 — сходится, меньше нуля — поставлена
 * раньше первой посылки на столько, больше — позже последней с учётом
 * обычной задержки.
 */
export function markMiss(markedAt: number, window: TimeWindow): number {
  if (markedAt < window.from) return markedAt - window.from;
  if (markedAt > window.to + MARK_LAG) return markedAt - window.to;
  return 0;
}

function formatGap(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} мин`;
  if (ms < 2 * DAY) return `${Math.round(ms / HOUR)} ч`;
  return `${Math.round(ms / DAY)} дн.`;
}

/** Подпись к отметке на сайте: сходится ли она с оценкой времени посылок. */
export function describeMarkMiss(markedAt: number, window: TimeWindow): { fits: boolean; text: string } {
  const miss = markMiss(markedAt, window);
  if (miss === 0) return { fits: true, text: 'сходится со временем посылок' };
  return {
    fits: false,
    text: miss < 0
      ? `за ${formatGap(-miss)} до первой посылки`
      : `через ${formatGap(miss)} после последней посылки`,
  };
}
