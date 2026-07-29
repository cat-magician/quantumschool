import { supabase } from './supabase';
import type { AdminDashboardState, StudentDashboardState } from './dashboardNavigation';
import {
  groupsForTeacher,
  loadGroupTeachers,
  pageSubmissionVisibleToStaff,
  studentGroupMap,
} from './groupUtils';
import { homeworkDueUrgency } from './homeworkPageUtils';
import {
  DEFAULT_HOMEWORK_MAX_SCORE,
  formatHomeworkScoreShort,
} from './homeworkUtils';
import { studentStagePhase } from './selectionDisplayUtils';
import { isNotificationRead } from './notificationReadState';
import type { Group, HomeworkPage, HomeworkPageSubmission, LessonPageType, UserProfile } from './types';

export type NotificationAction =
  | { audience: 'student'; state: StudentDashboardState }
  | { audience: 'admin'; state: AdminDashboardState };

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  action?: NotificationAction;
};

const RECENT_DAYS = 14;
const NOTIFICATION_LIMIT = 20;

function isRecent(iso: string, days = RECENT_DAYS) {
  return Date.now() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}

function sortByDate(items: AppNotification[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function lessonPublishedTitle(lessonType: LessonPageType) {
  return lessonType === 'lecture' ? 'Новая лекция' : 'Новый семинар';
}

function appendSelectionStageNotifications(
  items: AppNotification[],
  profile: Pick<
    UserProfile,
    | 'stage1_status'
    | 'stage1_score'
    | 'stage1_submitted_at'
    | 'stage2_status'
    | 'stage2_score'
    | 'stage2_submitted_at'
    | 'updated_at'
  >,
) {
  const s1 = studentStagePhase(profile.stage1_status, profile.stage1_score, profile.stage1_submitted_at);
  const s2 = studentStagePhase(profile.stage2_status, profile.stage2_score, profile.stage2_submitted_at);

  if (s1 === 'graded' && profile.stage1_score != null) {
    items.push({
      id: 'stage1-grade',
      title: 'Эссе проверено',
      body: `Оценка этапа 1: ${profile.stage1_score} из 10`,
      createdAt: profile.updated_at,
      action: { audience: 'student', state: { tab: 'selection', selectionSubTab: 'results' } },
    });
  } else if (s1 === 'awaiting_grade') {
    items.push({
      id: 'stage1-wait',
      title: 'Эссе на проверке',
      body: 'Преподаватель проверяет ваше эссе',
      createdAt: profile.stage1_submitted_at ?? profile.updated_at,
      action: { audience: 'student', state: { tab: 'selection', selectionSubTab: 'stage1' } },
    });
  }

  if (s2 === 'graded' && profile.stage2_score != null) {
    items.push({
      id: 'stage2-grade',
      title: 'Контест проверен',
      body: `Оценка этапа 2: ${profile.stage2_score} из 10`,
      createdAt: profile.updated_at,
      action: { audience: 'student', state: { tab: 'selection', selectionSubTab: 'results' } },
    });
  } else if (s2 === 'awaiting_grade') {
    items.push({
      id: 'stage2-wait',
      title: 'Контест на проверке',
      body: 'Ожидайте оценку за этап 2',
      createdAt: profile.stage2_submitted_at ?? profile.updated_at,
      action: { audience: 'student', state: { tab: 'selection', selectionSubTab: 'stage2' } },
    });
  }
}

async function loadStudentNotifications(
  userId: string,
  profile: UserProfile,
): Promise<AppNotification[]> {
  const items: AppNotification[] = [];

  const subsPromise = supabase
    .from('homework_page_submissions')
    .select('*, page:homework_pages(id, title, due_at, max_score)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  const pagesPromise = profile.is_enrolled
    ? supabase
        .from('homework_pages')
        .select('id, title, due_at, updated_at')
        .eq('is_published', true)
    : Promise.resolve({ data: [] as Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'updated_at'>[] });

  const lessonsPromise = profile.is_enrolled
    ? supabase
        .from('lesson_pages')
        .select('id, title, lesson_type, updated_at')
        .eq('is_published', true)
    : Promise.resolve({ data: [] as { id: string; title: string; lesson_type: LessonPageType; updated_at: string }[] });

  const [subsRes, pagesRes, lessonsRes] = await Promise.all([subsPromise, pagesPromise, lessonsPromise]);

  const subs = (subsRes.data ?? []) as (HomeworkPageSubmission & {
    page?: { id: string; title: string; due_at: string | null };
  })[];
  const pages = (pagesRes.data ?? []) as Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'updated_at'>[];
  const lessons = (lessonsRes.data ?? []) as {
    id: string;
    title: string;
    lesson_type: LessonPageType;
    updated_at: string;
  }[];
  const submittedPageIds = new Set(subs.filter((s) => s.status !== 'draft').map((s) => s.page_id));

  for (const s of subs) {
    if (s.status === 'graded' && s.graded_at && isRecent(s.graded_at)) {
      items.push({
        id: `hw-grade-${s.id}`,
        title: `Оценка за «${s.page?.title ?? 'ДЗ'}»`,
        body: s.score != null
          ? `Получена оценка: ${formatHomeworkScoreShort(s.score, s.page?.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE)}`
          : 'Работа проверена',
        createdAt: s.graded_at,
        action: {
          audience: 'student',
          state: {
            tab: 'learning',
            learningSubTab: 'homework',
            contentPageId: s.page_id,
          },
        },
      });
    }
  }

  if (profile.is_enrolled) {
    for (const page of pages) {
      if (isRecent(page.updated_at)) {
        items.push({
          id: `hw-pub-${page.id}`,
          title: 'Новое домашнее задание',
          body: page.title,
          createdAt: page.updated_at,
          action: {
            audience: 'student',
            state: { tab: 'learning', learningSubTab: 'homework', contentPageId: page.id },
          },
        });
      }
    }

    for (const lesson of lessons) {
      if (isRecent(lesson.updated_at)) {
        items.push({
          id: `lesson-pub-${lesson.id}`,
          title: lessonPublishedTitle(lesson.lesson_type),
          body: lesson.title,
          createdAt: lesson.updated_at,
          action: {
            audience: 'student',
            state: {
              tab: 'learning',
              learningSubTab: lesson.lesson_type === 'lecture' ? 'lectures' : 'seminars',
              contentPageId: lesson.id,
            },
          },
        });
      }
    }

    for (const page of pages) {
      if (submittedPageIds.has(page.id)) continue;
      const urgency = homeworkDueUrgency(page.due_at);
      if (urgency === 'overdue' || urgency === 'burning') {
        items.push({
          id: `hw-due-${page.id}`,
          title: urgency === 'overdue' ? 'Просрочено задание' : 'Скоро срок сдачи',
          body: page.title,
          createdAt: page.due_at ?? new Date().toISOString(),
          action: {
            audience: 'student',
            state: { tab: 'learning', learningSubTab: 'homework', contentPageId: page.id },
          },
        });
      }
    }
  } else {
    appendSelectionStageNotifications(items, profile);
  }

  if (profile.is_enrolled && !isNotificationRead(userId, 'selection-enrolled')) {
    items.push({
      id: 'selection-enrolled',
      title: 'Вы зачислены на обучение',
      body: 'Разделы «Обучение», «Расписание» и «Прогресс» открыты',
      createdAt: profile.updated_at,
      action: { audience: 'student', state: { tab: 'selection', selectionSubTab: 'results' } },
    });
  } else if ((profile.selection_rejected ?? false) && !isNotificationRead(userId, 'selection-rejected')) {
    items.push({
      id: 'selection-rejected',
      title: 'Решение по отбору',
      body: 'Итоги отбора — в разделе «Результаты»',
      createdAt: profile.updated_at,
      action: { audience: 'student', state: { tab: 'selection', selectionSubTab: 'results' } },
    });
  }

  return sortByDate(items).slice(0, NOTIFICATION_LIMIT);
}

async function loadStaffNotifications(
  userId: string,
  isSuperAdmin: boolean,
): Promise<AppNotification[]> {
  const items: AppNotification[] = [];

  const [applicantsRes, subsRes, groupsRes, membersRes, gtRows, eventsRes, selectionRes] =
    await Promise.all([
      isSuperAdmin
        ? supabase
            .from('user_profiles')
            .select('id, display_name, created_at')
            .eq('teacher_application', true)
            .eq('role', 'student')
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
      supabase
        .from('homework_page_submissions')
        .select('*, page:homework_pages(title)')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(20),
      supabase.from('groups').select('*').eq('group_type', 'teacher'),
      supabase.from('group_members').select('*'),
      loadGroupTeachers(supabase),
      supabase
        .from('schedule_events')
        .select('*')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(3),
      supabase
        .from('user_profiles')
        .select(
          'id, display_name, stage1_status, stage1_score, stage1_submitted_at, stage2_status, stage2_score, stage2_submitted_at',
        )
        .eq('role', 'student')
        .eq('is_enrolled', false),
    ]);

  if (isSuperAdmin) {
    for (const a of applicantsRes.data ?? []) {
      items.push({
        id: `teacher-app-${a.id}`,
        title: 'Заявка преподавателя',
        body: a.display_name ?? 'Новый кандидат',
        createdAt: a.created_at,
        action: { audience: 'admin', state: { tab: 'teachers' } },
      });
    }
  }

  const groups = (groupsRes.data ?? []) as Group[];
  const teacherGroups = isSuperAdmin
    ? groups
    : groupsForTeacher(groups, gtRows, userId);
  const teacherGroupIds = new Set(teacherGroups.map((g) => g.id));
  const studentGroups = studentGroupMap(membersRes.data ?? []);

  for (const s of (subsRes.data ?? []) as (HomeworkPageSubmission & { page?: { title: string } })[]) {
    if (!pageSubmissionVisibleToStaff(s, studentGroups, teacherGroupIds, isSuperAdmin)) continue;
    items.push({
      id: `grade-${s.id}`,
      title: 'Работа на проверке',
      body: s.page?.title ?? 'Домашнее задание',
      createdAt: s.submitted_at ?? s.updated_at,
      action: { audience: 'admin', state: { tab: 'grading' } },
    });
  }

  for (const student of selectionRes.data ?? []) {
    const s1 = studentStagePhase(
      student.stage1_status,
      student.stage1_score,
      student.stage1_submitted_at,
    );
    if (s1 === 'awaiting_grade' && student.stage1_submitted_at) {
      items.push({
        id: `sel-stage1-${student.id}`,
        title: 'Эссе на проверке',
        body: student.display_name ?? 'Участник отбора',
        createdAt: student.stage1_submitted_at,
        action: { audience: 'admin', state: { tab: 'results', selectionSubTab: 'results' } },
      });
    }

    const s2 = studentStagePhase(
      student.stage2_status,
      student.stage2_score,
      student.stage2_submitted_at,
    );
    if (s2 === 'awaiting_grade' && student.stage2_submitted_at) {
      items.push({
        id: `sel-stage2-${student.id}`,
        title: 'Контест на проверке',
        body: student.display_name ?? 'Участник отбора',
        createdAt: student.stage2_submitted_at,
        action: { audience: 'admin', state: { tab: 'results', selectionSubTab: 'results' } },
      });
    }
  }

  for (const e of eventsRes.data ?? []) {
    if (!isSuperAdmin && e.created_by !== userId) continue;
    items.push({
      id: `event-${e.id}`,
      title: 'Ближайшее занятие',
      body: e.title,
      createdAt: e.scheduled_at,
      action: { audience: 'admin', state: { tab: 'schedule' } },
    });
  }

  return sortByDate(items).slice(0, NOTIFICATION_LIMIT);
}

export async function loadNotificationsForProfile(
  profile: UserProfile,
  userId: string,
): Promise<AppNotification[]> {
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return loadStaffNotifications(userId, profile.role === 'superadmin');
  }
  return loadStudentNotifications(userId, profile);
}
