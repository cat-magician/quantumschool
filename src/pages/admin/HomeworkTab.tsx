import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  formatHomeworkScoreValue,
  parseHomeworkScore,
  syncProgressFromGrade,
  DEFAULT_HOMEWORK_MAX_SCORE,
} from '../../lib/homeworkUtils';
import { homeworkPageLoadError } from '../../lib/homeworkPageLoadError';
import { gradesWithoutMark, homeworkSubmissionMode } from '../../lib/homeworkPageUtils';
import { visibleToGroup } from '../../lib/groupTargeting';
import HomeworkGradingWorkspace from '../../components/HomeworkGradingWorkspace';
import HomeworkPagesTab from './HomeworkPagesTab';

type Section = 'pages' | 'grading';
type GradingFilter = 'all' | 'ungraded' | 'graded';
type GradingPage = Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'max_score' | 'group_ids'>;
type StudentCard = NonNullable<HomeworkPageSubmission['student']>;

function submissionMaxScore(s: HomeworkPageSubmission) {
  return s.page?.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE;
}

/** Строка очереди для того, кто не отмечал сдачу: при сдаче в чате оценка нужна и ему. */
function unmarkedRow(page: GradingPage, student: StudentCard): HomeworkPageSubmission {
  return {
    id: `unmarked:${page.id}:${student.id}`,
    page_id: page.id,
    user_id: student.id,
    answer_text: '',
    status: 'draft',
    score: null,
    feedback: '',
    graded_by: null,
    submitted_at: null,
    graded_at: null,
    created_at: '',
    updated_at: '',
    page: { id: page.id, title: page.title, max_score: page.max_score },
    student,
    unmarked: true,
  };
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
  const [pages, setPages] = useState<Pick<HomeworkPage, 'id' | 'title' | 'due_at'>[]>([]);
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
        .select('id, title, due_at, max_score, group_ids')
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
    const pageRows = (pRes.data ?? []) as GradingPage[];
    if (pRes.error) setLoadError(homeworkPageLoadError(pRes.error.message));
    else {
      setPages(pageRows);
      setPageMetaMap(Object.fromEntries(pageRows.map((p) => [p.id, p])));
    }
    const members = (membersRes.data ?? []) as GroupMember[];
    if (sRes.error) {
      setLoadError(homeworkPageLoadError(sRes.error.message));
      setAllSubmissions([]);
      setPageBlocksMap({});
    } else if (sRes.data) {
      const subs = sRes.data as HomeworkPageSubmission[];
      const userIds = [...new Set(subs.map((s) => s.user_id))];
      // Блоки всех заданий: по ним видно, где сдача идёт в чате группы.
      const pageIds = pageRows.map((p) => p.id);
      const [{ data: profiles }, { data: blocks }] = await Promise.all([
        userIds.length
          ? supabase.from('user_profiles').select('id, display_name, email, avatar_url').in('id', userIds)
          : Promise.resolve({ data: [] }),
        pageIds.length
          ? supabase.from('homework_page_blocks').select('*').in('page_id', pageIds)
          : Promise.resolve({ data: [] }),
      ]);
      const blocksMap: Record<string, HomeworkPageBlock[]> = {};
      for (const block of (blocks ?? []) as HomeworkPageBlock[]) {
        (blocksMap[block.page_id] ??= []).push(block);
      }

      // Сдача не через сайт (чат группы или без блока сдачи): в очереди все,
      // кому задано, — отметка на сайте необязательна, а оценку ставят здесь.
      const rosterPages = pageRows.filter((p) => gradesWithoutMark(homeworkSubmissionMode(blocksMap[p.id] ?? [])));
      let enrolled: StudentCard[] = [];
      if (rosterPages.length > 0) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, display_name, email, avatar_url')
          .eq('role', 'student')
          .eq('is_enrolled', true);
        enrolled = (data ?? []) as StudentCard[];
      }
      const groupOf = studentGroupMap(members);
      const unmarked: HomeworkPageSubmission[] = [];
      for (const page of rosterPages) {
        const marked = new Set(subs.filter((s) => s.page_id === page.id).map((s) => s.user_id));
        for (const student of enrolled) {
          if (marked.has(student.id) || !visibleToGroup(page.group_ids, groupOf[student.id])) continue;
          unmarked.push(unmarkedRow(page, student));
        }
      }

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setAllSubmissions([
        ...subs.map((s) => ({ ...s, student: profileMap[s.user_id] ?? null })),
        ...unmarked,
      ]);
      setPageBlocksMap(blocksMap);
    }
    const rawGroups = (gRes.data ?? []) as Group[];
    const visibleGroups = isSuperAdmin
      ? rawGroups
      : groupsForTeacher(rawGroups, gtRows, user.id);
    setGroups(visibleGroups);
    setTeacherGroupIds(new Set(visibleGroups.map((g) => g.id)));
    setStudentGroups(studentGroupMap(members));
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

  // Отметившие сдачу: не отмечавшиеся (сдача в чате) работами «на проверке» не считаем.
  const ungradedCount = useMemo(
    () => submissions.filter((s) => s.status !== 'graded' && !s.unmarked).length,
    [submissions],
  );

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

  /** Сохраняет оценку; возвращает id записи (у не отмечавшегося она появляется только сейчас). */
  const gradeSubmission = async (s: HomeworkPageSubmission): Promise<string | null> => {
    const draft = gradeDrafts[s.id] ?? {
      score: s.score != null ? formatHomeworkScoreValue(s.score) : '',
      feedback: s.feedback ?? '',
    };
    const maxScore = submissionMaxScore(s);
    const score = parseHomeworkScore(draft.score, maxScore);
    if (score === null) {
      toast(`Укажите оценку от 0 до ${formatHomeworkScoreValue(maxScore)}`, 'warning');
      return null;
    }
    const feedback = draft.feedback.trim().slice(0, 1000);
    setGradingId(s.id);
    const { data: { user: grader } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const grade = {
      score,
      feedback,
      status: 'graded' as const,
      graded_at: now,
      graded_by: grader?.id ?? null,
      updated_at: now,
    };
    // Не отмечавшийся мог сохранить черновик — тогда запись уже есть, и
    // upsert её дополнит.
    const request = s.unmarked
      ? supabase
        .from('homework_page_submissions')
        .upsert({ page_id: s.page_id, user_id: s.user_id, ...grade }, { onConflict: 'page_id,user_id' })
      : supabase.from('homework_page_submissions').update(grade).eq('id', s.id);
    const { data: updated, error: err } = await request
      .select('*, page:homework_pages(id, title, max_score)')
      .single();

    if (err || !updated) {
      toast(homeworkPageLoadError(err?.message) ?? 'Не удалось сохранить оценку', 'error');
      setGradingId(null);
      return null;
    }

    const title = s.page?.title ?? 'Домашнее задание';
    const idx = pages.findIndex((p) => p.id === s.page_id);
    await syncProgressFromGrade(supabase, s.user_id, title, idx >= 0 ? idx : 0, score, maxScore);

    const row = updated as HomeworkPageSubmission;
    setGradeDrafts((prev) => ({
      ...prev,
      [row.id]: { score: formatHomeworkScoreValue(score), feedback },
    }));
    setAllSubmissions((prev) =>
      prev.map((sub) => (
        sub.id === s.id
          ? { ...sub, ...row, student: sub.student, page: row.page ?? sub.page, unmarked: false }
          : sub
      )),
    );
    setGradingId(null);
    return row.id;
  };

  return (
    <div className={`space-y-6 relative transition-opacity duration-200 ${refreshing ? 'opacity-80' : ''}`}>
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
        <HomeworkGradingWorkspace
          submissions={submissions}
          pages={pages}
          pageMetaMap={pageMetaMap}
          pageBlocksMap={pageBlocksMap}
          groups={groups}
          studentGroups={studentGroups}
          isSuperAdmin={isSuperAdmin}
          gradingId={gradingId}
          gradeDrafts={gradeDrafts}
          gradingFilter={gradingFilter}
          onGradingFilterChange={setGradingFilter}
          onGradeDraftChange={setGradeDraft}
          onSaveGrade={gradeSubmission}
          loadError={loadError}
          initialLoading={initialLoading}
        />
      )}
    </div>
  );
}
