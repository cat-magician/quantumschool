/**
 * Быстрая проверка честности контеста — предположение, а не приговор.
 *
 * Сами ответы тут почти ничего не говорят: задачи сдаются числом, и число у
 * честного и у списавшего одинаковое. К тому же Контест, похоже, показывает
 * верный ответ после посылки, поэтому «всё с первой попытки» у всех подряд и
 * перестаёт что-либо значить. Говорит поведение:
 *
 * - темп: номера посылок в Контесте сквозные и растут со временем, так что
 *   разброс номеров у человека — это, грубо, сколько он решал. Восемь верных
 *   ответов за отрезок в десятки раз короче обычного — ответы знали заранее;
 * - верные ответы без единого загруженного решения — выкладок нет, а числа
 *   переписать можно откуда угодно;
 * - посылки вплотную следом за другим участником по многим задачам — второй
 *   аккаунт того же человека или подсказки в реальном времени;
 * - подпись-абракадабра («Lkhxkhxkgxkgx») или обезличенная («Пользователь Q.»)
 *   у сильного результата — так выглядят запасные аккаунты;
 * - один и тот же редкий неверный ответ у двоих — слабый довод: бывает и
 *   одинаковое округление.
 *
 * Уровень: «похоже на честное», «есть вопросы», «подозрительно». Каждый
 * вывод подписан доводами, чтобы человек мог проверить его сам.
 */

export type ContestSubmission = {
  who: string;
  participantId: string;
  task: number;
  /** Сквозной номер посылки в Контесте: растёт со временем. */
  submissionId: number;
  verdict: string;
  /** Расширение загруженного файла, если это файл решения. */
  extension: string;
  size: number;
  /** Текст короткого ответа; у файлов решений — null. */
  answer: string | null;
  /**
   * Когда сделан загруженный файл — по его собственным метаданным: PDF помнит,
   * когда его собрали, фото — когда сняли. Посылка не раньше этого момента.
   */
  madeAt?: number | null;
};

export type ReviewLevel = 'clean' | 'questions' | 'suspicious' | 'staff';

export const REVIEW_LEVEL_LABELS: Record<ReviewLevel, string> = {
  clean: 'похоже на честное решение',
  questions: 'есть вопросы',
  suspicious: 'подозрительно',
  staff: 'служебный аккаунт — не участник',
};

/**
 * Аккаунты организаторов: они решают контест, чтобы проверить его, и в
 * анализе участников им не место — иначе «сдавал следом за участником»
 * превращается в ложное обвинение. Узнаём по подписи школы и по списку,
 * который отмечают вручную.
 */
const STAFF_SIGNATURE = /quantum|rqc\.ru/i;

export function isStaffSignature(who: string, marked: ReadonlySet<string> = new Set()): boolean {
  return marked.has(who.trim().toLowerCase()) || STAFF_SIGNATURE.test(who);
}

export type ContestReview = {
  participantId: string;
  who: string;
  level: ReviewLevel;
  /** Готовая фраза для людей: уровень и доводы. */
  comment: string;
  findings: string[];
  /** С кем связан подозрением — ID участников. */
  linkedTo: string[];
};

/** Посылка «вплотную следом»: столько сквозных номеров — это минуты. */
const SHADOW_WINDOW = 600;
/** Сколько задач подряд надо сдать следом, чтобы это не было совпадением. */
const SHADOW_MIN_TASKS = 3;

const VOWELS = /[aeiouy]/i;

/**
 * Подпись похожа на набор случайных букв: длинная цепочка согласных или
 * почти нет гласных. Обычные логины («pischalnikovtp», «vbourlak») сюда не
 * попадают — у них цепочки согласных не длиннее трёх.
 */
export function looksLikeGibberish(signature: string): boolean {
  const words = signature.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 6);
  return words.some((word) => {
    const vowels = [...word].filter((ch) => VOWELS.test(ch)).length;
    if (vowels / word.length < 0.2) return true;
    return /[^aeiouy]{5,}/.test(word);
  });
}

/**
 * Обезличенная подпись: «Пользователь Q.», «User A.». Граница слова задана
 * явно: \b в JavaScript кириллицу за буквы не считает.
 */
export function looksFaceless(signature: string): boolean {
  return /^(пользователь|user)(?=\s|$)/i.test(signature.trim());
}

/** «в 5 раз», «в 3 раза», «в 23 раза»: слово зависит от последней цифры. */
function times(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  const word = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'раза' : 'раз';
  return `в ${n} ${word}`;
}

function normalizeAnswer(raw: string): string {
  return raw.trim().replace(',', '.').replace(/\s+/g, '');
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

type Person = {
  who: string;
  participantId: string;
  answerSubs: ContestSubmission[];
  solved: Set<number>;
  fileTasks: Set<number>;
  span: number;
};

export function reviewContest(
  allSubmissions: ContestSubmission[],
  staff: ReadonlySet<string> = new Set(),
): Map<string, ContestReview> {
  const staffIds = new Set(
    allSubmissions.filter((s) => isStaffSignature(s.who, staff)).map((s) => s.participantId),
  );
  const submissions = allSubmissions.filter((s) => !staffIds.has(s.participantId));

  // Задача «с ответом» — там, где сдают короткий текст; остальные — файлы решений.
  const byTask = new Map<number, ContestSubmission[]>();
  for (const s of submissions) byTask.set(s.task, [...(byTask.get(s.task) ?? []), s]);
  const answerTasks = new Set(
    [...byTask].filter(([, subs]) => {
      const short = subs.filter((s) => s.answer !== null && s.answer.length <= 32).length;
      return short >= subs.length / 2;
    }).map(([task]) => task),
  );

  const people = new Map<string, Person>();
  for (const s of submissions) {
    const person = people.get(s.participantId) ?? {
      who: s.who,
      participantId: s.participantId,
      answerSubs: [],
      solved: new Set<number>(),
      fileTasks: new Set<number>(),
      span: 0,
    };
    if (answerTasks.has(s.task)) {
      person.answerSubs.push(s);
      if (s.verdict === 'OK') person.solved.add(s.task);
    } else {
      person.fileTasks.add(s.task);
    }
    people.set(s.participantId, person);
  }

  for (const person of people.values()) {
    const ids = person.answerSubs.map((s) => s.submissionId);
    person.span = ids.length > 1 ? Math.max(...ids) - Math.min(...ids) : 0;
  }

  // Обычный темп — по тем, кто решил много: у них разброс номеров показателен.
  const strong = [...people.values()].filter((p) => p.solved.size >= 5 && p.answerSubs.length >= 4);
  const usualSpan = median(strong.map((p) => p.span));

  // Кто сдавал вплотную следом за кем.
  const shadows = new Map<string, Map<string, number>>();
  const ordered = submissions.filter((s) => answerTasks.has(s.task)).sort((a, b) => a.submissionId - b.submissionId);
  for (const earlier of ordered) {
    for (const later of ordered) {
      if (later.participantId === earlier.participantId || later.task !== earlier.task) continue;
      const gap = later.submissionId - earlier.submissionId;
      if (gap <= 0 || gap > SHADOW_WINDOW) continue;
      const followers = shadows.get(earlier.participantId) ?? new Map<string, number>();
      followers.set(later.participantId, (followers.get(later.participantId) ?? 0) + 1);
      shadows.set(earlier.participantId, followers);
    }
  }
  const shadowPairs: { leader: string; follower: string; tasks: number }[] = [];
  for (const [leader, followers] of shadows) {
    for (const [follower, count] of followers) {
      // Считаем задачи, а не посылки: несколько посылок по одной задаче — один довод.
      const tasks = new Set(
        ordered
          .filter((s) => s.participantId === follower)
          .filter((s) => ordered.some((e) => e.participantId === leader && e.task === s.task
            && s.submissionId - e.submissionId > 0 && s.submissionId - e.submissionId <= SHADOW_WINDOW))
          .map((s) => s.task),
      ).size;
      if (count > 0 && tasks >= SHADOW_MIN_TASKS) shadowPairs.push({ leader, follower, tasks });
    }
  }

  // Редкие неверные ответы, совпавшие у двоих-троих.
  const wrongBy = new Map<string, Set<string>>();
  for (const s of submissions) {
    if (!answerTasks.has(s.task) || s.verdict === 'OK' || !s.answer) continue;
    const key = `${s.task}:${normalizeAnswer(s.answer)}`;
    wrongBy.set(key, new Set([...(wrongBy.get(key) ?? []), s.participantId]));
  }

  const reviews = new Map<string, ContestReview>();
  for (const person of people.values()) {
    const findings: string[] = [];
    const linkedTo = new Set<string>();
    let strongDoubt = false;

    const solved = person.solved.size;
    const total = answerTasks.size;

    if (solved >= 5 && usualSpan > 0 && person.span > 0) {
      const ratio = usualSpan / person.span;
      if (ratio >= 8) {
        findings.push(`${solved} из ${total} верных ответов сданы подряд почти сразу — ${times(Math.round(ratio))} быстрее обычного темпа`);
        strongDoubt = strongDoubt || person.fileTasks.size === 0;
      } else if (ratio >= 4) {
        findings.push(`решал заметно быстрее остальных (${times(Math.round(ratio))})`);
      }
    }

    if (solved >= 5 && person.fileTasks.size === 0) {
      findings.push('верные ответы есть, а загруженных решений нет ни одного — выкладок не видно');
    }

    if (looksLikeGibberish(person.who)) {
      findings.push('подпись похожа на случайный набор букв — так выглядят запасные аккаунты');
      if (solved >= 5) strongDoubt = true;
    } else if (looksFaceless(person.who)) {
      findings.push('обезличенная подпись — непонятно, чей это аккаунт');
    }

    const name = (id: string) => people.get(id)?.who ?? id;
    for (const pair of shadowPairs) {
      if (pair.follower === person.participantId) {
        findings.push(`по ${pair.tasks} задачам сдавал вплотную следом за «${name(pair.leader)}» — возможно, второй аккаунт или подсказки`);
        linkedTo.add(pair.leader);
        strongDoubt = true;
      } else if (pair.leader === person.participantId) {
        findings.push(`следом за ним по ${pair.tasks} задачам сдавал «${name(pair.follower)}» — стоит посмотреть, не второй ли это его аккаунт`);
        linkedTo.add(pair.follower);
      }
    }

    for (const [key, who] of wrongBy) {
      if (!who.has(person.participantId) || who.size < 2 || who.size > 3) continue;
      const [task, answer] = key.split(':');
      const others = [...who].filter((id) => id !== person.participantId).map(name);
      findings.push(`в задаче ${task} тот же неверный ответ «${answer}», что у ${others.map((o) => `«${o}»`).join(', ')} (слабый довод: бывает одинаковое округление)`);
    }

    const level: ReviewLevel = strongDoubt ? 'suspicious' : findings.length > 0 ? 'questions' : 'clean';
    const comment = level === 'clean'
      ? (solved > 0
        ? 'Предположение: похоже на честное решение — темп обычный, решения загружены, пересечений с другими нет.'
        : 'Предположение: верных ответов нет — проверять на списывание нечего.')
      : `Предположение: ${REVIEW_LEVEL_LABELS[level]}. ${findings.map((f) => f[0].toUpperCase() + f.slice(1)).join('. ')}.`;

    reviews.set(person.participantId, {
      participantId: person.participantId,
      who: person.who,
      level,
      comment,
      findings,
      linkedTo: [...linkedTo],
    });
  }

  for (const s of allSubmissions) {
    if (!staffIds.has(s.participantId) || reviews.has(s.participantId)) continue;
    reviews.set(s.participantId, {
      participantId: s.participantId,
      who: s.who,
      level: 'staff',
      comment: 'Служебный аккаунт организаторов — в проверке участников не учитывается.',
      findings: [],
      linkedTo: [],
    });
  }

  return reviews;
}
