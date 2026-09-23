import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ExternalLink, Link2Off, Loader2, Save, Search, UserX,
} from 'lucide-react';
import SectionHint from '../../components/SectionHint';
import { FormSelect } from '../../components/FormControls';
import { useAppDialog } from '../../lib/AppDialogContext';
import SelectionPersonMap, { type MapAnswerOption } from '../../components/SelectionPersonMap';
import {
  buildOrphanAnswers,
  buildPersonMap,
  diffSiteData,
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
import { profileAccountLabel, profileDisplayName } from '../../lib/profileUtils';
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
  readContestArchive,
  readZipNames,
  type ContestParticipant,
} from '../../lib/contestArchive';
import {
  applySelectionFormLinks,
  clearAllSelectionFormLinks,
  clearSelectionFormLink,
  fetchSelectionFormLinks,
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
};

type ContestParts = {
  archive: ContestParticipant[] | null;
  archiveName: string | null;
  monitor: TableData | null;
  monitorName: string | null;
};

const NO_CONTEST: ContestParts = { archive: null, archiveName: null, monitor: null, monitorName: null };

/**
 * Архив и монитор складываются в один источник, в каком бы порядке их ни
 * загрузили: архив даёт всех, кто слал посылки, монитор — логины и баллы.
 */
function contestSource(parts: ContestParts, id: string): Source {
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

  const parsed = useMemo(() => sources.map((source) => ({
    source,
    entries: buildFormEntries(source.table, source.mapping, source.offsetHours),
  })), [sources]);

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
      if (item.row.savedFor) {
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

  const profilesById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
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
      if (item.row.savedFor) {
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

      if (row.savedFor) {
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
        source_file: source.fileName,
        source_row: version.rowNumber,
        match_score: candidate?.score ?? null,
        match_signals: candidate?.signals ?? [],
      }));
    })
  ), [items, overridesFor, takenByKind]);

  /**
   * Ответы загруженных выгрузок для ручной привязки из карты. Уже
   * сохранённые не предлагаем — у них хозяин есть.
   */
  const answerOptionsByKind = useMemo(() => {
    const byKind: Partial<Record<FormKind, (MapAnswerOption & { item: ReviewItem })[]>> = {};
    for (const item of items) {
      const { key, source, row } = item;
      if (row.savedFor) continue;
      const { profileId } = resolveMatch(row, overridesFor(source.id));
      const owner = profileId ? profilesById.get(profileId) : undefined;
      const entry = row.entry;
      const file = entry.workUrl ? workAuthorHint(workFileName(entry.workUrl)) : '';
      const option: MapAnswerOption = {
        key,
        kind: source.kind,
        title: entry.name || entry.login || entry.email || 'без имени',
        subtitle: [
          entry.email,
          entry.submittedAt !== null ? formatStamp(entry.submittedAt) : '',
          entry.login && entry.login !== entry.name ? `логин ${entry.login}` : '',
          file ? `файл «${file}»` : '',
          `строка ${entry.rowNumber}`,
        ].filter(Boolean).join(' · '),
        ownerName: owner ? profileDisplayName(owner) : null,
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

    return options
      .map((option) => {
        const best = option.item.row.versions
          .map((version) => scoreCandidate(version, profile, kind, known.get(profileId)))
          .reduce((top, c) => (c.score > top.score ? c : top));
        const hint = best.score > 0
          ? best.signals.filter((signal) => signal !== 'name_conflict').map((signal) => SIGNAL_LABELS[signal]).join(', ')
          : '';
        return { option: { ...option, hint: hint || undefined }, score: best.score };
      })
      .sort((a, b) => (
        Number(!!a.option.ownerName) - Number(!!b.option.ownerName)
        || b.score - a.score
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
  const pickerItems = (row: MatchRow, kind: FormKind): PickerRow[] => {
    const taken = takenByKind.get(kind);
    const rank = (id: string) => {
      if (candidateFor(row, id)) return 0;
      return taken?.has(id) ? 2 : 1;
    };

    return [...profiles]
      .sort((a, b) => rank(a.id) - rank(b.id))
      .map((profile) => {
        const candidate = candidateFor(row, profile.id);
        const busy = taken?.get(profile.id);
        const account = profileAccountLabel(profile);
        return {
          id: profile.id,
          title: profileDisplayName(profile),
          subtitle: busy
            ? `уже есть ответов этой формы: ${busy.length} — выбор добавит ещё одну версию`
            : [account, profile.city, profile.school].filter(Boolean).join(' · ') || null,
          searchText: [
            profile.display_name, profile.email, profile.login, profile.yandex_login,
            profile.recovery_email, profile.contact_email, profile.city, profile.school,
          ].filter(Boolean).join(' '),
          leading: (
            <UserAvatar displayName={profileDisplayName(profile)} avatarUrl={profile.avatar_url} size="xs" />
          ),
          trailing: busy ? (
            <span className="text-[11px] text-amber-400 shrink-0">есть ответ</span>
          ) : candidate ? (
            <span className="text-[11px] text-slate-500 shrink-0">{candidate.score}</span>
          ) : undefined,
        };
      });
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
        });
      } else {
        orphans.push(row.entry);
      }
    }

    return { kind: source.kind, sourceFile: source.fileName, matches, orphans };
  }), [parsed, matched, overridesFor]);

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
              note={source.note}
            />
          ))}

          {sources.length > 1 && (
            <p className="text-xs text-slate-500">
              Файлы разбираются вместе: найденное в одной форме помогает опознать человека
              в остальных.
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
                            : 'время отправки в выгрузке не указано'}
                          {row.entry.login ? ` · логин ${row.entry.login}` : ''}
                          {row.entry.code ? ' · с кодом участника' : ''}
                        </p>
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
