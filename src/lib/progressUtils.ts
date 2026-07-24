import type {
  Achievement,
  CourseProgress,
  HomeworkPage,
  HomeworkPageSubmission,
  UserProfile,
} from './types';
import {
  collectEarnedKeys,
  formatAchievementsProgress,
  TOTAL_ACHIEVEMENTS_POSSIBLE,
  type AchievementIconKey,
} from './achievementUtils';
import {
  computeWeightedHomeworkAvg,
  DEFAULT_HOMEWORK_MAX_SCORE,
  formatHomeworkScoreValue,
} from './homeworkUtils';

export {
  ACHIEVEMENT_CATALOG,
  formatAchievementsProgress,
  TOTAL_ACHIEVEMENTS_POSSIBLE,
} from './achievementUtils';
export type { AchievementIconKey } from './achievementUtils';

export type HomeworkPageProgress = {
  pageId: string;
  title: string;
  dueAt: string | null;
  maxScore: number;
  status: 'none' | 'draft' | 'submitted' | 'graded';
  score: number | null;
  submittedAt: string | null;
  gradedAt: string | null;
};

export type StudentProgressSnapshot = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  groupId: string | null;
  groupName: string | null;
  grade: string | null;
  gradeLabel: string;
  gradedCount: number;
  submittedCount: number;
  pendingCount: number;
  draftCount: number;
  totalPublished: number;
  avgScore: number | null;
  achievementCount: number;
  totalAchievementsPossible: number;
  earnedAchievementKeys: AchievementIconKey[];
  progressPercent: number;
  stage1Score: number | null;
  stage2Score: number | null;
  selectionTotal: number | null;
  overdueMissing: number;
  homeworkPages: HomeworkPageProgress[];
  modules: CourseProgress[];
};

export type RankMetric =
  | 'avg_score'
  | 'graded_count'
  | 'progress_percent'
  | 'achievements'
  | 'selection_total';

export const RANK_METRIC_OPTIONS: { id: RankMetric; label: string }[] = [
  { id: 'avg_score', label: 'Средняя оценка за ДЗ' },
  { id: 'graded_count', label: 'Проверенных работ' },
  { id: 'progress_percent', label: 'Общий прогресс' },
  { id: 'achievements', label: 'Достижения (получено)' },
  { id: 'selection_total', label: 'Баллы отбора (этап 1 + 2)' },
];

export function pageProgressWeight(status: HomeworkPageProgress['status']) {
  if (status === 'graded') return 100;
  if (status === 'submitted') return 65;
  if (status === 'draft') return 25;
  return 0;
}

export function computeProgressPercent(pages: HomeworkPageProgress[]) {
  if (pages.length === 0) return 0;
  const sum = pages.reduce((acc, p) => acc + pageProgressWeight(p.status), 0);
  return Math.round(sum / pages.length);
}

export function buildHomeworkPageProgress(
  publishedPages: Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'max_score'>[],
  submissions: HomeworkPageSubmission[],
  userId: string,
): HomeworkPageProgress[] {
  const byPage = new Map(submissions.filter((s) => s.user_id === userId).map((s) => [s.page_id, s]));
  return publishedPages.map((page) => {
    const maxScore = page.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE;
    const sub = byPage.get(page.id);
    if (!sub) {
      return {
        pageId: page.id,
        title: page.title,
        dueAt: page.due_at,
        maxScore,
        status: 'none',
        score: null,
        submittedAt: null,
        gradedAt: null,
      };
    }
    return {
      pageId: page.id,
      title: page.title,
      dueAt: page.due_at,
      maxScore,
      status: sub.status,
      score: sub.score,
      submittedAt: sub.submitted_at,
      gradedAt: sub.graded_at,
    };
  });
}

export function countOverdueMissing(pages: HomeworkPageProgress[]) {
  const now = Date.now();
  return pages.filter(
    (p) => p.status === 'none' && p.dueAt && new Date(p.dueAt).getTime() < now,
  ).length;
}

export function buildStudentProgressSnapshot(
  student: UserProfile,
  publishedPages: Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'max_score'>[],
  submissions: HomeworkPageSubmission[],
  modules: CourseProgress[],
  achievements: Achievement[],
  groupId: string | null,
  groupName: string | null,
): StudentProgressSnapshot {
  const homeworkPages = buildHomeworkPageProgress(publishedPages, submissions, student.id);
  const graded = homeworkPages.filter((p) => p.status === 'graded');
  const submitted = homeworkPages.filter((p) => p.status === 'submitted');
  const drafts = homeworkPages.filter((p) => p.status === 'draft');
  const avgScore = computeWeightedHomeworkAvg(
    graded
      .filter((p) => p.score !== null)
      .map((p) => ({ score: p.score as number, maxScore: p.maxScore })),
  );
  const stage1 = student.stage1_score;
  const stage2 = student.stage2_score;
  const selectionTotal = stage1 !== null || stage2 !== null
    ? (stage1 ?? 0) + (stage2 ?? 0)
    : null;
  const earnedKeys = collectEarnedKeys(achievements, student.id);

  return {
    userId: student.id,
    displayName: student.display_name,
    avatarUrl: student.avatar_url?.trim() || null,
    email: student.email,
    groupId,
    groupName,
    grade: student.grade?.trim() || null,
    gradeLabel: student.grade?.trim() || 'Класс не указан',
    gradedCount: graded.length,
    submittedCount: submitted.length,
    pendingCount: submitted.length,
    draftCount: drafts.length,
    totalPublished: publishedPages.length,
    avgScore,
    achievementCount: earnedKeys.length,
    totalAchievementsPossible: TOTAL_ACHIEVEMENTS_POSSIBLE,
    earnedAchievementKeys: earnedKeys,
    progressPercent: computeProgressPercent(homeworkPages),
    stage1Score: stage1,
    stage2Score: stage2,
    selectionTotal,
    overdueMissing: countOverdueMissing(homeworkPages),
    homeworkPages,
    modules: modules.filter((m) => m.user_id === student.id).sort((a, b) => a.module_index - b.module_index),
  };
}

export function rankMetricValue(snapshot: StudentProgressSnapshot, metric: RankMetric): number {
  switch (metric) {
    case 'avg_score':
      return snapshot.avgScore ?? -1;
    case 'graded_count':
      return snapshot.gradedCount;
    case 'progress_percent':
      return snapshot.progressPercent;
    case 'achievements':
      return snapshot.achievementCount;
    case 'selection_total':
      return snapshot.selectionTotal ?? -1;
    default:
      return 0;
  }
}

export function formatRankMetricValue(snapshot: StudentProgressSnapshot, metric: RankMetric) {
  switch (metric) {
    case 'avg_score':
      return snapshot.avgScore !== null
        ? `${formatHomeworkScoreValue(snapshot.avgScore)}/10`
        : '—';
    case 'graded_count':
      return `${snapshot.gradedCount}/${snapshot.totalPublished}`;
    case 'progress_percent':
      return `${snapshot.progressPercent}%`;
    case 'achievements':
      return formatAchievementsProgress(snapshot.achievementCount);
    case 'selection_total':
      return snapshot.selectionTotal !== null ? String(snapshot.selectionTotal) : '—';
    default:
      return '—';
  }
}

export function rankStudents(snapshots: StudentProgressSnapshot[], metric: RankMetric) {
  return [...snapshots].sort((a, b) => {
    const diff = rankMetricValue(b, metric) - rankMetricValue(a, metric);
    if (diff !== 0) return diff;
    return a.displayName.localeCompare(b.displayName, 'ru');
  });
}

export function sortGradeLabels(labels: string[]) {
  const unknown = 'Класс не указан';
  return [...labels].sort((a, b) => {
    if (a === unknown) return 1;
    if (b === unknown) return -1;
    const na = parseInt(a.replace(/\D/g, ''), 10);
    const nb = parseInt(b.replace(/\D/g, ''), 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b, 'ru');
  });
}

export function filterSnapshots(
  snapshots: StudentProgressSnapshot[],
  groupId: string,
  gradeLabel: string,
) {
  return snapshots.filter((s) => {
    if (groupId !== 'all') {
      if (groupId === 'none') {
        if (s.groupId) return false;
      } else if (s.groupId !== groupId) {
        return false;
      }
    }
    if (gradeLabel !== 'all' && s.gradeLabel !== gradeLabel) return false;
    return true;
  });
}

export function aggregateSnapshots(snapshots: StudentProgressSnapshot[]) {
  const withAvg = snapshots.filter((s) => s.avgScore !== null);
  return {
    students: snapshots.length,
    avgProgress: snapshots.length
      ? Math.round(snapshots.reduce((a, s) => a + s.progressPercent, 0) / snapshots.length)
      : 0,
    avgScore: withAvg.length
      ? Math.round((withAvg.reduce((a, s) => a + (s.avgScore ?? 0), 0) / withAvg.length) * 10) / 10
      : null,
    pending: snapshots.reduce((a, s) => a + s.pendingCount, 0),
    avgAchievements: snapshots.length
      ? Math.round((snapshots.reduce((a, s) => a + s.achievementCount, 0) / snapshots.length) * 10) / 10
      : 0,
  };
}

export type GradeBreakdown = {
  gradeLabel: string;
  count: number;
  avgProgress: number;
  avgScore: number | null;
};

export function breakdownByGrade(snapshots: StudentProgressSnapshot[]): GradeBreakdown[] {
  const map = new Map<string, StudentProgressSnapshot[]>();
  for (const s of snapshots) {
    if (!map.has(s.gradeLabel)) map.set(s.gradeLabel, []);
    map.get(s.gradeLabel)!.push(s);
  }
  return [...map.entries()]
    .map(([gradeLabel, items]) => {
      const withAvg = items.filter((i) => i.avgScore !== null);
      return {
        gradeLabel,
        count: items.length,
        avgProgress: groupAverageProgress(items),
        avgScore: withAvg.length
          ? Math.round((withAvg.reduce((a, i) => a + (i.avgScore ?? 0), 0) / withAvg.length) * 10) / 10
          : null,
      };
    })
    .sort((a, b) => a.gradeLabel.localeCompare(b.gradeLabel, 'ru'));
}

export type GroupBreakdown = {
  groupId: string;
  groupName: string;
  count: number;
  avgProgress: number;
  avgScore: number | null;
};

export function breakdownByGroup(snapshots: StudentProgressSnapshot[]): GroupBreakdown[] {
  const map = new Map<string, StudentProgressSnapshot[]>();
  for (const s of snapshots) {
    const key = s.groupId ?? 'none';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()]
    .map(([groupId, items]) => {
      const withAvg = items.filter((i) => i.avgScore !== null);
      return {
        groupId,
        groupName: items[0]?.groupName ?? 'Без группы',
        count: items.length,
        avgProgress: groupAverageProgress(items),
        avgScore: withAvg.length
          ? Math.round((withAvg.reduce((a, i) => a + (i.avgScore ?? 0), 0) / withAvg.length) * 10) / 10
          : null,
      };
    })
    .sort((a, b) => a.groupName.localeCompare(b.groupName, 'ru'));
}

export function isStudentLagging(snapshot: StudentProgressSnapshot, groupAvgProgress?: number) {
  if (snapshot.pendingCount > 0 && snapshot.overdueMissing > 0) return true;
  if (snapshot.overdueMissing >= 2) return true;
  if (groupAvgProgress !== undefined && snapshot.progressPercent + 15 < groupAvgProgress) return true;
  if (snapshot.totalPublished > 0 && snapshot.gradedCount === 0 && snapshot.submittedCount === 0) {
    return snapshot.overdueMissing > 0;
  }
  return false;
}

export function groupAverageProgress(snapshots: StudentProgressSnapshot[]) {
  if (snapshots.length === 0) return 0;
  return Math.round(snapshots.reduce((s, x) => s + x.progressPercent, 0) / snapshots.length);
}

export const HOMEWORK_STATUS_LABELS: Record<HomeworkPageProgress['status'], string> = {
  none: 'Не начато',
  draft: 'Черновик',
  submitted: 'Сдано',
  graded: 'Оценено',
};

export const HOMEWORK_STATUS_COLORS: Record<HomeworkPageProgress['status'], string> = {
  none: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
  draft: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  submitted: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  graded: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
};
