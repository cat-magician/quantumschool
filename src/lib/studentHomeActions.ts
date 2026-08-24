import { buildHomeworkPageProgress, type HomeworkPageProgress } from './progressUtils';
import { selectionVerdict, studentStagePhase } from './selectionDisplayUtils';
import { isEventActive, sortScheduleEventsAscending } from './scheduleUtils';
import type { HomeworkPage, HomeworkPageSubmission, ScheduleEvent, UserProfile } from './types';

export type SelectionSubTab = 'stage1' | 'stage2' | 'results';

export type SelectionChecklistItem = {
  id: 'questionnaire' | 'essay' | 'contest' | 'decision';
  label: string;
  status: 'done' | 'current' | 'todo' | 'waiting';
  detail?: string;
};

export type StudentNextAction = {
  label: string;
  description: string;
  tab: 'selection' | 'learning' | 'schedule' | 'progress';
  selectionSub?: SelectionSubTab;
  learningSub?: 'homework' | 'lectures' | 'seminars';
  homeworkPageId?: string;
  emphasis?: 'primary' | 'secondary';
};

function essayDone(profile: UserProfile) {
  return studentStagePhase(profile.stage1_status, profile.stage1_score, profile.stage1_submitted_at) !== 'pending';
}

function contestDone(profile: UserProfile) {
  return studentStagePhase(profile.stage2_status, profile.stage2_score, profile.stage2_submitted_at) !== 'pending';
}

/** Сколько шагов отбора ещё не сданы (для бейджа в меню). */
export function countSelectionPendingSteps(profile: UserProfile): number {
  if (profile.is_enrolled || (profile.selection_rejected ?? false)) return 0;
  let n = 0;
  if (!profile.questionnaire_submitted_at) n += 1;
  if (!essayDone(profile)) n += 1;
  if (!contestDone(profile)) n += 1;
  return n;
}

export function buildSelectionChecklist(profile: UserProfile): SelectionChecklistItem[] {
  const questionnaireDone = !!profile.questionnaire_submitted_at;
  const essayComplete = essayDone(profile);
  const contestComplete = contestDone(profile);
  const verdict = selectionVerdict(profile.is_enrolled, profile.selection_rejected ?? false);

  let current: SelectionChecklistItem['id'] | null = null;
  if (!questionnaireDone) current = 'questionnaire';
  else if (!essayComplete) current = 'essay';
  else if (!contestComplete) current = 'contest';
  else if (verdict === 'waiting') current = 'decision';

  const stepStatus = (id: SelectionChecklistItem['id'], done: boolean): SelectionChecklistItem['status'] => {
    if (done) return 'done';
    if (current === id) return id === 'decision' ? 'waiting' : 'current';
    return 'todo';
  };

  return [
    {
      id: 'questionnaire',
      label: 'Анкета',
      status: stepStatus('questionnaire', questionnaireDone),
      detail: questionnaireDone ? 'Подтверждена' : 'Форма → кнопка «Я отправил анкету»',
    },
    {
      id: 'essay',
      label: 'Эссе',
      status: stepStatus('essay', essayComplete),
      detail: essayComplete
        ? profile.stage1_score !== null
          ? 'Проверено'
          : 'На проверке'
        : 'Форма → кнопка «Я отправил эссе»',
    },
    {
      id: 'contest',
      label: 'Задачи',
      status: stepStatus('contest', contestComplete),
      detail: contestComplete
        ? profile.stage2_score !== null
          ? 'Проверено'
          : 'На проверке'
        : 'Контест → кнопка «Я завершил контест»',
    },
    {
      id: 'decision',
      label: 'Решение',
      status:
        verdict === 'accepted' || verdict === 'rejected'
          ? 'done'
          : stepStatus('decision', false),
      detail:
        verdict === 'accepted'
          ? 'Зачислены на обучение'
          : verdict === 'rejected'
            ? 'Не зачислены'
            : questionnaireDone && essayComplete && contestComplete
              ? 'Ожидайте проверки и зачисления'
              : 'Появится после сдачи этапов',
    },
  ];
}

export function nextSelectionAction(profile: UserProfile): StudentNextAction | null {
  const verdict = selectionVerdict(profile.is_enrolled, profile.selection_rejected ?? false);
  if (verdict === 'accepted') return null;
  if (verdict === 'rejected') {
    return {
      label: 'Посмотреть результаты',
      description: 'Решение по зачислению уже принято',
      tab: 'selection',
      selectionSub: 'results',
      emphasis: 'secondary',
    };
  }

  if (!profile.questionnaire_submitted_at || !essayDone(profile)) {
    return {
      label: !profile.questionnaire_submitted_at ? 'Заполнить анкету' : 'Отправить эссе',
      description: !profile.questionnaire_submitted_at
        ? 'Этап 1 — анкета и мотивационное эссе'
        : 'После формы нажмите «Я отправил эссе»',
      tab: 'selection',
      selectionSub: 'stage1',
      emphasis: 'primary',
    };
  }

  if (!contestDone(profile)) {
    return {
      label: 'Перейти к задачам',
      description: 'Этап 2 — контест на сайте, затем подтвердите завершение',
      tab: 'selection',
      selectionSub: 'stage2',
      emphasis: 'primary',
    };
  }

  return {
    label: 'Смотреть результаты',
    description: 'Этапы сданы — здесь появятся оценки и решение о зачислении',
    tab: 'selection',
    selectionSub: 'results',
    emphasis: 'secondary',
  };
}

export function pickUrgentHomework(pages: HomeworkPageProgress[]): HomeworkPageProgress | null {
  const open = pages.filter((p) => p.status === 'none' || p.status === 'draft');
  if (open.length === 0) return null;

  const withDue = open.filter((p) => p.dueAt);
  const sorted = [...(withDue.length > 0 ? withDue : open)].sort((a, b) => {
    const ta = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  return sorted[0] ?? null;
}

export function homeworkDueLabel(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Просрочено ${Math.abs(diffDays)} дн.`;
  if (diffDays === 0) return 'Срок сегодня';
  if (diffDays === 1) return 'Срок завтра';
  return `Срок через ${diffDays} дн.`;
}

export function nextScheduleEvent(events: ScheduleEvent[]): ScheduleEvent | null {
  const upcoming = sortScheduleEventsAscending(events).filter((e) =>
    isEventActive(e.scheduled_at, e.duration_minutes ?? 0),
  );
  return upcoming[0] ?? null;
}

export function nextEnrolledAction(
  homework: HomeworkPageProgress[],
  nextEvent: ScheduleEvent | null,
): StudentNextAction {
  const urgent = pickUrgentHomework(homework);
  if (urgent) {
    const due = homeworkDueLabel(urgent.dueAt);
    return {
      label: urgent.status === 'draft' ? 'Доработать домашку' : 'Сдать домашку',
      description: `${urgent.title}${due ? ` · ${due}` : ''}`,
      tab: 'learning',
      learningSub: 'homework',
      homeworkPageId: urgent.pageId,
      emphasis: due?.includes('Просрочено') || due === 'Срок сегодня' ? 'primary' : 'primary',
    };
  }

  if (nextEvent?.meeting_url) {
    const starts = new Date(nextEvent.scheduled_at).getTime();
    const hoursUntil = (starts - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil <= 48) {
      return {
        label: 'Открыть расписание',
        description: `${nextEvent.title} — подключение по ссылке в расписании`,
        tab: 'schedule',
        emphasis: 'primary',
      };
    }
  }

  return {
    label: 'Перейти к обучению',
    description: 'Лекции, семинары и домашние задания',
    tab: 'learning',
    learningSub: 'lectures',
    emphasis: 'primary',
  };
}

export function buildEnrolledHomeworkProgress(
  userId: string,
  publishedPages: Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'max_score'>[],
  submissions: HomeworkPageSubmission[],
) {
  return buildHomeworkPageProgress(publishedPages, submissions, userId);
}
