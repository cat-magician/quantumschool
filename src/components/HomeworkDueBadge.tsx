import { homeworkDueUrgency } from '../lib/homeworkPageUtils';
import type { HomeworkPageSubmission } from '../lib/types';

type Props = {
  dueAt: string | null | undefined;
  submission?: Pick<HomeworkPageSubmission, 'status' | 'score'> | null;
};

export default function HomeworkDueBadge({ dueAt, submission }: Props) {
  if (submission?.status === 'graded' || submission?.score !== null) {
    return null;
  }

  const urgency = homeworkDueUrgency(dueAt);
  if (urgency === 'burning') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-md border shrink-0 font-semibold text-amber-200 bg-amber-500/15 border-amber-500/35">
        горит!
      </span>
    );
  }
  if (urgency === 'overdue') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-md border shrink-0 font-medium text-rose-300 bg-rose-500/15 border-rose-500/30">
        Дедлайн прошёл
      </span>
    );
  }
  return null;
}
