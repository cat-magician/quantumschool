import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, ExternalLink, Eye, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import type { Group, GroupMember, HomeworkPage, HomeworkPageBlock, HomeworkPageSubmission } from '../../lib/types';
import {
  groupsForTeacher,
  loadGroupTeachers,
  pageSubmissionVisibleToStaff,
  studentGroupMap,
} from '../../lib/groupUtils';
import {
  formatHomeworkScoreShort,
  formatHomeworkScoreValue,
  normalizeHomeworkScoreInput,
  parseHomeworkScore,
  SUBMISSION_STATUS_COLORS,
  syncProgressFromGrade,
  DEFAULT_HOMEWORK_MAX_SCORE,
} from '../../lib/homeworkUtils';
import UserAvatar from '../../components/UserAvatar';
import { profileEmail } from '../../lib/profileUtils';
import { homeworkPageLoadError } from '../../lib/homeworkPageLoadError';
import { homeworkSubmissionLinksFromBlocks } from '../../lib/homeworkPageUtils';
import HomeworkPageStudentPreview from '../../components/HomeworkPageStudentPreview';
import HomeworkPagesTab from './HomeworkPagesTab';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';

type Section = 'pages' | 'grading';
type GradingFilter = 'all' | 'ungraded' | 'graded';

function formatSubmissionWhen(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** Пустое поле — не оценка. */
function submissionMaxScore(s: HomeworkPageSubmission) {
  return s.page?.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE;
}

function submissionHasGrade(s: HomeworkPageSubmission) {
  return s.status === 'graded';
}

export default function HomeworkTab({
  isSuperAdmin,
  initialSection = 'pages',
  mode = 'combined',
}: {
  isSuperAdmin: boolean;
  initialSection?: Section;
  /** combined — вкладки «Задания / Проверка»; grading — только проверка (без дубля в боковом меню) */
  mode?: 'combined' | 'grading';
}) {
  const { user } = useAuth();
  const { toast } = useAppDialog();
  const [section, setSection] = useState<Section>(initialSection);
  const [pages, setPages] = useState<Pick<HomeworkPage, 'id' | 'title'>[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<HomeworkPageSubmission[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teacherGroupIds, setTeacherGroupIds] = useState<Set<string>>(new Set());
  const [studentGroups, setStudentGroups] = useState<Record<string, string>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gradingFilter, setGradingFilter] = useState<GradingFilter>('ungraded');
  const [pageBlocksMap, setPageBlocksMap] = useState<Record<string, HomeworkPageBlock[]>>({});
  const [pageMetaMap, setPageMetaMap] = useState<Record<string, Pick<HomeworkPage, 'id' | 'title' | 'due_at'>>>({});
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);

  useEffect(() => {
    setSection(mode === 'grading' ? 'grading' : initialSection);
  }, [initialSection, mode]);

  const showSectionTabs = mode === 'combined';
  const activeSection = mode === 'grading' ? 'grading' : section;

  const loadGrading = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user) return;
    if (silent) setRefreshing(true);
    else {
      setInitialLoading(true);
      setLoadError(null);
    }
    const [pRes, sRes, gRes, membersRes, gtRows] = await Promise.all([
      supabase
        .from('homework_pages')
        .select('id, title, due_at')
        .eq('is_published', true)
        .order('due_at', { ascending: true, nullsFirst: false }),
      supabase
        .from('homework_page_submissions')
        .select('*, page:homework_pages(id, title, max_score)')
        .in('status', ['submitted', 'graded'])
        .order('submitted_at', { ascending: false }),
      supabase.from('groups').select('*').eq('group_type', 'teacher').order('name'),
      supabase.from('group_members').select('*'),
      loadGroupTeachers(supabase),
    ]);
    if (pRes.error) setLoadError(homeworkPageLoadError(pRes.error.message));
    else {
      const pageRows = (pRes.data ?? []) as Pick<HomeworkPage, 'id' | 'title' | 'due_at'>[];
      setPages(pageRows.map(({ id, title }) => ({ id, title })));
      setPageMetaMap(Object.fromEntries(pageRows.map((p) => [p.id, p])));
    }
    if (sRes.error) {
      setLoadError(homeworkPageLoadError(sRes.error.message));
      setAllSubmissions([]);
      setPageBlocksMap({});
    } else if (sRes.data) {
      const subs = sRes.data as HomeworkPageSubmission[];
      const userIds = [...new Set(subs.map((s) => s.user_id))];
      const pageIds = [...new Set(subs.map((s) => s.page_id))];
      const [{ data: profiles }, { data: blocks }] = await Promise.all([
        userIds.length
          ? supabase.from('user_profiles').select('id, display_name, email, avatar_url').in('id', userIds)
          : Promise.resolve({ data: [] }),
        pageIds.length
          ? supabase.from('homework_page_blocks').select('*').in('page_id', pageIds)
          : Promise.resolve({ data: [] }),
      ]);
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setAllSubmissions(subs.map((s) => ({ ...s, student: profileMap[s.user_id] ?? null })));
      const blocksMap: Record<string, HomeworkPageBlock[]> = {};
      for (const block of (blocks ?? []) as HomeworkPageBlock[]) {
        (blocksMap[block.page_id] ??= []).push(block);
      }
      setPageBlocksMap(blocksMap);
    }
    const rawGroups = (gRes.data ?? []) as Group[];
    const visibleGroups = isSuperAdmin
      ? rawGroups
      : groupsForTeacher(rawGroups, gtRows, user.id);
    setGroups(visibleGroups);
    setTeacherGroupIds(new Set(visibleGroups.map((g) => g.id)));
    setStudentGroups(studentGroupMap((membersRes.data ?? []) as GroupMember[]));
    if (silent) setRefreshing(false);
    else setInitialLoading(false);
  };

  useEffect(() => {
    loadGrading();
  }, [user?.id, isSuperAdmin]);

  const submissions = useMemo(
    () => allSubmissions.filter((s) =>
      pageSubmissionVisibleToStaff(s, studentGroups, teacherGroupIds, isSuperAdmin),
    ),
    [allSubmissions, studentGroups, teacherGroupIds, isSuperAdmin],
  );

  const filteredSubmissions = useMemo(() => {
    const list = gradingFilter === 'all'
      ? submissions
      : gradingFilter === 'ungraded'
        ? submissions.filter((s) => !submissionHasGrade(s))
        : submissions.filter((s) => submissionHasGrade(s));
    return [...list].sort((a, b) => {
      const aUngraded = !submissionHasGrade(a);
      const bUngraded = !submissionHasGrade(b);
      if (aUngraded && !bUngraded) return -1;
      if (!aUngraded && bUngraded) return 1;
      const aTime = new Date(a.submitted_at ?? a.graded_at ?? a.updated_at).getTime();
      const bTime = new Date(b.submitted_at ?? b.graded_at ?? b.updated_at).getTime();
      return bTime - aTime;
    });
  }, [submissions, gradingFilter]);

  const ungradedCount = useMemo(
    () => submissions.filter((s) => !submissionHasGrade(s)).length,
    [submissions],
  );

  const gradedCount = useMemo(
    () => submissions.filter((s) => submissionHasGrade(s)).length,
    [submissions],
  );

  const submissionsByGroup = useMemo(() => {
    const buckets = new Map<string, { label: string; items: HomeworkPageSubmission[] }>();
    const ensure = (id: string, label: string) => {
      if (!buckets.has(id)) buckets.set(id, { label, items: [] });
      return buckets.get(id)!;
    };
    for (const s of filteredSubmissions) {
      const gid = studentGroups[s.user_id];
      if (!gid) {
        ensure('none', 'Без учебной группы').items.push(s);
      } else {
        const name = groups.find((g) => g.id === gid)?.name ?? 'Группа';
        ensure(gid, name).items.push(s);
      }
    }
    return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [filteredSubmissions, studentGroups, groups]);

  const getGradeDraft = (s: HomeworkPageSubmission) =>
    gradeDrafts[s.id] ?? {
      score: s.score != null ? formatHomeworkScoreValue(s.score) : '',
      feedback: s.feedback ?? '',
    };

  const setGradeDraft = (
    id: string,
    patch: Partial<{ score: string; feedback: string }>,
    fallback?: HomeworkPageSubmission,
  ) => {
    setGradeDrafts((prev) => {
      const current = prev[id] ?? {
        score: fallback?.score != null ? formatHomeworkScoreValue(fallback.score) : '',
        feedback: fallback?.feedback ?? '',
      };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };

  const gradeSubmission = async (s: HomeworkPageSubmission) => {
    const draft = getGradeDraft(s);
    const maxScore = submissionMaxScore(s);
    const score = parseHomeworkScore(draft.score, maxScore);
    if (score === null) {
      toast(`Укажите оценку от 0 до ${formatHomeworkScoreValue(maxScore)}`, 'warning');
      return;
    }
    const feedback = draft.feedback.trim().slice(0, 1000);
    setGradingId(s.id);
    const { data: { user: grader } } = await supabase.auth.getUser();
    const { data: updated, error: err } = await supabase
      .from('homework_page_submissions')
      .update({
        score,
        feedback,
        status: 'graded',
        graded_at: new Date().toISOString(),
        graded_by: grader?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', s.id)
      .select('*, page:homework_pages(id, title, max_score)')
      .single();

    if (err || !updated) {
      toast(homeworkPageLoadError(err?.message) ?? 'Не удалось сохранить оценку', 'error');
      setGradingId(null);
      return;
    }

    const title = s.page?.title ?? 'Домашнее задание';
    const idx = pages.findIndex((p) => p.id === s.page_id);
    await syncProgressFromGrade(supabase, s.user_id, title, idx >= 0 ? idx : 0, score, maxScore);

    const row = updated as HomeworkPageSubmission;
    setGradeDrafts((prev) => ({
      ...prev,
      [s.id]: { score: formatHomeworkScoreValue(score), feedback },
    }));
    setAllSubmissions((prev) =>
      prev.map((sub) => (
        sub.id === s.id
          ? { ...sub, ...row, student: sub.student, page: row.page ?? sub.page }
          : sub
      )),
    );
    setGradingId(null);
  };

  return (
    <div className={`space-y-6 max-w-4xl relative transition-opacity duration-200 ${refreshing ? 'opacity-80' : ''}`}>
      {refreshing && activeSection === 'grading' && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-white/10 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Обновление…
        </div>
      )}

      {showSectionTabs && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSection('pages')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              section === 'pages'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            Задания
          </button>
          <button
            type="button"
            onClick={() => setSection('grading')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              section === 'grading'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            Проверка{ungradedCount > 0 ? ` · ${ungradedCount}` : ''}
          </button>
        </div>
      )}

      {activeSection === 'pages' ? (
        <HomeworkPagesTab />
      ) : (
        <div className="space-y-6">
          <SectionHint text={SECTION_HINT.admin.homeworkGrading} />

          <div className="flex flex-wrap gap-2">
            {([
              ['all', `Все · ${submissions.length}`],
              ['ungraded', `Без оценки · ${ungradedCount}`],
              ['graded', `С оценкой · ${gradedCount}`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setGradingFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  gradingFilter === id
                    ? 'bg-violet-600/20 text-violet-200 border-violet-500/30'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loadError && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              {loadError}
            </p>
          )}

          {initialLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center text-slate-400 text-sm space-y-2">
              <p>Пока нет сданных работ.</p>
              <p className="text-xs text-slate-600">
                Ученик должен открыть опубликованное ДЗ и нажать «Отправить на проверку».
                Черновики преподавателю не видны.
              </p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center text-slate-400 text-sm">
              {gradingFilter === 'ungraded'
                ? 'Нет работ без оценки'
                : gradingFilter === 'graded'
                  ? 'Нет работ с оценкой'
                  : 'Нет работ в выбранном фильтре'}
            </div>
          ) : isSuperAdmin ? (
            submissionsByGroup.map(({ label, items }) => (
              <div key={label} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{label}</h3>
                {items.map((s) => (
                  <SubmissionGradeCard
                    key={s.id}
                    submission={s}
                    draft={getGradeDraft(s)}
                    gradingId={gradingId}
                    blocks={pageBlocksMap[s.page_id] ?? []}
                    pageMeta={pageMetaMap[s.page_id]}
                    onOpenPreview={() => setPreviewPageId(s.page_id)}
                    onScoreChange={(v) => setGradeDraft(s.id, { score: v }, s)}
                    onFeedbackChange={(v) => setGradeDraft(s.id, { feedback: v }, s)}
                    onSave={() => gradeSubmission(s)}
                  />
                ))}
              </div>
            ))
          ) : (
            filteredSubmissions.map((s) => (
              <SubmissionGradeCard
                key={s.id}
                submission={s}
                draft={getGradeDraft(s)}
                gradingId={gradingId}
                blocks={pageBlocksMap[s.page_id] ?? []}
                pageMeta={pageMetaMap[s.page_id]}
                onOpenPreview={() => setPreviewPageId(s.page_id)}
                onScoreChange={(v) => setGradeDraft(s.id, { score: v }, s)}
                onFeedbackChange={(v) => setGradeDraft(s.id, { feedback: v }, s)}
                onSave={() => gradeSubmission(s)}
              />
            ))
          )}

          {previewPageId && pageMetaMap[previewPageId] && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-3xl max-h-[min(90vh,48rem)] overflow-y-auto rounded-2xl bg-slate-950 border border-white/10 p-5 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-white">Как видит ученик</h3>
                  <button
                    type="button"
                    onClick={() => setPreviewPageId(null)}
                    className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5"
                  >
                    Закрыть
                  </button>
                </div>
                <HomeworkPageStudentPreview
                  title={pageMetaMap[previewPageId].title}
                  dueAt={pageMetaMap[previewPageId].due_at}
                  blocks={pageBlocksMap[previewPageId] ?? []}
                  preview
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubmissionGradeCard({
  submission: s,
  draft,
  gradingId,
  blocks,
  pageMeta,
  onOpenPreview,
  onScoreChange,
  onFeedbackChange,
  onSave,
}: {
  submission: HomeworkPageSubmission;
  draft: { score: string; feedback: string };
  gradingId: string | null;
  blocks: HomeworkPageBlock[];
  pageMeta?: Pick<HomeworkPage, 'id' | 'title' | 'due_at'>;
  onOpenPreview?: () => void;
  onScoreChange: (v: string) => void;
  onFeedbackChange: (v: string) => void;
  onSave: () => void;
}) {
  const FEEDBACK_MAX = 1000;
  const name = s.student?.display_name ?? 'Ученик';
  const studentSubtitle = profileEmail(s.student);
  const hasGrade = submissionHasGrade(s);
  const submittedWhen = formatSubmissionWhen(s.submitted_at);
  const gradedWhen = formatSubmissionWhen(s.graded_at);
  const saving = gradingId === s.id;
  const maxScore = submissionMaxScore(s);
  const scoreValue = parseHomeworkScore(draft.score, maxScore);
  const canSave = scoreValue !== null && !saving;
  const badgeClass = hasGrade ? SUBMISSION_STATUS_COLORS.graded : SUBMISSION_STATUS_COLORS.submitted;
  const badgeLabel = hasGrade && s.score !== null
    ? formatHomeworkScoreShort(s.score, maxScore)
    : 'Без оценки';
  const submissionLinks = homeworkSubmissionLinksFromBlocks(blocks);

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-start gap-3 p-4 pb-3">
        <UserAvatar
          displayName={name}
          avatarUrl={s.student?.avatar_url}
          size="md"
        />
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{name}</p>
            {studentSubtitle && (
              <p className="text-xs text-slate-500 truncate">{studentSubtitle}</p>
            )}
            <p className="text-sm text-blue-300 mt-1 line-clamp-2 break-words">{s.page?.title}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {pageMeta && onOpenPreview && (
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-white/5 text-slate-300 border border-white/10 hover:text-white hover:bg-white/10"
                >
                  <Eye className="w-3 h-3" />
                  Условие задания
                </button>
              )}
              {submissionLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-200 border border-violet-500/20 hover:bg-violet-500/20"
                >
                  <ExternalLink className="w-3 h-3" />
                  {link.label}
                </a>
              ))}
            </div>
            {submissionLinks.length > 0 && (
              <p className="text-[11px] text-slate-600 mt-1.5">Ответ ученика — в форме или контесте по ссылке</p>
            )}
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1 shrink-0 text-xs">
            <span className={`inline-flex px-2 py-0.5 rounded-md border ${badgeClass}`}>
              {badgeLabel}
            </span>
            {submittedWhen && (
              <span className="text-slate-500">Сдано {submittedWhen}</span>
            )}
            {hasGrade && gradedWhen && (
              <span className="text-slate-500">Оценено {gradedWhen}</span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 px-4 py-3 space-y-3 bg-slate-950/30">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-xs text-slate-500">Комментарий ученику</label>
            <span className="text-[10px] text-slate-600 tabular-nums">
              {draft.feedback.length}/{FEEDBACK_MAX}
            </span>
          </div>
          <textarea
            value={draft.feedback}
            onChange={(e) => onFeedbackChange(e.target.value.slice(0, FEEDBACK_MAX))}
            maxLength={FEEDBACK_MAX}
            rows={3}
            placeholder="Необязательно"
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/60 resize-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Оценка</span>
            <input
              type="text"
              inputMode="decimal"
              maxLength={7}
              value={draft.score}
              onChange={(e) => {
                const next = normalizeHomeworkScoreInput(e.target.value);
                if (next !== null) onScoreChange(next);
              }}
              className={`w-16 h-9 px-1 rounded-lg bg-slate-950/80 border text-white text-sm text-center font-semibold tabular-nums focus:outline-none [appearance:textfield] ${
                draft.score.trim() !== '' && scoreValue === null
                  ? 'border-rose-500/50 focus:border-rose-500/60'
                  : 'border-white/10 focus:border-blue-500/60'
              }`}
              aria-label={`Оценка от 0 до ${formatHomeworkScoreValue(maxScore)}`}
              aria-invalid={draft.score.trim() !== '' && scoreValue === null}
            />
            <span className="text-sm text-slate-500">/ {formatHomeworkScoreValue(maxScore)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            {!canSave && !saving && draft.score.trim() === '' && (
              <span className="text-xs text-slate-600">Сначала укажите оценку</span>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 disabled:hover:bg-emerald-600"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {hasGrade ? 'Обновить данные' : 'Сохранить оценку'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
