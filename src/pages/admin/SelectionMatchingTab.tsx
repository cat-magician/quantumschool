import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ExternalLink, Link2Off, Loader2, Save, Search, UserX,
} from 'lucide-react';
import SectionHint from '../../components/SectionHint';
import { FormSelect } from '../../components/FormControls';
import { useAppDialog } from '../../lib/AppDialogContext';
import { useAuth } from '../../lib/AuthContext';
import { fetchSelectionConfig, saveSelectionConfig } from '../../lib/selectionConfig';
import SelectionPersonMap, { type MapAnswerOption } from '../../components/SelectionPersonMap';
import type { MapLinkedAnswer } from '../../components/PersonMapAnswerDialog';
import {
  answerLabel,
  buildOrphanAnswers,
  buildPersonMap,
  describeSignals,
  diffSiteData,
  formatTimeWindow,
  siteDataDiffTotal,
  type PendingState,
  type SiteDataDiff,
  type SiteSnapshot,
} from '../../lib/selectionPersonMap';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';
import UserAvatar from '../../components/UserAvatar';
import FormImportPanel, { FormDropzone } from '../../components/FormImportPanel';
import { SearchableActionList, type PickerRow } from '../../components/SearchablePicker';
import { supabase } from '../../lib/supabase';
import type { SelectionFormLink, UserProfile } from '../../lib/types';
import {
  profileAccountLabel, profileDisplayName, profileEmail, profileLogin,
} from '../../lib/profileUtils';
import {
  FORM_KIND_LABELS,
  SIGNAL_LABELS,
  aliasesFromLinks,
  autoDetectColumns,
  buildFormEntries,
  matchFormSources,
  profileStageTimestamp,
  resolveMatch,
  sameAnswer,
  scoreCandidate,
  takenSlotsFromLinks,
  workAuthorHint,
  workFileName,
  type Candidate,
  type ColumnMapping,
  type FormEntry,
  type FormKind,
  type MatchOverrides,
  type MatchRow,
  type MatchSignal,
} from '../../lib/identityMatching';
import { readTableFile, type TableData } from '../../lib/tableImport';
import {
  looksLikeContestArchive,
  looksLikeContestMonitor,
  mergeContest,
  readArchiveBuiltAt,
  readContestArchive,
  readContestSubmissions,
  readZipNames,
  type ContestParticipant,
} from '../../lib/contestArchive';
import {
  contestTimings,
  describeMarkMiss,
  markMiss,
  type ClockSummary,
  type ContestTiming,
  type KnownParticipant,
  type TimeWindow,
} from '../../lib/contestClock';
import {
  REVIEW_LEVEL_LABELS,
  reviewContest,
  type ContestReview,
  type ContestSubmission,
  type ReviewLevel,
} from '../../lib/contestReview';
import {
  applySelectionFormLinks,
  clearAllSelectionFormLinks,
  clearSelectionFormLink,
  deleteSelectionFormLink,
  fetchSelectionFormLinks,
  moveSelectionFormLink,
  type FormLinkDraft,
} from '../../lib/selectionFormLinks';

type Basket = 'review' | 'ready' | 'unmatched' | 'saved';

/** Одна загруженная выгрузка со своей разметкой колонок. */
type Source = {
  id: string;
  kind: FormKind;
  fileName: string;
  table: TableData;
  mapping: ColumnMapping;
  offsetHours: number;
  /** Контест собирается из двух файлов — архива посылок и монитора. */
  contest?: ContestParts;
  /** Пояснение под именем файла: из чего собрана таблица. */
  note?: string;
  /** Итоги проверки честности контеста по ID участника. */
  reviews?: Map<string, ContestReview>;
};

type ContestParts = {
  archive: ContestParticipant[] | null;
  archiveName: string | null;
  /** Посылки архива с ответами — по ним считается проверка честности. */
  submissions: ContestSubmission[] | null;
  /** Когда Контест собрал архив: позже этого посылок нет. */
  builtAt: number | null;
  monitor: TableData | null;
  monitorName: string | null;
};

const NO_CONTEST: ContestParts = {
  archive: null, archiveName: null, submissions: null, builtAt: null, monitor: null, monitorName: null,
};

/** Как оценено время посылок — одной строкой под карточкой файла. */
function describeClock(summary: ClockSummary | null): string {
  if (!summary) {
    return 'Время посылок оценить не по чему: в решениях нет дат, а узнанных участников с отметкой «я отправил» пока нет';
  }
  const parts = [
    summary.files > 0 && `дат внутри решений — ${summary.files}`,
    summary.marks > 0 && `отметок «я отправил» узнанных участников — ${summary.marks}`,
  ].filter(Boolean).join(', ');
  const dropped = summary.rejected > 0 ? `; не сошлись с соседями и отброшены — ${summary.rejected}` : '';
  return `Время посылок Контест не отдаёт — оно оценено по сквозным номерам посылок. Опоры: ${parts}${dropped}`;
}

const REVIEW_TONES: Record<ReviewLevel, string> = {
  clean: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  questions: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  suspicious: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  staff: 'text-slate-300 bg-white/5 border-white/10',
};

/**
 * Архив и монитор складываются в один источник, в каком бы порядке их ни
 * загрузили: архив даёт всех, кто слал посылки, монитор — логины и баллы.
 */
function contestSource(parts: ContestParts, id: string): Source {
  // Итоги проверки считаются во вкладке: они зависят от списка служебных
  // аккаунтов, который можно поменять уже после загрузки архива.
  const table = parts.archive
    ? mergeContest(parts.archive, parts.monitor)
    : parts.monitor ?? { headers: [], rows: [] };
  const fileName = [
    parts.archiveName && `архив посылок: ${parts.archiveName}`,
    parts.monitorName && `монитор: ${parts.monitorName}`,
  ].filter(Boolean).join(' + ');

  let note: string;
  if (parts.archive && parts.monitor) {
    note = `Склеено: ${parts.archive.length} участников из архива, логины и баллы — из монитора`;
  } else if (parts.archive) {
    note = 'Только архив: логины есть лишь у тех, кто подписан логином. Добавьте монитор — подтянутся остальные';
  } else {
    note = 'Только монитор: в нём нет тех, у кого ноль баллов. Добавьте архив посылок — появятся все';
  }

  return {
    id,
    kind: 'contest',
    fileName,
    table,
    mapping: autoDetectColumns(table.headers, table.rows),
    offsetHours: 0,
    contest: parts,
    note,
  };
}

/** Строка разбора вместе с тем, из какого файла она приехала. */
type ReviewItem = {
  key: string;
  source: Source;
  row: MatchRow;
};

/**
 * Карта должна показывать то, что есть в базе сейчас, а не на момент открытия
 * вкладки: люди регистрируются и отмечают этапы, пока идёт разбор.
 */
const MAP_AUTO_REFRESH_MS = 60_000;

const BASKET_LABELS: Record<Basket, string> = {
  review: 'Требуют решения',
  ready: 'Сойдётся само',
  unmatched: 'Без аккаунта',
  // Та же выгрузка, загруженная повторно: эти ответы уже лежат в базе.
  saved: 'Уже сохранено',
};

const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatStamp(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFmt.format(date);
}

function candidateFor(row: MatchRow, profileId: string | null): Candidate | null {
  if (!profileId) return null;
  if (row.best?.profileId === profileId) return row.best;
  return row.alternatives.find((c) => c.profileId === profileId) ?? null;
}

function SignalChips({ signals }: { signals: MatchSignal[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((signal) => (
        <span
          key={signal}
          className={`px-1.5 py-0.5 rounded-md text-[11px] border ${
            signal === 'email' || signal === 'login'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
              : 'bg-white/5 text-slate-400 border-white/10'
          }`}
        >
          {SIGNAL_LABELS[signal]}
        </span>
      ))}
    </div>
  );
}

function SummaryCard({
  label, value, tone = 'plain',
}: {
  label: string;
  value: number;
  tone?: 'plain' | 'good' | 'warn';
}) {
  const toneClass = tone === 'good'
    ? 'text-emerald-300'
    : tone === 'warn'
      ? 'text-amber-300'
      : 'text-white';

  return (
    <div className="px-4 py-3 rounded-2xl bg-slate-900/60 border border-white/5">
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function SelectionMatchingTab() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [links, setLinks] = useState<SelectionFormLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [freshDiff, setFreshDiff] = useState<SiteDataDiff | null>(null);

  const [sources, setSources] = useState<Source[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  /** Решения админа — по одному набору на файл: номера строк у файлов свои. */
  const [overrides, setOverrides] = useState<Record<string, MatchOverrides>>({});
  const [basket, setBasket] = useState<Basket>('review');
  // Карта открывается первой: сначала смотрим, что уже известно, потом
  // докладываем в неё файл формы.
  const [view, setView] = useState<'map' | 'review'>('map');
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [clearKind, setClearKind] = useState<FormKind | 'all'>('all');
  const { confirm } = useAppDialog();
  const { user } = useAuth();
  /** Подписи служебных аккаунтов Контеста — из настроек отбора. */
  const [contestStaff, setContestStaff] = useState<string[]>([]);

  useEffect(() => {
    void fetchSelectionConfig().then((config) => setContestStaff(config.contest_staff ?? []));
  }, []);

  const toggleStaff = async (signature: string) => {
    const key = signature.trim().toLowerCase();
    const next = contestStaff.includes(key)
      ? contestStaff.filter((s) => s !== key)
      : [...contestStaff, key];
    setContestStaff(next);
    if (!user) return;
    const { error } = await saveSelectionConfig({ contest_staff: next }, user.id);
    if (error) {
      setSaveError(/contest_staff|schema cache/i.test(error.message)
        ? 'Список служебных аккаунтов не сохранился: примените supabase/schema.sql.'
        : error.message);
    }
  };

  const snapshotRef = useRef<SiteSnapshot>({ profiles: [], links: [] });
  const savingRef = useRef(false);

  const load = async ({ silent = false, announce = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    const [{ data }, loaded] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('role', 'student').order('display_name'),
      fetchSelectionFormLinks(),
    ]);

    // Сорвавшийся запрос не должен опустошать карту — тогда остаётся прежнее.
    const nextProfiles = (data as UserProfile[] | null) ?? snapshotRef.current.profiles;
    const nextLinks = loaded.error ? snapshotRef.current.links : loaded.links;
    const next: SiteSnapshot = { profiles: nextProfiles, links: nextLinks };

    if (announce) {
      const diff = diffSiteData(snapshotRef.current, next);
      if (siteDataDiffTotal(diff) > 0) setFreshDiff(diff);
    } else {
      setFreshDiff(null);
    }

    snapshotRef.current = next;
    setProfiles(nextProfiles);
    setLinks(nextLinks);
    setUpdatedAt(Date.now());

    if (silent) setRefreshing(false);
    else setLoading(false);
  };

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => { void load(); }, []);

  /**
   * Пока сотрудник разбирает файл, в базе появляются новые люди и новые
   * отметки — карта показывает их без перезагрузки страницы. Сам разбор при
   * этом не трогаем: он живёт в состоянии формы, а не в этих данных.
   */
  useEffect(() => {
    const refresh = () => {
      // Во время записи связей не лезем: ответ сохранения и так перезагрузит.
      if (savingRef.current) return;
      void loadRef.current({ silent: true, announce: true });
    };

    const timer = window.setInterval(refresh, MAP_AUTO_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  /**
   * Какая это форма, видно по заголовкам: у монитора Контеста свои колонки,
   * у эссе — ссылка на работу, у анкеты — почта. Ошибиться не страшно, вид
   * формы переключается на карточке файла.
   */
  const guessKind = (parsed: TableData, mapping: ColumnMapping): FormKind => {
    const headers = parsed.headers.join(' ').toLowerCase();
    if (/user_?name|login|place|score/.test(headers)) return 'contest';
    if (mapping.work !== null) return 'essay';
    return 'questionnaire';
  };

  const addFiles = async (files: File[]) => {
    setParsing(true);
    setParseError(null);
    const added: Source[] = [];
    const failed: string[] = [];
    const contest: Partial<ContestParts> = {};

    for (const file of files) {
      try {
        // Архив посылок — zip с папками участников. Распаковывать не нужно:
        // имена файлов лежат в оглавлении архива.
        if (/\.zip$/i.test(file.name)) {
          const names = await readZipNames(file);
          if (!looksLikeContestArchive(names)) {
            failed.push(`${file.name}: это не архив посылок Контеста`);
            continue;
          }
          contest.archive = readContestArchive(names);
          contest.archiveName = file.name;
          contest.submissions = await readContestSubmissions(file);
          contest.builtAt = await readArchiveBuiltAt(file);
          continue;
        }

        const parsed = await readTableFile(file);
        if (parsed.rows.length === 0) {
          failed.push(`${file.name}: нет строк с данными`);
          continue;
        }
        if (looksLikeContestMonitor(parsed)) {
          contest.monitor = parsed;
          contest.monitorName = file.name;
          continue;
        }
        const mapping = autoDetectColumns(parsed.headers, parsed.rows);
        added.push({
          id: `${file.name}-${Date.now()}-${added.length}`,
          kind: guessKind(parsed, mapping),
          fileName: file.name,
          table: parsed,
          mapping,
          offsetHours: 0,
        });
      } catch (e) {
        failed.push(`${file.name}: ${e instanceof Error ? e.message : 'не удалось прочитать'}`);
      }
    }

    const hasContest = contest.archive !== undefined || contest.monitor !== undefined;
    if (added.length > 0 || hasContest) {
      setSources((prev) => {
        let next = [...prev, ...added];
        if (hasContest) {
          const existing = next.find((s) => s.contest);
          const parts: ContestParts = { ...(existing?.contest ?? NO_CONTEST), ...contest };
          const merged = contestSource(parts, existing?.id ?? `contest-${Date.now()}`);
          next = existing ? next.map((s) => (s === existing ? merged : s)) : [...next, merged];
        }
        return next;
      });
      setSavedCount(null);
    }
    setParseError(failed.length > 0 ? failed.join('; ') : null);
    setParsing(false);
  };

  const patchSource = (id: string, patch: Partial<Source>) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setSavedCount(null);
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPickerKey(null);
    setSavedCount(null);
  };

  const setOverride = (sourceId: string, rowNumber: number, value: string | null) => {
    setOverrides((prev) => ({
      ...prev,
      [sourceId]: { ...prev[sourceId], [rowNumber]: value },
    }));
  };

  const clearOverride = (sourceId: string, rowNumber: number) => {
    setOverrides((prev) => {
      const forSource = { ...prev[sourceId] };
      delete forSource[rowNumber];
      return { ...prev, [sourceId]: forSource };
    });
  };

  /**
   * Разбор идёт по всем загруженным файлам разом: найденное в одной форме
   * становится признаком для остальных. Анкета отдаёт ФИО и почту, по ним
   * находится безымянное эссе, а уже оно подтверждает аккаунт для контеста.
   */
  const known = useMemo(() => aliasesFromLinks(links), [links]);

  const baseParsed = useMemo(() => sources.map((source) => ({
    source,
    entries: buildFormEntries(source.table, source.mapping, source.offsetHours),
  })), [sources]);

  const profilesById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  /**
   * Кто из участников контеста узнан наверняка: связь сохранена или логин
   * совпал с аккаунтом. Их отметки «я отправил» — опоры для оценки времени
   * посылок всех остальных.
   */
  const contestKnown = useMemo(() => {
    const byLogin = new Map<string, string | null>();
    for (const profile of profiles) {
      for (const value of [profile.yandex_login, profileLogin(profile), profileEmail(profile)]) {
        if (!value) continue;
        const login = value.toLowerCase();
        // Один логин у двух аккаунтов — никого не узнаём.
        byLogin.set(login, byLogin.has(login) && byLogin.get(login) !== profile.id ? null : profile.id);
      }
    }

    const owners = new Map<string, string>();
    for (const link of links) {
      if (link.form_kind === 'contest' && link.answer_key?.startsWith('id:')) {
        owners.set(link.answer_key.slice(3), link.user_id);
      }
    }
    for (const { source, entries } of baseParsed) {
      if (source.kind !== 'contest') continue;
      for (const entry of entries) {
        const participantId = entry.answerKey.startsWith('id:') ? entry.answerKey.slice(3) : '';
        const owner = entry.login ? byLogin.get(entry.login.toLowerCase()) : null;
        if (participantId && owner && !owners.has(participantId)) owners.set(participantId, owner);
      }
    }

    const known: KnownParticipant[] = [];
    for (const [participantId, personId] of owners) {
      const markedAt = Date.parse(profilesById.get(personId)?.stage2_submitted_at ?? '');
      if (!Number.isNaN(markedAt)) known.push({ participantId, personId, markedAt });
    }
    return known;
  }, [profiles, links, baseParsed, profilesById]);

  /** Когда участники решали контест — оценка по номерам посылок, по файлам. */
  const contestClocks = useMemo(() => {
    const bySource = new Map<string, ReturnType<typeof contestTimings>>();
    for (const source of sources) {
      if (!source.contest?.submissions) continue;
      bySource.set(source.id, contestTimings(source.contest.submissions, contestKnown, source.contest.builtAt));
    }
    return bySource;
  }, [sources, contestKnown]);

  /** Оценка времени у строки контеста — по ID участника в ключе ответа. */
  const contestTimingByKey = useMemo(() => {
    const byKey = new Map<string, ContestTiming>();
    for (const { timings } of contestClocks.values()) {
      for (const [participantId, timing] of timings) byKey.set(`id:${participantId}`, timing);
    }
    return byKey;
  }, [contestClocks]);

  // Строкам контеста — оценённое окно: с ним отметку на сайте есть с чем сверить.
  const parsed = useMemo(() => baseParsed.map(({ source, entries }) => (
    source.kind !== 'contest' ? { source, entries } : {
      source,
      entries: entries.map((entry) => {
        const timing = contestTimingByKey.get(entry.answerKey);
        return timing ? { ...entry, estimatedWindow: { from: timing.from, to: timing.to } } : entry;
      }),
    }
  )), [baseParsed, contestTimingByKey]);

  /**
   * Кто какую форму уже сдал: у каждого аккаунта на каждую форму один ответ.
   * Занятые аккаунты другим строкам не предлагаются — они не свободны.
   */
  const takenByKind = useMemo(() => new Map(
    (['questionnaire', 'essay', 'contest'] as FormKind[])
      .map((kind) => [kind, takenSlotsFromLinks(links, kind)] as const),
  ), [links]);

  const matched = useMemo(() => matchFormSources(
    parsed.map(({ source, entries }) => ({ kind: source.kind, entries })),
    profiles,
    known,
    takenByKind,
  ), [parsed, profiles, known, takenByKind]);

  const items: ReviewItem[] = useMemo(() => parsed.flatMap(({ source }, index) => (
    (matched[index] ?? []).map((row) => ({
      key: `${source.id}:${row.entry.rowNumber}`,
      source,
      row,
    }))
  )), [parsed, matched]);

  /** Строки загруженных выгрузок по ключу ответа — любой из версий. */
  const itemsByAnswer = useMemo(() => {
    const index = new Map<string, ReviewItem>();
    for (const item of items) {
      for (const version of item.row.versions) index.set(`${item.source.kind}|${version.answerKey}`, item);
    }
    return index;
  }, [items]);

  /** Итог проверки честности у строки контеста — по ID участника в ключе ответа. */
  const contestReviews = useMemo(() => {
    const staff = new Set(contestStaff);
    const byKey = new Map<string, ContestReview>();
    for (const source of sources) {
      if (!source.contest?.submissions) continue;
      for (const [participantId, review] of reviewContest(source.contest.submissions, staff)) {
        byKey.set(`id:${participantId}`, review);
      }
    }
    return byKey;
  }, [sources, contestStaff]);

  const reviewSummary = useMemo(() => {
    const all = [...contestReviews.values()].filter((r) => r.level !== 'staff');
    return { total: all.length, doubtful: all.filter((r) => r.level !== 'clean').length };
  }, [contestReviews]);

  const overridesFor = useCallback(
    (sourceId: string): MatchOverrides => overrides[sourceId] ?? {},
    [overrides],
  );

  const summary = useMemo(() => {
    const linked = new Set<string>();
    let ready = 0;
    let needsReview = 0;
    let unmatched = 0;
    let saved = 0;

    for (const item of items) {
      if (item.row.savedFor && overridesFor(item.source.id)[item.row.entry.rowNumber] === undefined) {
        saved++;
        linked.add(item.row.savedFor);
        continue;
      }
      const resolved = resolveMatch(item.row, overridesFor(item.source.id));
      if (resolved.profileId) linked.add(resolved.profileId);
      if (resolved.ready) ready++;
      else if (resolved.profileId) needsReview++;
      else unmatched++;
    }

    return {
      ready,
      needsReview,
      unmatched,
      saved,
      duplicates: parsed.reduce((n, { entries }) => n + entries.filter((e) => e.supersededBy).length, 0),
      profilesWithoutEntry: profiles.filter((p) => !linked.has(p.id)).length,
    };
  }, [items, overridesFor, parsed, profiles]);

  /**
   * Один аккаунт не может дважды сдать одну и ту же форму, но три разных формы
   * у него быть обязаны — поэтому конфликты считаем внутри вида формы.
   */
  const conflicts = useMemo(() => {
    const seen = new Map<FormKind, Set<string>>();
    const clashes = new Map<FormKind, Set<string>>();

    for (const item of items) {
      const { profileId } = resolveMatch(item.row, overridesFor(item.source.id));
      if (!profileId) continue;
      const kind = item.source.kind;
      const already = seen.get(kind) ?? new Set<string>();
      if (already.has(profileId)) {
        const clash = clashes.get(kind) ?? new Set<string>();
        clash.add(profileId);
        clashes.set(kind, clash);
      }
      already.add(profileId);
      seen.set(kind, already);
    }

    return clashes;
  }, [items, overridesFor]);

  const conflictCount = useMemo(
    () => [...conflicts.values()].reduce((n, set) => n + set.size, 0),
    [conflicts],
  );

  /** Сохранённые ответы по форме и человеку: у одного человека их бывает несколько. */
  const linksByKind = useMemo(() => {
    const index = new Map<FormKind, Map<string, SelectionFormLink[]>>();
    for (const link of links) {
      const kind = link.form_kind as FormKind;
      const forKind = index.get(kind) ?? new Map<string, SelectionFormLink[]>();
      forKind.set(link.user_id, [...(forKind.get(link.user_id) ?? []), link]);
      index.set(kind, forKind);
    }
    return index;
  }, [links]);

  const savedCounts = useMemo(() => {
    const counts: Record<FormKind, number> = { questionnaire: 0, essay: 0, contest: 0 };
    for (const link of links) counts[link.form_kind as FormKind]++;
    return counts;
  }, [links]);

  const bucketed = useMemo(() => {
    const result: Record<Basket, ReviewItem[]> = { review: [], ready: [], unmatched: [], saved: [] };
    for (const item of items) {
      // Сохранённую строку, которую вручную передали другому, решают заново.
      if (item.row.savedFor && overridesFor(item.source.id)[item.row.entry.rowNumber] === undefined) {
        result.saved.push(item);
        continue;
      }
      const { profileId, ready } = resolveMatch(item.row, overridesFor(item.source.id));
      if (!profileId) result.unmatched.push(item);
      else if (ready) result.ready.push(item);
      else result.review.push(item);
    }
    return result;
  }, [items, overridesFor]);

  /**
   * Что уходит в базу. Сохраняются все отправки человека, а не только
   * последняя: повтор не значит, что старая версия не нужна. У уже
   * сохранённых — только то, чего в базе нет: новые версии и ссылки на
   * работы, которых раньше не знали.
   */
  const drafts: FormLinkDraft[] = useMemo(() => (
    items.flatMap(({ source, row }) => {
      let profileId: string;
      let versions = row.versions;

      const reassigned = overridesFor(source.id)[row.entry.rowNumber] !== undefined;
      if (row.savedFor && !reassigned) {
        const saved = takenByKind.get(source.kind)?.get(row.savedFor) ?? [];
        versions = row.versions.filter((version) => {
          const same = saved.find((answer) => sameAnswer(version, answer));
          // Новая версия, старая связь без ключа или без ссылки на работу.
          return !same || !same.answerKey || (!same.workUrl && !!version.workUrl);
        });
        if (versions.length === 0) return [];
        profileId = row.savedFor;
      } else {
        const resolved = resolveMatch(row, overridesFor(source.id));
        if (!resolved.profileId || !resolved.ready) return [];
        profileId = resolved.profileId;
      }

      const candidate = candidateFor(row, profileId);
      return versions.map((version) => ({
        user_id: profileId,
        form_kind: source.kind,
        answer_key: version.answerKey,
        contact_email: version.emailValid ? version.email : null,
        form_name: version.name,
        form_submitted_at: version.submittedAt === null
          ? null
          : new Date(version.submittedAt).toISOString(),
        work_url: version.workUrl || null,
        review_note: contestReviews.get(version.answerKey)?.comment ?? null,
        source_file: source.fileName,
        source_row: version.rowNumber,
        match_score: candidate?.score ?? null,
        match_signals: candidate?.signals ?? [],
      }));
    })
  ), [items, overridesFor, takenByKind, contestReviews]);

  /**
   * Ответы загруженных выгрузок для ручной привязки из карты. Уже
   * сохранённые не предлагаем — у них хозяин есть.
   */
  const answerOptionsByKind = useMemo(() => {
    const byKind: Partial<Record<FormKind, (MapAnswerOption & { item: ReviewItem })[]>> = {};
    for (const item of items) {
      const { key, source, row } = item;
      const { profileId } = resolveMatch(row, overridesFor(source.id));
      const owner = profileId ? profilesById.get(profileId) : undefined;
      const savedHere = !!row.savedFor
        && overridesFor(source.id)[row.entry.rowNumber] === undefined;
      const entry = row.entry;
      const file = entry.workUrl ? workAuthorHint(workFileName(entry.workUrl)) : '';
      const option: MapAnswerOption = {
        key,
        kind: source.kind,
        title: entry.name || entry.login || entry.email || 'без имени',
        subtitle: [
          entry.email,
          entry.submittedAt !== null ? formatStamp(entry.submittedAt) : '',
          entry.submittedAt === null && entry.estimatedWindow
            ? `решал ≈ ${formatTimeWindow(entry.estimatedWindow)}`
            : '',
          entry.login && entry.login !== entry.name ? `логин ${entry.login}` : '',
          file ? `файл «${file}»` : '',
          `строка ${entry.rowNumber}`,
        ].filter(Boolean).join(' · '),
        ownerName: owner ? profileDisplayName(owner) : null,
        ownerSaved: savedHere,
        workUrl: entry.workUrl || null,
      };
      (byKind[source.kind] ??= []).push({ ...option, item });
    }
    return byKind;
  }, [items, overridesFor, profilesById]);

  /**
   * Список под конкретного человека: сверху свободные ответы, похожие на него
   * (по тем же признакам, что и разбор), и подпись — чем похожи.
   */
  const answerOptions = useCallback((profileId: string, kind: FormKind): MapAnswerOption[] => {
    const profile = profilesById.get(profileId);
    const options = answerOptionsByKind[kind] ?? [];
    if (!profile) return options;
    // Свободные — первыми, отданные в разборе — следом, сохранённые — в конце.
    const rank = (option: MapAnswerOption) => (!option.ownerName ? 0 : option.ownerSaved ? 2 : 1);
    // У контеста при равенстве выше те, чьё оценённое время ближе к отметке.
    const markedAt = Date.parse(profileStageTimestamp(profile, kind) ?? '');
    const distance = (entry: FormEntry) => (
      entry.estimatedWindow && !Number.isNaN(markedAt)
        ? Math.abs(markMiss(markedAt, entry.estimatedWindow))
        : Infinity
    );

    return options
      .map((option) => {
        const best = option.item.row.versions
          .map((version) => scoreCandidate(version, profile, kind, known.get(profileId)))
          .reduce((top, c) => (c.score > top.score ? c : top));
        const hint = best.score > 0
          ? best.signals.filter((signal) => signal !== 'name_conflict').map((signal) => SIGNAL_LABELS[signal]).join(', ')
          : '';
        return {
          option: { ...option, hint: hint || undefined },
          score: best.score,
          distance: distance(option.item.row.entry),
        };
      })
      .sort((a, b) => (
        rank(a.option) - rank(b.option)
        || b.score - a.score
        || a.distance - b.distance
        || a.option.title.localeCompare(b.option.title, 'ru')
      ))
      .map(({ option }) => option);
  }, [answerOptionsByKind, profilesById, known]);

  const assignFromMap = (profileId: string, _kind: FormKind, optionKey: string) => {
    const item = items.find((candidate) => candidate.key === optionKey);
    if (!item) return;
    setOverride(item.source.id, item.row.entry.rowNumber, profileId);
    setSavedCount(null);
  };

  const clearAll = async () => {
    const label = clearKind === 'all' ? 'по всем формам' : `формы «${FORM_KIND_LABELS[clearKind]}»`;
    const count = clearKind === 'all' ? links.length : savedCounts[clearKind];
    const ok = await confirm({
      title: `Удалить все связи ${label}?`,
      message: `Будет удалено связей: ${count}. Почта для связи, взятая из них, пропадёт из профилей. `
        + 'Разобранные файлы останутся на экране — их можно сразу сохранить заново. Отменить удаление нельзя.',
      confirmLabel: 'Удалить связи',
      danger: true,
    });
    if (!ok) return;

    setSaving(true);
    savingRef.current = true;
    const { error } = await clearAllSelectionFormLinks(clearKind === 'all' ? null : clearKind);
    if (error) setSaveError(error);
    else {
      setSavedCount(null);
      await load({ silent: true });
    }
    savingRef.current = false;
    setSaving(false);
  };

  const save = async () => {
    setSaving(true);
    savingRef.current = true;
    setSaveError(null);
    const { saved, error } = await applySelectionFormLinks(drafts);
    if (error) setSaveError(error);
    else {
      setSavedCount(saved);
      // Тихо: разобранный файл и корзины остаются на экране.
      await load({ silent: true });
    }
    savingRef.current = false;
    setSaving(false);
  };

  const unlink = async (userId: string, kind: FormKind) => {
    setSaving(true);
    savingRef.current = true;
    const { error } = await clearSelectionFormLink(userId, kind);
    if (error) setSaveError(error);
    else await load({ silent: true });
    savingRef.current = false;
    setSaving(false);
  };

  /**
   * Список для ручного выбора. Сверху — кого предлагает разбор, дальше
   * свободные, в самом низу — занятые: у них эта форма уже сохранена, и
   * выбрать их можно только осознанно, заменив сохранённый ответ.
   */
  const pickerItems = (
    row: MatchRow | null,
    kind: FormKind,
    windowHint: TimeWindow | null = null,
  ): PickerRow[] => {
    const taken = takenByKind.get(kind);
    const candidate = (id: string) => (row ? candidateFor(row, id) : null);
    const rank = (id: string) => {
      if (candidate(id)) return 0;
      return taken?.has(id) ? 2 : 1;
    };
    // У контеста времени нет, есть оценка: чья отметка в неё попала — выше.
    const window = windowHint
      ?? (row && row.entry.submittedAt === null ? row.entry.estimatedWindow ?? null : null);
    const markCheck = (profile: UserProfile) => {
      const markedAt = Date.parse(profileStageTimestamp(profile, kind) ?? '');
      return window && !Number.isNaN(markedAt) ? describeMarkMiss(markedAt, window) : null;
    };
    const fits = (profile: UserProfile) => markCheck(profile)?.fits ?? false;

    return [...profiles]
      .sort((a, b) => rank(a.id) - rank(b.id) || Number(fits(b)) - Number(fits(a)))
      .map((profile) => {
        const suggested = candidate(profile.id);
        const busy = taken?.get(profile.id);
        const account = profileAccountLabel(profile);
        const check = markCheck(profile);
        const mark = check
          ? `отметка ${formatStamp(profileStageTimestamp(profile, kind))} — ${check.text}`
          : '';
        return {
          id: profile.id,
          title: profileDisplayName(profile),
          subtitle: [
            busy
              ? `уже есть ответов этой формы: ${busy.length} — выбор добавит ещё одну версию`
              : [account, profile.city, profile.school].filter(Boolean).join(' · '),
            mark,
          ].filter(Boolean).join(' · ') || null,
          searchText: [
            profile.display_name, profile.email, profile.login, profile.yandex_login,
            profile.recovery_email, profile.contact_email, profile.city, profile.school,
          ].filter(Boolean).join(' '),
          leading: (
            <UserAvatar displayName={profileDisplayName(profile)} avatarUrl={profile.avatar_url} size="xs" />
          ),
          trailing: busy ? (
            <span className="text-[11px] text-amber-400 shrink-0">есть ответ</span>
          ) : suggested ? (
            <span className="text-[11px] text-slate-500 shrink-0">{suggested.score}</span>
          ) : undefined,
        };
      });
  };

  /** Строки описания ответа для окна связи: кто в форме, когда, откуда. */
  const answerDetails = (
    kind: FormKind,
    answer: {
      answerKey: string | null;
      login?: string;
      email?: string | null;
      submittedAt: number | null;
      sourceFile: string;
      sourceRow: number | null;
    },
  ): string[] => {
    const lines: string[] = [];
    if (kind === 'contest') {
      const participantId = answer.answerKey?.startsWith('id:') ? answer.answerKey.slice(3) : '';
      lines.push([
        participantId && `участник Контеста №${participantId}`,
        answer.login && `логин ${answer.login}`,
      ].filter(Boolean).join(' · '));
      const timing = answer.answerKey ? contestTimingByKey.get(answer.answerKey) : undefined;
      if (timing) lines.push(`решал ≈ ${formatTimeWindow(timing)} — оценка по номерам посылок`);
    } else {
      lines.push([
        answer.email,
        answer.submittedAt !== null ? `отправлено ${formatStamp(answer.submittedAt)}` : '',
      ].filter(Boolean).join(' · '));
    }
    if (answer.sourceFile) {
      lines.push(`${answer.sourceFile}${answer.sourceRow ? `, строка ${answer.sourceRow}` : ''}`);
    }
    return lines.filter(Boolean);
  };

  /**
   * Что связано с человеком по форме — для окна «изменить связь» в карте:
   * сохранённые ответы и решения текущего разбора.
   */
  const linkedAnswers = (profileId: string, kind: FormKind): MapLinkedAnswer[] => {
    const answers: MapLinkedAnswer[] = [];

    for (const link of linksByKind.get(kind)?.get(profileId) ?? []) {
      // База помнит не всё: логин, окно времени и проверку знает загруженный файл.
      const item = link.answer_key ? itemsByAnswer.get(`${kind}|${link.answer_key}`) : undefined;
      const entry = item?.row.versions.find((version) => version.answerKey === link.answer_key);
      const decided = item ? overridesFor(item.source.id)[item.row.entry.rowNumber] : undefined;
      const details = answerDetails(kind, {
        answerKey: link.answer_key,
        login: entry?.login,
        email: link.contact_email,
        submittedAt: link.form_submitted_at ? Date.parse(link.form_submitted_at) : null,
        sourceFile: link.source_file,
        sourceRow: link.source_row,
      });
      if (decided !== undefined && decided !== profileId) {
        const next = decided ? profilesById.get(decided) : undefined;
        details.push(next
          ? `В разборе отдан «${profileDisplayName(next)}» — перенесётся при сохранении`
          : 'В разборе помечен «не сопоставлять» — в базе пока остаётся');
      }
      answers.push({
        key: `link:${link.id}`,
        saved: true,
        title: answerLabel(link.form_name, link.answer_key) ?? 'без подписи',
        details,
        workUrl: link.work_url || null,
        reasons: describeSignals((link.match_signals ?? []) as MatchSignal[]),
        note: link.review_note ?? null,
      });
    }

    for (const item of items) {
      if (item.source.kind !== kind) continue;
      const overrides = overridesFor(item.source.id);
      const decided = overrides[item.row.entry.rowNumber];
      // Сохранённое и оставленное как есть уже показано выше.
      if (item.row.savedFor && (decided === undefined || decided === item.row.savedFor)) continue;
      const resolved = resolveMatch(item.row, overrides);
      if (resolved.profileId !== profileId) continue;

      const entry = item.row.entry;
      answers.push({
        key: `row:${item.key}`,
        saved: false,
        unconfirmed: !resolved.ready,
        title: answerLabel(entry.name || entry.login, entry.answerKey) ?? 'без подписи',
        details: answerDetails(kind, {
          answerKey: entry.answerKey,
          login: entry.login,
          email: entry.email,
          submittedAt: entry.submittedAt,
          sourceFile: item.source.fileName,
          sourceRow: entry.rowNumber,
        }),
        workUrl: entry.workUrl || null,
        reasons: describeSignals(candidateFor(item.row, profileId)?.signals ?? []),
        note: contestReviews.get(entry.answerKey)?.comment ?? null,
      });
    }

    return answers;
  };

  /** Где ответ из окна связи: сохранённая связь в базе или строка разбора. */
  const locateAnswer = (answerKey: string) => {
    if (answerKey.startsWith('row:')) {
      const item = items.find((candidate) => candidate.key === answerKey.slice(4));
      if (!item) return null;
      return {
        kind: item.source.kind,
        item,
        link: null,
        owner: resolveMatch(item.row, overridesFor(item.source.id)).profileId,
        window: item.row.entry.estimatedWindow ?? null,
      };
    }

    const link = links.find((candidate) => candidate.id === answerKey.slice(5));
    if (!link) return null;
    const kind = link.form_kind as FormKind;
    const timing = link.answer_key ? contestTimingByKey.get(link.answer_key) : undefined;
    return {
      kind,
      item: link.answer_key ? itemsByAnswer.get(`${kind}|${link.answer_key}`) ?? null : null,
      link,
      owner: link.user_id,
      window: timing ? { from: timing.from, to: timing.to } : null,
    };
  };

  /** Кому можно отдать ответ: те же аккаунты, что в разборе, без нынешнего хозяина. */
  const accountOptions = (answerKey: string): PickerRow[] => {
    const located = locateAnswer(answerKey);
    if (!located) return [];
    return pickerItems(located.item?.row ?? null, located.kind, located.window)
      .filter((option) => option.id !== located.owner);
  };

  /**
   * Сохранённую связь переносим в базе сразу; решение разбора — как и прочие,
   * до кнопки «Сохранить связи».
   */
  const moveAnswer = async (answerKey: string, profileId: string): Promise<string | null> => {
    const located = locateAnswer(answerKey);
    if (!located) return 'Этого ответа уже нет — обновите карту.';
    if (!located.link) {
      if (located.item) setOverride(located.item.source.id, located.item.row.entry.rowNumber, profileId);
      setSavedCount(null);
      return null;
    }

    setSaving(true);
    savingRef.current = true;
    const { error } = await moveSelectionFormLink(located.link.id, profileId);
    if (!error) {
      // Ручное решение по этой строке устарело: ответ уже у нового хозяина.
      if (located.item) clearOverride(located.item.source.id, located.item.row.entry.rowNumber);
      await load({ silent: true });
    }
    savingRef.current = false;
    setSaving(false);
    return error;
  };

  const unlinkAnswer = async (answerKey: string): Promise<string | null> => {
    const located = locateAnswer(answerKey);
    if (!located) return 'Этого ответа уже нет — обновите карту.';
    const row = located.item;
    if (!located.link) {
      if (row) setOverride(row.source.id, row.row.entry.rowNumber, null);
      setSavedCount(null);
      return null;
    }

    setSaving(true);
    savingRef.current = true;
    const { error } = await deleteSelectionFormLink(located.link.id);
    if (!error) {
      // Иначе загруженная выгрузка тут же сопоставит ответ заново — тем же доводом.
      if (row) setOverride(row.source.id, row.row.entry.rowNumber, null);
      await load({ silent: true });
    }
    savingRef.current = false;
    setSaving(false);
    return error;
  };

  /** Разбор предложил — человек подтвердил: связь уйдёт в сохранение. */
  const confirmAnswer = (answerKey: string) => {
    const located = locateAnswer(answerKey);
    if (!located?.item || !located.owner) return;
    setOverride(located.item.source.id, located.item.row.entry.rowNumber, located.owner);
    setSavedCount(null);
  };

  const pending: PendingState[] = useMemo(() => parsed.map(({ source }, index) => {
    const matches = [];
    const orphans = [];

    for (const row of matched[index] ?? []) {
      const resolved = resolveMatch(row, overridesFor(source.id));
      const candidate = candidateFor(row, resolved.profileId);
      if (resolved.profileId) {
        matches.push({
          profileId: resolved.profileId,
          entry: row.entry,
          signals: candidate?.signals ?? [],
          score: candidate?.score ?? null,
          note: contestReviews.get(row.entry.answerKey)?.comment,
        });
      } else {
        orphans.push(row.entry);
      }
    }

    return { kind: source.kind, sourceFile: source.fileName, matches, orphans };
  }), [parsed, matched, overridesFor, contestReviews]);

  const personMap = useMemo(
    () => buildPersonMap(profiles, links, pending),
    [profiles, links, pending],
  );

  const orphanAnswers = useMemo(() => buildOrphanAnswers(pending), [pending]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const visibleRows = bucketed[basket];

  return (
    <div className="space-y-6 w-full max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Сопоставление форм</h2>
        <p className="text-slate-400 text-sm">
          Карта участников собирается из данных сайта сама, файл формы ложится на неё сверху:
          автора ответа формы не сохраняли — восстанавливаем по почте, ФИО и времени отправки
        </p>
        <SectionHint text={SECTION_HINT.admin.selectionMatching} className="mt-1.5" />
        {view === 'review' && links.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            Уже связано с аккаунтами: {links.length} ответов по всем формам
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['map', 'Карта участников'],
          ['review', 'Разбор выгрузок'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              view === id
                ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'map' && (
        <SelectionPersonMap
          rows={personMap}
          orphans={orphanAnswers}
          updatedAt={updatedAt}
          refreshing={refreshing}
          onRefresh={() => { void loadRef.current({ silent: true, announce: true }); }}
          diff={freshDiff}
          answerOptions={answerOptions}
          onAssign={assignFromMap}
          linkedAnswers={linkedAnswers}
          accountOptions={accountOptions}
          onMoveAnswer={moveAnswer}
          onUnlinkAnswer={unlinkAnswer}
          onConfirmAnswer={confirmAnswer}
          unsavedCount={drafts.length}
          onSave={() => { void save(); }}
          saving={saving}
          saveMessage={saveError ?? (savedCount !== null ? `Сохранено связей: ${savedCount}` : null)}
          onOpenReview={() => setView('review')}
        />
      )}

      {view === 'review' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/40 border border-white/5">
            <p className="text-xs text-slate-400">
              Сохранено связей: анкета {savedCounts.questionnaire} · эссе {savedCounts.essay}
              {' '}· контест {savedCounts.contest}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <FormSelect
                value={clearKind}
                onChange={(value) => setClearKind(value as FormKind | 'all')}
                options={[
                  { value: 'all', label: 'Все формы' },
                  { value: 'questionnaire', label: 'Только анкета' },
                  { value: 'essay', label: 'Только эссе' },
                  { value: 'contest', label: 'Только контест' },
                ]}
                className="min-w-[11rem]"
              />
              <button
                type="button"
                onClick={() => { void clearAll(); }}
                disabled={saving || (clearKind === 'all' ? links.length === 0 : savedCounts[clearKind] === 0)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/25 hover:bg-rose-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Link2Off className="w-3.5 h-3.5" />
                Очистить связи и начать заново
              </button>
            </div>
          </div>

          <FormDropzone
            parsing={parsing}
            error={parseError}
            compact={sources.length > 0}
            onFilesSelected={(files) => { void addFiles(files); }}
          />

          {sources.map((source) => (
            <FormImportPanel
              key={source.id}
              kind={source.kind}
              onKindChange={(next) => patchSource(source.id, { kind: next })}
              fileName={source.fileName}
              table={source.table}
              mapping={source.mapping}
              onMappingChange={(next) => patchSource(source.id, { mapping: next })}
              offsetHours={source.offsetHours}
              onOffsetChange={(next) => patchSource(source.id, { offsetHours: next })}
              onRemove={() => removeSource(source.id)}
              note={[
                source.note,
                contestClocks.has(source.id) ? describeClock(contestClocks.get(source.id)!.summary) : null,
              ].filter(Boolean).join('. ')}
            />
          ))}

          {sources.length > 1 && (
            <p className="text-xs text-slate-500">
              Файлы разбираются вместе: найденное в одной форме помогает опознать человека
              в остальных.
            </p>
          )}

          {reviewSummary.total > 0 && (
            <p className="text-xs text-slate-400">
              Проверка честности контеста: вопросы или подозрения у {reviewSummary.doubtful} из
              {' '}{reviewSummary.total} участников — подробности в карточках строк.
            </p>
          )}
        </div>
      )}

      {view === 'review' && sources.length > 0 && items.length === 0 && (
        <p className="text-sm text-amber-400">
          Ни одну строку не удалось прочитать — проверьте разметку колонок.
        </p>
      )}

      {view === 'review' && items.length > 0 && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Сойдётся само" value={summary.ready} tone="good" />
            <SummaryCard label="Требуют решения" value={summary.needsReview} tone="warn" />
            <SummaryCard label="Без аккаунта" value={summary.unmatched} />
            <SummaryCard label="Уже сохранено" value={summary.saved} />
            <SummaryCard label="Аккаунты без ответа" value={summary.profilesWithoutEntry} />
          </div>

          {summary.duplicates > 0 && (
            <p className="text-xs text-slate-500">
              Повторных отправок: {summary.duplicates}. Они собраны в карточку своего человека и
              сохраняются все — ни одна версия не выбрасывается.
            </p>
          )}

          {conflictCount > 0 && (
            <p className="flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Одному аккаунту достались несколько строк одной формы ({conflictCount}). Они
              сохранятся как версии этого человека — если это ошибка, поправьте выбор.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {(Object.keys(BASKET_LABELS) as Basket[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={basket === id}
                onClick={() => setBasket(id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  basket === id
                    ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {BASKET_LABELS[id]} ({bucketed[id].length})
              </button>
            ))}
          </div>

          {visibleRows.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              {basket === 'review' && 'Здесь пусто — решать нечего.'}
              {basket === 'saved' && 'Ничего из загруженного ещё не сохранено.'}
              {(basket === 'ready' || basket === 'unmatched') && 'Пустая корзина.'}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRows.map(({ key, source, row }) => {
                const kind = source.kind;
                const { profileId, manual, ready } = resolveMatch(row, overridesFor(source.id));
                const profile = profileId ? profilesById.get(profileId) ?? null : null;
                const candidate = candidateFor(row, profileId);
                const existing = profileId ? linksByKind.get(kind)?.get(profileId) : undefined;
                // У аккаунта уже есть ответы этой формы, а строка — не один из них.
                const addsTo = existing && !row.savedFor ? existing : undefined;
                const earlier = row.versions.slice(1);
                const review = kind === 'contest' ? contestReviews.get(row.entry.answerKey) : undefined;
                const timing = kind === 'contest' ? contestTimingByKey.get(row.entry.answerKey) : undefined;
                const markedAt = profile ? Date.parse(profileStageTimestamp(profile, kind) ?? '') : NaN;
                const markCheck = timing && !Number.isNaN(markedAt) ? describeMarkMiss(markedAt, timing) : null;
                // Подозрение на второй аккаунт: куда ушла строка «первого» участника.
                const twins = (review?.linkedTo ?? []).map((participantId) => {
                  const twin = items.find((other) => other.row.entry.answerKey === `id:${participantId}`);
                  const twinOwner = twin
                    ? (twin.row.savedFor ?? resolveMatch(twin.row, overridesFor(twin.source.id)).profileId)
                    : null;
                  return {
                    who: contestReviews.get(`id:${participantId}`)?.who ?? participantId,
                    owner: twinOwner ? profilesById.get(twinOwner) ?? null : null,
                  };
                });
                const conflicting = profileId ? !!conflicts.get(kind)?.has(profileId) : false;
                const picking = pickerKey === key;
                const fileLabel = row.entry.workUrl
                  ? workAuthorHint(workFileName(row.entry.workUrl)) || 'открыть работу'
                  : '';
                const signedAsOther = !!candidate?.signals.includes('name_conflict');

                return (
                  <div
                    key={key}
                    className={`rounded-2xl border p-4 space-y-3 ${
                      conflicting
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-slate-900/60 border-white/5'
                    }`}
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          {FORM_KIND_LABELS[kind]} · строка {row.entry.rowNumber}
                          <span className="ml-1.5 normal-case tracking-normal text-slate-600">
                            {source.fileName}
                          </span>
                        </p>
                        <p className="text-sm text-white truncate">
                          {row.entry.name || <span className="text-slate-500">без имени</span>}
                        </p>
                        <p className="text-xs truncate">
                          <span className="text-slate-400">{row.entry.email || '—'}</span>
                          {row.entry.email && !row.entry.emailValid && (
                            <span className="ml-1.5 text-amber-400">адрес с опечаткой</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {row.entry.submittedAt !== null
                            ? `отправлено ${formatStamp(row.entry.submittedAt)}`
                            : timing
                              ? `решал ≈ ${formatTimeWindow(timing)}`
                              : 'время отправки в выгрузке не указано'}
                          {row.entry.login ? ` · логин ${row.entry.login}` : ''}
                          {row.entry.code ? ' · с кодом участника' : ''}
                        </p>
                        {timing && (
                          <p className="text-[11px] text-slate-500">
                            {timing.madeAt !== null
                              ? `Дата внутри загруженного решения — ${formatStamp(timing.madeAt)}: посылка не раньше. `
                              : ''}
                            Окно — оценка по сквозным номерам посылок, не время из Контеста.
                          </p>
                        )}
                        {row.entry.workUrl && (
                          // Работа под рукой: без неё проверить предложение нечем.
                          <a
                            href={row.entry.workUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 max-w-full text-xs text-blue-300 hover:text-blue-200 underline decoration-blue-400/40"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">работа: {fileLabel}</span>
                          </a>
                        )}
                        {earlier.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                            <p className="text-[11px] text-slate-500">
                              Ещё отправки этого же человека — сохранятся вместе:
                            </p>
                            {earlier.map((version) => (
                              <p key={version.rowNumber} className="text-xs text-slate-400 truncate">
                                строка {version.rowNumber}
                                {version.submittedAt !== null ? ` · ${formatStamp(version.submittedAt)}` : ''}
                                {version.name && version.name !== row.entry.name ? ` · «${version.name}»` : ''}
                                {version.workUrl && (
                                  <a
                                    href={version.workUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1.5 text-blue-300 hover:text-blue-200 underline decoration-blue-400/40"
                                  >
                                    работа
                                  </a>
                                )}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 md:border-l md:border-white/5 md:pl-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Аккаунт{manual ? ' · выбран вручную' : ''}
                        </p>
                        {profile ? (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                displayName={profileDisplayName(profile)}
                                avatarUrl={profile.avatar_url}
                                size="xs"
                              />
                              <div className="min-w-0">
                                <p className="text-sm text-white truncate">{profileDisplayName(profile)}</p>
                                <p className="text-xs text-slate-500 truncate">
                                  {profileAccountLabel(profile) ?? '—'}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              наша отметка {formatStamp(profileStageTimestamp(profile, kind))}
                              {markCheck && (
                                <span className={markCheck.fits ? 'text-emerald-300' : 'text-amber-300'}>
                                  {' '}· {markCheck.text}
                                </span>
                              )}
                            </p>
                            {candidate && candidate.signals.length > 0 && (
                              <div className="mt-1.5">
                                <SignalChips signals={candidate.signals} />
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-slate-500">не найден</p>
                        )}
                      </div>
                    </div>

                    {row.savedFor && (
                      <p className="text-xs text-emerald-300/90">
                        Уже сохранено за этим аккаунтом — решать нечего.
                        {row.versions.length > (existing?.length ?? 0)
                          ? ' Новые отправки этого человека добавятся при сохранении.'
                          : ''}
                      </p>
                    )}

                    {addsTo && (
                      <p className="flex items-start gap-2 text-xs text-sky-300">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        У этого аккаунта уже есть ответы этой формы ({addsTo.length}). Эта строка
                        добавится к ним ещё одной версией — сохранённое не заменяется.
                      </p>
                    )}

                    {review && (
                      <div className={`rounded-xl border px-3 py-2 text-xs space-y-1.5 ${REVIEW_TONES[review.level]}`}>
                        <p className="font-semibold">
                          Проверка честности: {REVIEW_LEVEL_LABELS[review.level]}
                        </p>
                        {review.findings.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                            {review.findings.map((finding) => <li key={finding}>{finding}</li>)}
                          </ul>
                        ) : (
                          <p className="text-slate-300">{review.comment}</p>
                        )}
                        {review.level !== 'staff' && (
                          <p className="text-[11px] text-slate-500">
                            Это предположение по поведению в Контесте, а не доказательство —
                            сверьтесь с загруженными решениями.
                          </p>
                        )}
                        {(contestStaff.includes(review.who.trim().toLowerCase()) || review.level !== 'staff') && (
                          <button
                            type="button"
                            onClick={() => { void toggleStaff(review.who); }}
                            className="text-[11px] text-slate-400 hover:text-white underline decoration-slate-500/50 transition-colors"
                          >
                            {contestStaff.includes(review.who.trim().toLowerCase())
                              ? 'Это участник, а не служебный аккаунт — вернуть в проверку'
                              : 'Это служебный аккаунт организаторов — не проверять'}
                          </button>
                        )}
                        {!row.savedFor && twins.filter((t) => t.owner).map((twin) => (
                          <button
                            key={twin.who}
                            type="button"
                            onClick={() => setOverride(source.id, row.entry.rowNumber, twin.owner!.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Это тот же человек, что «{twin.who}» — привязать к {profileDisplayName(twin.owner!)}
                          </button>
                        ))}
                      </div>
                    )}

                    {signedAsOther && (
                      <p className="flex items-start gap-2 text-xs text-rose-300">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        В форме подписано «{row.entry.name}», а у аккаунта другое имя. Сверьтесь с
                        работой — само такое не сохранится.
                      </p>
                    )}

                    {row.busy.length > 0 && (
                      <p className="flex items-start gap-2 text-xs text-slate-400">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                        <span>
                          Похоже на{' '}
                          {row.busy.map((c) => profileDisplayName(profilesById.get(c.profileId) ?? { display_name: '' })).join(', ')}
                          {' '}— у них уже есть ответ этой формы, но довод слабый (время или часть
                          имени), поэтому сами не предлагаем. Если это он — выберите аккаунт вручную,
                          строка добавится ещё одной версией.
                        </span>
                      </p>
                    )}

                    {!row.savedFor && (
                    <div className="flex flex-wrap items-center gap-2">
                      {profileId && !ready && (
                        <button
                          type="button"
                          onClick={() => setOverride(source.id, row.entry.rowNumber, profileId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Это он
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPickerKey(picking ? null : key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-300 border border-white/10 hover:text-white transition-colors"
                      >
                        <Search className="w-3.5 h-3.5" />
                        {picking ? 'Закрыть поиск' : 'Выбрать аккаунт'}
                      </button>
                      {profileId && (
                        <button
                          type="button"
                          onClick={() => setOverride(source.id, row.entry.rowNumber, null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/10 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Не сопоставлять
                        </button>
                      )}
                      {manual && (
                        <button
                          type="button"
                          onClick={() => clearOverride(source.id, row.entry.rowNumber)}
                          className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white transition-colors"
                        >
                          Вернуть авто
                        </button>
                      )}
                    </div>
                    )}

                    {existing && (
                      <button
                        type="button"
                        onClick={() => { void unlink(existing[0].user_id, kind); }}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-rose-300 transition-colors disabled:opacity-50"
                      >
                        <Link2Off className="w-3.5 h-3.5" />
                        Снять все связи этого человека по форме «{FORM_KIND_LABELS[kind]}»
                      </button>
                    )}

                    {picking && (
                      <div className="pt-3 border-t border-white/5">
                        <SearchableActionList
                          items={pickerItems(row, kind)}
                          onPick={(id) => {
                            setOverride(source.id, row.entry.rowNumber, id);
                            setPickerKey(null);
                          }}
                          searchPlaceholder="Имя, почта, логин, школа…"
                          emptyText="Участников нет"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="sticky bottom-4 flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-900/95 border border-white/10 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => { void save(); }}
              disabled={saving || drafts.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Сохранить связи ({drafts.length})
            </button>
            <p className="text-xs text-slate-500 min-w-0 flex-1">
              В базу уйдут только точные совпадения и подтверждённые вами строки.
              Почта из анкеты попадёт в профиль участника.
            </p>
            {savedCount !== null && (
              <p className="text-xs text-emerald-300">Сохранено связей: {savedCount}</p>
            )}
            {saveError && <p className="text-xs text-rose-400">{saveError}</p>}
          </div>
        </>
      )}
    </div>
  );
}
