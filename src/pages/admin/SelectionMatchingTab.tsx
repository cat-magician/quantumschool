import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, Link2Off, Loader2, Save, Search, UserX,
} from 'lucide-react';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';
import UserAvatar from '../../components/UserAvatar';
import FormImportPanel from '../../components/FormImportPanel';
import { SearchableActionList, type PickerRow } from '../../components/SearchablePicker';
import { supabase } from '../../lib/supabase';
import type { SelectionFormLink, UserProfile } from '../../lib/types';
import { profileAccountLabel, profileDisplayName } from '../../lib/profileUtils';
import {
  EMPTY_MAPPING,
  FORM_KIND_LABELS,
  SIGNAL_LABELS,
  autoDetectColumns,
  buildFormEntries,
  conflictingProfileIds,
  matchFormEntries,
  profileStageTimestamp,
  resolveMatch,
  summarizeMatches,
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

  const [kind, setKind] = useState<FormKind>('questionnaire');
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<TableData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [offsetHours, setOffsetHours] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [overrides, setOverrides] = useState<MatchOverrides>({});
  const [basket, setBasket] = useState<Basket>('review');
  const [pickerRow, setPickerRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data }, loadedLinks] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('role', 'student').order('display_name'),
      fetchSelectionFormLinks(),
    ]);
    if (data) setProfiles(data as UserProfile[]);
    setLinks(loadedLinks);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const resetImport = () => {
    setFileName(null);
    setTable(null);
    setMapping(EMPTY_MAPPING);
    setOverrides({});
    setParseError(null);
    setSavedCount(null);
    setSaveError(null);
    setPickerRow(null);
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setParseError(null);
    try {
      const parsed = await readTableFile(file);
      if (parsed.rows.length === 0) {
        setParseError('В файле нет строк с данными');
        return;
      }
      setTable(parsed);
      setFileName(file.name);
      setMapping(autoDetectColumns(parsed.headers));
      setOverrides({});
      setSavedCount(null);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
    } finally {
      setParsing(false);
    }
  };

  const entries = useMemo(
    () => (table ? buildFormEntries(table, mapping, offsetHours) : []),
    [table, mapping, offsetHours],
  );

  const rows = useMemo(
    () => (entries.length ? matchFormEntries(entries, profiles, kind) : []),
    [entries, profiles, kind],
  );

  const summary = useMemo(
    () => summarizeMatches(entries, rows, profiles, overrides),
    [entries, rows, profiles, overrides],
  );

  const conflicts = useMemo(() => conflictingProfileIds(rows, overrides), [rows, overrides]);

  const profilesById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const linkForKind = useMemo(() => {
    const index = new Map<string, SelectionFormLink>();
    for (const link of links) {
      if (link.form_kind === kind) index.set(link.user_id, link);
    }
    return index;
  }, [links, kind]);

  const bucketed = useMemo(() => {
    const result: Record<Basket, MatchRow[]> = { review: [], ready: [], unmatched: [] };
    for (const row of rows) {
      const { profileId, ready } = resolveMatch(row, overrides);
      if (!profileId) result.unmatched.push(row);
      else if (ready) result.ready.push(row);
      else result.review.push(row);
    }
    return result;
  }, [rows, overrides]);

  const drafts: FormLinkDraft[] = useMemo(() => (
    rows.flatMap((row) => {
      const { profileId, ready } = resolveMatch(row, overrides);
      if (!profileId || !ready || conflicts.has(profileId)) return [];

      const candidate = candidateFor(row, profileId);
      return [{
        user_id: profileId,
        form_kind: kind,
        contact_email: row.entry.emailValid ? row.entry.email : null,
        form_name: row.entry.name,
        form_submitted_at: row.entry.submittedAt === null
          ? null
          : new Date(row.entry.submittedAt).toISOString(),
        source_file: fileName ?? '',
        source_row: row.entry.rowNumber,
        match_score: candidate?.score ?? null,
        match_signals: candidate?.signals ?? [],
      }];
    })
  ), [rows, overrides, conflicts, kind, fileName]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const { saved, error } = await applySelectionFormLinks(drafts);
    if (error) setSaveError(error);
    else {
      setSavedCount(saved);
      await load();
    }
    setSaving(false);
  };

  const unlink = async (userId: string) => {
    setSaving(true);
    const { error } = await clearSelectionFormLink(userId, kind);
    if (error) setSaveError(error);
    else await load();
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
          Формы не сохраняли автора ответа — восстанавливаем по почте, ФИО и времени отправки
        </p>
        <SectionHint text={SECTION_HINT.admin.selectionMatching} className="mt-1.5" />
        {linkForKind.size > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            Уже связано с аккаунтами: {linkForKind.size} · {FORM_KIND_LABELS[kind].toLowerCase()}
          </p>
        )}
      </div>

      <FormImportPanel
        kind={kind}
        onKindChange={(next) => { setKind(next); setOverrides({}); setSavedCount(null); }}
        fileName={fileName}
        table={table}
        mapping={mapping}
        onMappingChange={setMapping}
        offsetHours={offsetHours}
        onOffsetChange={setOffsetHours}
        parsing={parsing}
        error={parseError}
        onFileSelected={(file) => { void handleFile(file); }}
        onReset={resetImport}
      />

      {table && rows.length === 0 && (
        <p className="text-sm text-amber-400">
          Ни одну строку не удалось прочитать — проверьте разметку колонок.
        </p>
      )}

      {rows.length > 0 && (
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

          {conflicts.size > 0 && (
            <p className="flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Один аккаунт выбран для нескольких ответов ({conflicts.size}) — такие строки
              не сохранятся, пока выбор не разойдётся.
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
              {visibleRows.map((row) => {
                const { profileId, manual, ready } = resolveMatch(row, overrides);
                const profile = profileId ? profilesById.get(profileId) ?? null : null;
                const candidate = candidateFor(row, profileId);
                const existing = profileId ? linkForKind.get(profileId) : undefined;
                const conflicting = profileId ? conflicts.has(profileId) : false;
                const picking = pickerRow === row.entry.rowNumber;

                return (
                  <div
                    key={row.entry.rowNumber}
                    className={`rounded-2xl border p-4 space-y-3 ${
                      conflicting
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-slate-900/60 border-white/5'
                    }`}
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Строка {row.entry.rowNumber} · {FORM_KIND_LABELS[kind]}
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
                          onClick={() => setOverrides((prev) => ({ ...prev, [row.entry.rowNumber]: profileId }))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Это он
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPickerRow(picking ? null : row.entry.rowNumber)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-300 border border-white/10 hover:text-white transition-colors"
                      >
                        <Search className="w-3.5 h-3.5" />
                        {picking ? 'Закрыть поиск' : 'Выбрать аккаунт'}
                      </button>
                      {profileId && (
                        <button
                          type="button"
                          onClick={() => setOverrides((prev) => ({ ...prev, [row.entry.rowNumber]: null }))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/10 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Не сопоставлять
                        </button>
                      )}
                      {manual && (
                        <button
                          type="button"
                          onClick={() => setOverrides((prev) => {
                            const next = { ...prev };
                            delete next[row.entry.rowNumber];
                            return next;
                          })}
                          className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white transition-colors"
                        >
                          Вернуть авто
                        </button>
                      )}
                      {existing && (
                        <button
                          type="button"
                          onClick={() => { void unlink(existing.user_id); }}
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
                            setOverrides((prev) => ({ ...prev, [row.entry.rowNumber]: id }));
                            setPickerRow(null);
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
