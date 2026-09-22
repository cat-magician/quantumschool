import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, Link2Off, Loader2, Save, Search, UserX,
} from 'lucide-react';
import SectionHint from '../../components/SectionHint';
import SelectionPersonMap from '../../components/SelectionPersonMap';
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
  type Candidate,
  type ColumnMapping,
  type FormKind,
  type MatchOverrides,
  type MatchRow,
  type MatchSignal,
} from '../../lib/identityMatching';
import { readTableFile, type TableData } from '../../lib/tableImport';
import {
  applySelectionFormLinks,
  clearSelectionFormLink,
  fetchSelectionFormLinks,
  type FormLinkDraft,
} from '../../lib/selectionFormLinks';

type Basket = 'review' | 'ready' | 'unmatched';

/** Одна загруженная выгрузка со своей разметкой колонок. */
type Source = {
  id: string;
  kind: FormKind;
  fileName: string;
  table: TableData;
  mapping: ColumnMapping;
  offsetHours: number;
};

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

    for (const file of files) {
      try {
        const parsed = await readTableFile(file);
        if (parsed.rows.length === 0) {
          failed.push(`${file.name}: нет строк с данными`);
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

    if (added.length > 0) {
      setSources((prev) => [...prev, ...added]);
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

  const matched = useMemo(() => matchFormSources(
    parsed.map(({ source, entries }) => ({ kind: source.kind, entries })),
    profiles,
    known,
  ), [parsed, profiles, known]);

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

    for (const item of items) {
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

  const linksByKind = useMemo(() => {
    const index = new Map<FormKind, Map<string, SelectionFormLink>>();
    for (const link of links) {
      const kind = link.form_kind as FormKind;
      const forKind = index.get(kind) ?? new Map<string, SelectionFormLink>();
      forKind.set(link.user_id, link);
      index.set(kind, forKind);
    }
    return index;
  }, [links]);

  const bucketed = useMemo(() => {
    const result: Record<Basket, ReviewItem[]> = { review: [], ready: [], unmatched: [] };
    for (const item of items) {
      const { profileId, ready } = resolveMatch(item.row, overridesFor(item.source.id));
      if (!profileId) result.unmatched.push(item);
      else if (ready) result.ready.push(item);
      else result.review.push(item);
    }
    return result;
  }, [items, overridesFor]);

  const drafts: FormLinkDraft[] = useMemo(() => (
    items.flatMap(({ source, row }) => {
      const { profileId, ready } = resolveMatch(row, overridesFor(source.id));
      if (!profileId || !ready) return [];
      if (conflicts.get(source.kind)?.has(profileId)) return [];

      const candidate = candidateFor(row, profileId);
      return [{
        user_id: profileId,
        form_kind: source.kind,
        contact_email: row.entry.emailValid ? row.entry.email : null,
        form_name: row.entry.name,
        form_submitted_at: row.entry.submittedAt === null
          ? null
          : new Date(row.entry.submittedAt).toISOString(),
        work_url: row.entry.workUrl || null,
        source_file: source.fileName,
        source_row: row.entry.rowNumber,
        match_score: candidate?.score ?? null,
        match_signals: candidate?.signals ?? [],
      }];
    })
  ), [items, overridesFor, conflicts]);

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

  const pickerItems = (row: MatchRow): PickerRow[] => (
    profiles.map((profile) => {
      const candidate = candidateFor(row, profile.id);
      const account = profileAccountLabel(profile);
      return {
        id: profile.id,
        title: profileDisplayName(profile),
        subtitle: [account, profile.city, profile.school].filter(Boolean).join(' · ') || null,
        searchText: [
          profile.display_name, profile.email, profile.login, profile.yandex_login,
          profile.recovery_email, profile.contact_email, profile.city, profile.school,
        ].filter(Boolean).join(' '),
        leading: (
          <UserAvatar displayName={profileDisplayName(profile)} avatarUrl={profile.avatar_url} size="xs" />
        ),
        trailing: candidate ? (
          <span className="text-[11px] text-slate-500 shrink-0">{candidate.score}</span>
        ) : undefined,
      };
    })
  );

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
        />
      )}

      {view === 'review' && (
        <div className="space-y-3">
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
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Сойдётся само" value={summary.ready} tone="good" />
            <SummaryCard label="Требуют решения" value={summary.needsReview} tone="warn" />
            <SummaryCard label="Без аккаунта" value={summary.unmatched} />
            <SummaryCard label="Аккаунты без ответа" value={summary.profilesWithoutEntry} />
          </div>

          {summary.duplicates > 0 && (
            <p className="text-xs text-slate-500">
              Повторных отправок: {summary.duplicates} — у человека осталась последняя по времени.
            </p>
          )}

          {conflictCount > 0 && (
            <p className="flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Один аккаунт выбран для нескольких ответов одной и той же формы
              ({conflictCount}) — такие строки не сохранятся, пока выбор не разойдётся.
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
              {basket === 'review'
                ? 'Здесь пусто — решать нечего.'
                : 'Пустая корзина.'}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRows.map(({ key, source, row }) => {
                const kind = source.kind;
                const { profileId, manual, ready } = resolveMatch(row, overridesFor(source.id));
                const profile = profileId ? profilesById.get(profileId) ?? null : null;
                const candidate = candidateFor(row, profileId);
                const existing = profileId ? linksByKind.get(kind)?.get(profileId) : undefined;
                const conflicting = profileId ? !!conflicts.get(kind)?.has(profileId) : false;
                const picking = pickerKey === key;

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
                          отправлено {formatStamp(row.entry.submittedAt)}
                          {row.entry.login ? ` · ${row.entry.login}` : ''}
                          {row.entry.code ? ' · с кодом участника' : ''}
                        </p>
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

                    {existing && (
                      <p className="text-xs text-slate-500">
                        Связь уже сохранена: строка {existing.source_row ?? '—'} из «{existing.source_file || 'без файла'}».
                        Подтверждение её перезапишет.
                      </p>
                    )}

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
                      {existing && (
                        <button
                          type="button"
                          onClick={() => { void unlink(existing.user_id, kind); }}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-rose-300 transition-colors disabled:opacity-50"
                        >
                          <Link2Off className="w-3.5 h-3.5" />
                          Снять сохранённую
                        </button>
                      )}
                    </div>

                    {picking && (
                      <div className="pt-3 border-t border-white/5">
                        <SearchableActionList
                          items={pickerItems(row)}
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
