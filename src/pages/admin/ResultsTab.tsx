import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle, GraduationCap, Loader2, MapPin, Save, School, Search, UserPlus, UserX,
} from 'lucide-react';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';
import { supabase } from '../../lib/supabase';
import type { UserProfile } from '../../lib/types';
import UserAvatar from '../../components/UserAvatar';
import { profileDisplayName, profileEmail } from '../../lib/profileUtils';
import QuestionnaireStatusHint from '../../components/QuestionnaireStatusHint';
import SuperadminDeleteAccount from '../../components/SuperadminDeleteAccount';
import { adminStageBadgeClass, adminStageLabel } from '../../lib/selectionDisplayUtils';

type StudentRow = UserProfile & { email: string | null };

type Filter = 'all' | 'enrolled' | 'not_enrolled';

/** Участник и этапы — фикс. ширина; последняя колонка растягивается, кнопки справа. */
const RESULTS_ROW_GRID =
  'grid-cols-1 md:grid-cols-[14rem_15rem_15rem_1fr] md:gap-x-4 md:items-center';

/** Балл не меняет статус этапа — только действия ученика. passed/failed в БД устарели. */
function normalizeStatus(
  status: UserProfile['stage1_status'],
  _score: number | null,
  submittedAt?: string | null,
) {
  if (status === 'passed' || status === 'failed') {
    return submittedAt ? 'submitted' : 'pending';
  }
  return status;
}

export default function ResultsTab({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<StudentRow>>>({});
  const [infoStudentId, setInfoStudentId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('role', 'student')
      .order('display_name');
    if (data) setStudents(data as StudentRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-student-info]')) {
        setInfoStudentId(null);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const getDraft = (s: StudentRow) => ({ ...s, ...drafts[s.id] });

  const setDraft = (id: string, patch: Partial<StudentRow>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const setScore = (s: StudentRow, stage: 1 | 2, score: number | null) => {
    const field = stage === 1 ? 'stage1_score' : 'stage2_score';
    setDraft(s.id, { [field]: score });
  };

  const toggleEnroll = (s: StudentRow) => {
    const d = getDraft(s);
    if (d.is_enrolled) {
      setDraft(s.id, { is_enrolled: false, selection_rejected: false });
    } else {
      setDraft(s.id, { is_enrolled: true, selection_rejected: false });
    }
  };

  const toggleReject = (s: StudentRow) => {
    const d = getDraft(s);
    if (d.selection_rejected) {
      setDraft(s.id, { is_enrolled: false, selection_rejected: false });
    } else {
      setDraft(s.id, { is_enrolled: false, selection_rejected: true });
    }
  };

  const hasChanges = (s: StudentRow) => {
    const d = drafts[s.id];
    if (!d) return false;
    return Object.keys(d).some((k) => d[k as keyof StudentRow] !== s[k as keyof StudentRow]);
  };

  const save = async (s: StudentRow) => {
    const d = getDraft(s);
    setSavingId(s.id);
    const { error } = await supabase.from('user_profiles').update({
      stage1_status: normalizeStatus(d.stage1_status, d.stage1_score, d.stage1_submitted_at),
      stage2_status: normalizeStatus(d.stage2_status, d.stage2_score, d.stage2_submitted_at),
      stage1_score: d.stage1_score,
      stage2_score: d.stage2_score,
      is_enrolled: d.is_enrolled,
      selection_rejected: d.selection_rejected ?? false,
      updated_at: new Date().toISOString(),
    }).eq('id', s.id);

    if (!error) {
      const normalized = {
        ...d,
        stage1_status: normalizeStatus(d.stage1_status, d.stage1_score, d.stage1_submitted_at),
        stage2_status: normalizeStatus(d.stage2_status, d.stage2_score, d.stage2_submitted_at),
      };
      setStudents((prev) => prev.map((p) => (p.id === s.id ? { ...p, ...normalized } : p)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
    }
    setSavingId(null);
  };

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((p) => p.id !== id));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (infoStudentId === id) setInfoStudentId(null);
  };

  const filtered = students.filter((s) => {
    const d = getDraft(s);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      d.display_name.toLowerCase().includes(q) ||
      (d.email ?? '').toLowerCase().includes(q);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'enrolled' && d.is_enrolled) ||
      (filter === 'not_enrolled' && !d.is_enrolled);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Отборочные этапы</h2>
        <p className="text-slate-400 text-sm">
          {students.length} участников · выставляйте оценки и принимайте решение о зачислении
        </p>
        <SectionHint text={SECTION_HINT.admin.results} className="mt-1.5" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или почте..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'all', label: 'Все' },
            { id: 'enrolled', label: 'Зачислены' },
            { id: 'not_enrolled', label: 'Не зачислены' },
          ] as { id: Filter; label: string }[]).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                filter === f.id
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 bg-white/5 border border-transparent hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">Ученики не найдены</div>
      ) : (
        <div className="overflow-x-auto">
        <div className="space-y-3 min-w-[42rem]">
          <div className={`hidden md:grid ${RESULTS_ROW_GRID} px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500`}>
            <span>Участник</span>
            <span>Эссе</span>
            <span>Задачи</span>
            <span className="hidden md:block md:text-right md:pr-1">Решение</span>
          </div>

          {filtered.map((s) => {
            const d = getDraft(s);
            const changed = hasChanges(s);
            const showInfo = infoStudentId === s.id;
            return (
              <div
                key={s.id}
                ref={(el) => { cardRefs.current[s.id] = el; }}
                className="relative bg-slate-900/60 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors"
              >
                <div className={`grid ${RESULTS_ROW_GRID} gap-y-3`}>
                  <button
                    type="button"
                    data-student-info
                    onClick={() => setInfoStudentId(showInfo ? null : s.id)}
                    className="flex items-center gap-2.5 min-w-0 max-w-full text-left rounded-xl hover:bg-white/5 px-2 py-1.5 -mx-2 transition-colors md:col-start-1"
                  >
                    <UserAvatar displayName={profileDisplayName(d)} avatarUrl={d.avatar_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white text-sm leading-snug">{profileDisplayName(d)}</div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{profileEmail(d) ?? '—'}</div>
                      {!d.is_enrolled && (
                        <div className="mt-1">
                          <QuestionnaireStatusHint submittedAt={d.questionnaire_submitted_at} compact />
                        </div>
                      )}
                    </div>
                  </button>

                  <StageField
                    className="md:col-start-2"
                    label="Эссе"
                    status={d.stage1_status}
                    score={d.stage1_score}
                    submittedAt={d.stage1_submitted_at}
                    viewedAt={d.stage1_viewed_at}
                    onScore={(v) => setScore(s, 1, v)}
                  />
                  <StageField
                    className="md:col-start-3"
                    label="Задачи"
                    status={d.stage2_status}
                    score={d.stage2_score}
                    submittedAt={d.stage2_submitted_at}
                    viewedAt={d.stage2_viewed_at}
                    onScore={(v) => setScore(s, 2, v)}
                  />

                  <div className="flex flex-nowrap items-center justify-start md:justify-end gap-2 md:col-start-4 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleEnroll(s)}
                      className={`flex items-center justify-center gap-1.5 min-w-0 sm:min-w-[100px] h-9 px-3 rounded-xl text-sm font-medium transition-colors ${
                        d.is_enrolled
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/20'
                      }`}
                    >
                      {d.is_enrolled ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>{d.is_enrolled ? 'Зачислен' : 'Зачислить'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleReject(s)}
                      className={`flex items-center justify-center gap-1.5 min-w-0 sm:min-w-[88px] h-9 px-3 rounded-xl text-sm font-medium transition-colors ${
                        d.selection_rejected
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/20'
                      }`}
                    >
                      <UserX className="w-4 h-4" />
                      <span>{d.selection_rejected ? 'Отказ' : 'Отказать'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => save(s)}
                      disabled={!changed || savingId === s.id}
                      className={`flex items-center justify-center gap-1.5 w-[72px] h-9 rounded-xl text-sm font-semibold transition-colors ${
                        changed
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-white/5 text-slate-600 border border-white/5 cursor-default'
                      } disabled:opacity-50`}
                    >
                      {savingId === s.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </button>
                    {isSuperAdmin && !d.is_enrolled && (
                      <SuperadminDeleteAccount
                        userId={s.id}
                        userName={profileDisplayName(d)}
                        onDeleted={() => removeStudent(s.id)}
                      />
                    )}
                  </div>
                </div>

                {showInfo && (
                  <div
                    data-student-info
                    className="absolute left-4 right-4 sm:right-auto sm:w-64 top-full mt-2 z-20 bg-slate-800 border border-white/10 rounded-xl p-4 shadow-xl"
                  >
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">О участнике</p>
                    <div className="space-y-2.5 text-sm">
                      <InfoRow icon={MapPin} label="Город" value={d.city} />
                      <InfoRow icon={School} label="Школа" value={d.school} />
                      <InfoRow icon={GraduationCap} label="Класс" value={d.grade} />
                      {!d.is_enrolled && (
                        <div className="pt-1 border-t border-white/5">
                          <QuestionnaireStatusHint submittedAt={d.questionnaire_submitted_at} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-white">{value?.trim() || '—'}</div>
      </div>
    </div>
  );
}

function StageField({
  label, status, score, submittedAt, viewedAt, onScore, className = '',
}: {
  label: string;
  status: UserProfile['stage1_status'];
  score: number | null;
  submittedAt?: string | null;
  viewedAt?: string | null;
  onScore: (v: number | null) => void;
  className?: string;
}) {
  const stageLabel = adminStageLabel(status, score, submittedAt, viewedAt);
  const badgeClass = adminStageBadgeClass(status, score, submittedAt, viewedAt);

  return (
    <div className={`flex items-center gap-1.5 flex-nowrap rounded-xl border border-white/5 bg-white/5 px-2.5 py-2 w-full min-w-0 ${className}`}>
      <span className="text-xs text-slate-500 w-9 shrink-0">{label}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded-md border shrink-0 whitespace-nowrap ${badgeClass}`}>
        {stageLabel}
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        <input
          type="number"
          min={0}
          max={10}
          value={score ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onScore(v === '' ? null : Math.min(10, Math.max(0, Number(v))));
          }}
          placeholder="—"
          className="w-9 h-8 px-1.5 rounded-lg bg-slate-800 border border-white/10 text-white text-sm text-center placeholder:text-slate-500 focus:placeholder:opacity-0 focus:outline-none focus:border-blue-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-xs text-slate-500">/10</span>
      </div>
    </div>
  );
}
