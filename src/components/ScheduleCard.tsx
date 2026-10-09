import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ScheduleEventType } from '../lib/types';
import { formatDayHeading } from '../lib/scheduleUtils';
import { EVENT_TONES } from '../lib/scheduleTones';
import LessonCoverImage from './LessonCoverImage';
import { useTimeView } from '../lib/timeView';

/**
 * Карточка расписания — вид занятия, а не отдельная вещь: обложка и статус
 * берутся со страницы лекции или семинара, клик ведёт на неё же. Общая для
 * кабинета ученика и преподавателя; различаются только плашки и действия.
 */

export function ScheduleChip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] leading-none px-2 py-1 rounded-md border whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

/** «Идёт сейчас» с пульсирующей точкой (без анимации при reduced motion). */
export function LiveChip() {
  return (
    <ScheduleChip className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      Идёт сейчас
    </ScheduleChip>
  );
}

/** Обложка страницы занятия; без неё — плитка цвета типа события. */
export function ScheduleCardMedia({
  type,
  coverUrl,
  past = false,
  className = 'w-20 sm:w-36',
}: {
  type: ScheduleEventType;
  coverUrl?: string | null;
  past?: boolean;
  className?: string;
}) {
  const url = coverUrl?.trim() ?? '';
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const tone = EVENT_TONES[type];
  const Icon = tone.icon;

  return (
    <div className={`relative shrink-0 self-stretch overflow-hidden ${past ? 'opacity-55 saturate-50' : ''} ${className}`}>
      {url && !failed ? (
        <LessonCoverImage
          url={url}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${tone.tile}`}>
          <Icon className="h-7 w-7 text-white/40" aria-hidden />
        </div>
      )}
    </div>
  );
}

export function ScheduleCard({
  type,
  coverUrl,
  chips,
  title,
  meta,
  description,
  footer,
  actions,
  onOpen,
  openLabel,
  past = false,
}: {
  type: ScheduleEventType;
  coverUrl?: string | null;
  chips?: ReactNode;
  title: string;
  meta?: ReactNode;
  description?: string;
  footer?: ReactNode;
  /** Кнопки в правом верхнем углу (удалить, изменить). */
  actions?: ReactNode;
  /** Клик по карточке — открыть страницу занятия или задания. */
  onOpen?: () => void;
  /** Что откроется — для экранного диктора: «открыть страницу лекции». */
  openLabel?: string;
  past?: boolean;
}) {
  return (
    <article
      className={`group relative flex min-h-[6.5rem] overflow-hidden rounded-2xl border transition-colors ${
        past ? 'border-white/[0.04] bg-slate-950/40' : 'border-white/5 bg-slate-900/60'
      } ${onOpen ? 'hover:border-blue-500/30 hover:bg-slate-900/80' : ''}`}
    >
      <ScheduleCardMedia type={type} coverUrl={coverUrl} past={past} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 sm:p-5">
        {(chips || actions) && (
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{chips}</div>
            {actions && (
              <div className="relative z-10 -mr-1.5 -mt-1.5 flex shrink-0 items-center gap-1">{actions}</div>
            )}
          </div>
        )}
        <h3
          className={`line-clamp-2 break-words font-semibold leading-snug transition-colors ${
            past ? 'text-slate-300' : 'text-white'
          } ${onOpen ? 'group-hover:text-blue-200' : ''}`}
        >
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              aria-label={openLabel ? `${title} — ${openLabel}` : undefined}
              className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-blue-500/60"
            >
              {title}
            </button>
          ) : (
            title
          )}
        </h3>
        {meta}
        {description && (
          <p className={`line-clamp-2 text-sm leading-relaxed ${past ? 'text-slate-500' : 'text-slate-400'}`}>
            {description}
          </p>
        )}
        {footer && <div className="relative z-10 flex flex-wrap items-center gap-2 pt-1.5">{footer}</div>}
      </div>
      {onOpen && (
        <ChevronRight
          aria-hidden
          className="mr-3 hidden h-5 w-5 shrink-0 self-center text-slate-600 transition-colors group-hover:text-slate-300 sm:block"
        />
      )}
    </article>
  );
}

/** Строка «время · длительность» под названием. */
export function ScheduleMeta({ children, past = false }: { children: ReactNode; past?: boolean }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums ${past ? 'text-slate-500' : 'text-slate-400'}`}>
      {children}
    </p>
  );
}

/** Заголовок дня: «Сегодня · четверг, 9 октября». */
export function ScheduleDayHeading({ iso, past = false }: { iso: string; past?: boolean }) {
  const timeView = useTimeView();
  const { relative, label } = formatDayHeading(iso, timeView);
  return (
    <h3 className={`mb-3 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold ${past ? 'text-slate-500' : 'text-slate-400'}`}>
      {relative ? (
        <>
          <span className={past ? 'text-slate-300' : 'text-white'}>{relative}</span>
          <span aria-hidden>·</span>
          <span>{label}</span>
        </>
      ) : (
        <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
      )}
    </h3>
  );
}

export function SchedulePastDivider() {
  return (
    <div className="flex items-center gap-4 py-1" role="separator" aria-label="Прошедшие">
      <div className="h-px flex-1 bg-white/10" />
      <span className="whitespace-nowrap text-xs uppercase tracking-wider text-slate-500">Прошедшие</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
