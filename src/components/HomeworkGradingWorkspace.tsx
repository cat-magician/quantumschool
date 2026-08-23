import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Loader2,
} from 'lucide-react';
import type { Group, HomeworkPage, HomeworkPageBlock, HomeworkPageSubmission } from '../lib/types';
import {
  formatHomeworkScoreShort,
  formatHomeworkScoreValue,
  formatDueDate,
  normalizeHomeworkScoreInput,
  parseHomeworkScore,
  SUBMISSION_STATUS_COLORS,
  DEFAULT_HOMEWORK_MAX_SCORE,
} from '../lib/homeworkUtils';
import { homeworkSubmissionLinksFromBlocks } from '../lib/homeworkPageUtils';
import { profileAccountLabel } from '../lib/profileUtils';
import UserAvatar from './UserAvatar';
import HomeworkPageStudentPreview from './HomeworkPageStudentPreview';
import SectionHint from './SectionHint';
import { SECTION_HINT } from '../lib/dashboardHelpCopy';

type GradingFilter = 'all' | 'ungraded' | 'graded';

function formatSubmissionWhen(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function submissionMaxScore(s: HomeworkPageSubmission) {
  return s.page?.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE;
}

function submissionHasGrade(s: HomeworkPageSubmission) {
  return s.status === 'graded';
}

type AssignmentSummary = {
  pageId: string;
  title: string;
  dueAt: string | null;
  submitted: number;
  ungraded: number;
  graded: number;
};

function buildAssignmentSummaries(
  pages: Pick<HomeworkPage, 'id' | 'title' | 'due_at'>[],
  submissions: HomeworkPageSubmission[],
): AssignmentSummary[] {
  const byPage = new Map<string, HomeworkPageSubmission[]>();
  for (const s of submissions) {
    const bucket = byPage.get(s.page_id);
    if (bucket) bucket.push(s);
    else byPage.set(s.page_id, [s]);
  }

  return pages.map((page) => {
    const items = byPage.get(page.id) ?? [];
    const ungraded = items.filter((s) => !submissionHasGrade(s)).length;
    const graded = items.length - ungraded;
    return {
      pageId: page.id,
      title: page.title,
      dueAt: page.due_at,
      submitted: items.length,
      ungraded,
      graded,
    };
  });
}

function pickDefaultPageId(summaries: AssignmentSummary[]): string | null {
  if (summaries.length === 0) return null;
  const withPending = summaries.filter((a) => a.ungraded > 0);
  if (withPending.length > 0) {
    return withPending.sort((a, b) => b.ungraded - a.ungraded)[0]!.pageId;
  }
  return summaries[0]!.pageId;
}

function sortQueueItems(
  items: HomeworkPageSubmission[],
  studentGroups: Record<string, string>,
  groups: Group[],
): HomeworkPageSubmission[] {
  const groupName = (userId: string) => {
    const gid = studentGroups[userId];
    if (!gid) return 'Без группы';
    return groups.find((g) => g.id === gid)?.name ?? 'Группа';
  };

  return [...items].sort((a, b) => {
    const aUngraded = !submissionHasGrade(a);
    const bUngraded = !submissionHasGrade(b);
    if (aUngraded !== bUngraded) return aUngraded ? -1 : 1;
    const g = groupName(a.user_id).localeCompare(groupName(b.user_id), 'ru');
    if (g !== 0) return g;
    const an = a.student?.display_name ?? '';
    const bn = b.student?.display_name ?? '';
    const n = an.localeCompare(bn, 'ru');
    if (n !== 0) return n;
    const aTime = new Date(a.submitted_at ?? 0).getTime();
    const bTime = new Date(b.submitted_at ?? 0).getTime();
    return bTime - aTime;
  });
}

export default function HomeworkGradingWorkspace({
  submissions,
  pages,
  pageMetaMap,
  pageBlocksMap,
  groups,
  studentGroups,
  isSuperAdmin,
  gradingId,
  gradeDrafts,
  gradingFilter,
  onGradingFilterChange,
  onGradeDraftChange,
  onSaveGrade,
  loadError,
  initialLoading,
}: {
  submissions: HomeworkPageSubmission[];
  pages: Pick<HomeworkPage, 'id' | 'title' | 'due_at'>[];
  pageMetaMap: Record<string, Pick<HomeworkPage, 'id' | 'title' | 'due_at'>>;
  pageBlocksMap: Record<string, HomeworkPageBlock[]>;
  groups: Group[];
  studentGroups: Record<string, string>;
  isSuperAdmin: boolean;
  gradingId: string | null;
  gradeDrafts: Record<string, { score: string; feedback: string }>;
  gradingFilter: GradingFilter;
  onGradingFilterChange: (filter: GradingFilter) => void;
  onGradeDraftChange: (
    id: string,
    patch: Partial<{ score: string; feedback: string }>,
    fallback?: HomeworkPageSubmission,
  ) => void;
  onSaveGrade: (s: HomeworkPageSubmission, advance?: boolean) => Promise<boolean>;
  loadError: string | null;
  initialLoading: boolean;
}) {
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);

  const pageRows = useMemo(
    () => pages.map((p) => pageMetaMap[p.id] ?? p),
    [pages, pageMetaMap],
  );

  const assignmentSummaries = useMemo(
    () => buildAssignmentSummaries(pageRows, submissions),
    [pageRows, submissions],
  );

  const ungradedCount = useMemo(
    () => submissions.filter((s) => !submissionHasGrade(s)).length,
    [submissions],
  );

  useEffect(() => {
    if (assignmentSummaries.length === 0) {
      setSelectedPageId(null);
      return;
    }
    setSelectedPageId((current) => {
      if (current && assignmentSummaries.some((a) => a.pageId === current)) return current;
      return pickDefaultPageId(assignmentSummaries);
    });
  }, [assignmentSummaries]);

  const queueForPage = useMemo(() => {
    if (!selectedPageId) return [];
    const forPage = submissions.filter((s) => s.page_id === selectedPageId);
    const filtered = gradingFilter === 'all'
      ? forPage
      : gradingFilter === 'ungraded'
        ? forPage.filter((s) => !submissionHasGrade(s))
        : forPage.filter((s) => submissionHasGrade(s));
    return sortQueueItems(filtered, studentGroups, groups);
  }, [submissions, selectedPageId, gradingFilter, studentGroups, groups]);

  useEffect(() => {
    if (queueForPage.length === 0) {
      setSelectedSubmissionId(null);
      return;
    }
    setSelectedSubmissionId((current) => {
      if (current && queueForPage.some((s) => s.id === current)) return current;
      return queueForPage[0]!.id;
    });
  }, [queueForPage, selectedPageId, gradingFilter]);

  const selectedSubmission = useMemo(
    () => queueForPage.find((s) => s.id === selectedSubmissionId) ?? null,
    [queueForPage, selectedSubmissionId],
  );

  const selectedIndex = selectedSubmission
    ? queueForPage.findIndex((s) => s.id === selectedSubmission.id)
    : -1;

  const selectedAssignment = assignmentSummaries.find((a) => a.pageId === selectedPageId);

  const goToSubmission = useCallback((offset: number) => {
    if (selectedIndex < 0 || queueForPage.length === 0) return;
    const nextIndex = Math.max(0, Math.min(queueForPage.length - 1, selectedIndex + offset));
    setSelectedSubmissionId(queueForPage[nextIndex]!.id);
  }, [selectedIndex, queueForPage]);

  const handleSave = async (advance: boolean) => {
    if (!selectedSubmission) return;
    const ok = await onSaveGrade(selectedSubmission, advance);
    if (!ok || !advance) return;

    const stillHere = queueForPage.filter((s) => s.id !== selectedSubmission.id);
    const nextUngraded = stillHere.find((s) => !submissionHasGrade(s));
    const next = nextUngraded ?? stillHere[0];
    if (next) setSelectedSubmissionId(next.id);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        goToSubmission(1);
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        goToSubmission(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToSubmission]);

  const getGradeDraft = (s: HomeworkPageSubmission) =>
    gradeDrafts[s.id] ?? {
      score: s.score != null ? formatHomeworkScoreValue(s.score) : '',
      feedback: s.feedback ?? '',
    };

  const groupLabel = (userId: string) => {
    const gid = studentGroups[userId];
    if (!gid) return 'Без группы';
    return groups.find((g) => g.id === gid)?.name ?? 'Группа';
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
        {loadError}
      </p>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHint text={SECTION_HINT.admin.homeworkGrading} />
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center text-slate-400 text-sm space-y-2">
          <p>Пока нет сданных работ.</p>
          <p className="text-xs text-slate-600">
            Ученик должен открыть опубликованное ДЗ и нажать «Отправить на проверку».
            Черновики преподавателю не видны.
          </p>
        </div>
      </div>
    );
  }

  if (pageRows.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center text-slate-400 text-sm">
        Нет опубликованных заданий для проверки.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-violet-300/80 mb-1">
            Проверка по заданию
          </p>
          <SectionHint text={SECTION_HINT.admin.homeworkGrading} />
        </div>
        {ungradedCount > 0 && (
          <p className="text-sm text-amber-200/90 tabular-nums shrink-0">
            {ungradedCount} {ungradedCount === 1 ? 'работа ждёт' : 'работ ждут'} оценки
          </p>
        )}
      </div>

      <div className="relative -mx-1 px-1">
        <div className="flex gap-2.5 overflow-x-auto scrollbar-site pb-1 snap-x snap-mandatory">
          {assignmentSummaries.map((assignment) => {
            const active = assignment.pageId === selectedPageId;
            const progress = assignment.submitted > 0
              ? assignment.graded / assignment.submitted
              : 0;
            const hasPending = assignment.ungraded > 0;

            return (
              <button
                key={assignment.pageId}
                type="button"
                onClick={() => setSelectedPageId(assignment.pageId)}
                className={`snap-start shrink-0 w-[min(100%,17rem)] text-left rounded-2xl border transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-br from-violet-600/20 via-slate-900/80 to-slate-900/90 border-violet-500/35 shadow-lg shadow-violet-950/30 ring-1 ring-violet-400/20'
                    : 'bg-slate-900/50 border-white/8 hover:border-white/15 hover:bg-slate-900/70'
                }`}
              >
                <div className="p-3.5 pb-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-1 w-1 self-stretch min-h-[2.5rem] rounded-full shrink-0 ${
                        hasPending
                          ? active ? 'bg-amber-400/90' : 'bg-amber-500/50'
                          : assignment.submitted > 0
                            ? 'bg-emerald-500/40'
                            : 'bg-slate-600/40'
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold leading-snug line-clamp-2 ${
                        active ? 'text-white' : 'text-slate-200'
                      }`}
                      >
                        {assignment.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {formatDueDate(assignment.dueAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                    {assignment.submitted === 0 ? (
                      <span className="text-slate-600">Пока нет сдач</span>
                    ) : hasPending ? (
                      <span className="text-amber-200/90 font-medium">
                        {assignment.ungraded} ждут проверки
                      </span>
                    ) : (
                      <span className="text-emerald-300/80">Все проверены</span>
                    )}
                    {assignment.submitted > 0 && (
                      <span className="text-slate-500 tabular-nums">
                        {assignment.graded}/{assignment.submitted}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-0.5 bg-slate-800/80 rounded-b-2xl overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      hasPending ? 'bg-gradient-to-r from-amber-500/80 to-violet-500/60' : 'bg-emerald-500/50'
                    }`}
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedAssignment && (
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['ungraded', `Ждут · ${selectedAssignment.ungraded}`],
            ['graded', `Проверены · ${selectedAssignment.graded}`],
            ['all', `Все · ${selectedAssignment.submitted}`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onGradingFilterChange(id)}
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
      )}

      {queueForPage.length === 0 ? (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center text-slate-400 text-sm">
          {gradingFilter === 'ungraded'
            ? 'По этому заданию все работы уже проверены'
            : gradingFilter === 'graded'
              ? 'Пока нет проверенных работ по этому заданию'
              : 'По этому заданию пока нет сдач'}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] gap-4 items-start">
          <aside className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden flex flex-col max-h-[min(70vh,36rem)] lg:sticky lg:top-20">
            <div className="shrink-0 px-3 py-2.5 border-b border-white/5 bg-slate-950/40">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Очередь
              </p>
              {selectedAssignment && (
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                  {selectedAssignment.title}
                </p>
              )}
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-site divide-y divide-white/5">
              {queueForPage.map((s, index) => {
                const active = s.id === selectedSubmissionId;
                const hasGrade = submissionHasGrade(s);
                const name = s.student?.display_name ?? 'Ученик';
                const when = formatSubmissionWhen(s.submitted_at);

                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSubmissionId(s.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'bg-violet-600/15 border-l-2 border-l-violet-400'
                          : 'hover:bg-white/5 border-l-2 border-l-transparent'
                      }`}
                    >
                      <UserAvatar
                        displayName={name}
                        avatarUrl={s.student?.avatar_url}
                        size="xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${active ? 'text-white font-medium' : 'text-slate-200'}`}>
                          {name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {isSuperAdmin && (
                            <span className="text-[10px] text-slate-600 truncate max-w-[8rem]">
                              {groupLabel(s.user_id)}
                            </span>
                          )}
                          {when && (
                            <span className="text-[10px] text-slate-600">{when}</span>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                        hasGrade ? SUBMISSION_STATUS_COLORS.graded : SUBMISSION_STATUS_COLORS.submitted
                      }`}>
                        {hasGrade && s.score != null
                          ? formatHomeworkScoreShort(s.score, submissionMaxScore(s))
                          : '·'}
                      </span>
                      <span className="sr-only">{index + 1} из {queueForPage.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="shrink-0 px-3 py-2 border-t border-white/5 text-[10px] text-slate-600">
              ↑↓ или j/k — переключить ученика
            </div>
          </aside>

          <div className="min-w-0 space-y-3">
            {selectedSubmission && selectedIndex >= 0 && (
              <>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="tabular-nums">
                    {selectedIndex + 1} из {queueForPage.length}
                    {selectedAssignment && selectedAssignment.ungraded > 0 && (
                      <span className="text-amber-300/80 ml-2">
                        · {selectedAssignment.ungraded} без оценки
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => goToSubmission(-1)}
                      disabled={selectedIndex <= 0}
                      className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
                      aria-label="Предыдущий ученик"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => goToSubmission(1)}
                      disabled={selectedIndex >= queueForPage.length - 1}
                      className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
                      aria-label="Следующий ученик"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <SubmissionGradePanel
                  submission={selectedSubmission}
                  draft={getGradeDraft(selectedSubmission)}
                  gradingId={gradingId}
                  blocks={pageBlocksMap[selectedSubmission.page_id] ?? []}
                  pageMeta={pageMetaMap[selectedSubmission.page_id]}
                  onOpenPreview={() => setPreviewPageId(selectedSubmission.page_id)}
                  onScoreChange={(v) => onGradeDraftChange(selectedSubmission.id, { score: v }, selectedSubmission)}
                  onFeedbackChange={(v) => onGradeDraftChange(selectedSubmission.id, { feedback: v }, selectedSubmission)}
                  onSave={() => handleSave(false)}
                  onSaveAndNext={() => handleSave(true)}
                  hasNextUngraded={queueForPage.some(
                    (s) => s.id !== selectedSubmission.id && !submissionHasGrade(s),
                  )}
                />
              </>
            )}
          </div>
        </div>
      )}

      {previewPageId && pageMetaMap[previewPageId] && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[min(90vh,48rem)] overflow-y-auto scrollbar-site rounded-2xl bg-slate-950 border border-white/10 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-white">Условие задания</h3>
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
  );
}

function SubmissionGradePanel({
  submission: s,
  draft,
  gradingId,
  blocks,
  pageMeta,
  onOpenPreview,
  onScoreChange,
  onFeedbackChange,
  onSave,
  onSaveAndNext,
  hasNextUngraded,
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
  onSaveAndNext: () => void;
  hasNextUngraded: boolean;
}) {
  const FEEDBACK_MAX = 1000;
  const name = s.student?.display_name ?? 'Ученик';
  const studentSubtitle = profileAccountLabel(s.student);
  const hasGrade = submissionHasGrade(s);
  const submittedWhen = formatSubmissionWhen(s.submitted_at);
  const gradedWhen = formatSubmissionWhen(s.graded_at);
  const saving = gradingId === s.id;
  const maxScore = submissionMaxScore(s);
  const scoreValue = parseHomeworkScore(draft.score, maxScore);
  const canSave = scoreValue !== null && !saving;
  const submissionLinks = homeworkSubmissionLinksFromBlocks(blocks);

  return (
    <article className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
      <header className="flex items-start gap-3 p-4 pb-3 border-b border-white/5 bg-slate-950/20">
        <UserAvatar displayName={name} avatarUrl={s.student?.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white">{name}</p>
          {studentSubtitle && (
            <p className="text-xs text-slate-500 truncate">{studentSubtitle}</p>
          )}
          {submittedWhen && (
            <p className="text-xs text-slate-500 mt-1">Сдано {submittedWhen}</p>
          )}
          {hasGrade && gradedWhen && (
            <p className="text-xs text-slate-600">Оценено {gradedWhen}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end shrink-0">
          {pageMeta && onOpenPreview && (
            <button
              type="button"
              onClick={onOpenPreview}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-white/5 text-slate-300 border border-white/10 hover:text-white hover:bg-white/10"
            >
              <Eye className="w-3 h-3" />
              Условие
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
      </header>

      {submissionLinks.length > 0 && (
        <p className="px-4 pt-3 text-[11px] text-slate-600">
          Ответ ученика — в форме или контесте по ссылке выше
        </p>
      )}

      <div className="px-4 py-4 space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor={`feedback-${s.id}`} className="text-xs text-slate-500">
              Комментарий ученику
            </label>
            <span className="text-[10px] text-slate-600 tabular-nums">
              {draft.feedback.length}/{FEEDBACK_MAX}
            </span>
          </div>
          <textarea
            id={`feedback-${s.id}`}
            value={draft.feedback}
            onChange={(e) => onFeedbackChange(e.target.value.slice(0, FEEDBACK_MAX))}
            maxLength={FEEDBACK_MAX}
            rows={4}
            placeholder="Необязательно"
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 pt-1 border-t border-white/5">
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
                  : 'border-white/10 focus:border-violet-500/50'
              }`}
              aria-label={`Оценка от 0 до ${formatHomeworkScoreValue(maxScore)}`}
            />
            <span className="text-sm text-slate-500">/ {formatHomeworkScoreValue(maxScore)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {!canSave && !saving && draft.score.trim() === '' && (
              <span className="text-xs text-slate-600">Укажите оценку</span>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-white/10 hover:bg-white/15 border border-white/10"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {hasGrade ? 'Обновить' : 'Сохранить оценку'}
            </button>
            {hasNextUngraded && (
              <button
                type="button"
                onClick={onSaveAndNext}
                disabled={!canSave}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Сохранить и следующая
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
