import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LessonPage, LessonPageBlock, LessonPageType } from '../lib/types';
import { lessonPageLoadError } from '../lib/lessonPageLoadError';
import {
  LESSON_LIST_SELECT,
  splitLessonsByTime,
  type LessonPageWithEvent,
} from '../lib/lessonPageUtils';
import { isEventActive } from '../lib/scheduleUtils';
import LessonPageBlocks from './LessonPageBlocks';
import LessonPageCard from './LessonPageCard';
import LessonEventHeader, { type LessonEventInfo } from './LessonEventHeader';
import { SchedulePastDivider } from './ScheduleCard';

export function StudentLessonList({
  lessonType,
  onOpen,
}: {
  lessonType: LessonPageType;
  onOpen: (pageId: string) => void;
}) {
  const [pages, setPages] = useState<LessonPageWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    supabase
      .from('lesson_pages')
      .select(LESSON_LIST_SELECT)
      .eq('lesson_type', lessonType)
      .eq('is_published', true)
      .order('lesson_date', { ascending: false })
      .then(({ data, error }) => {
        if (error) setLoadError(lessonPageLoadError(error.message));
        else setPages((data ?? []) as LessonPageWithEvent[]);
        setLoading(false);
      });
  }, [lessonType]);

  const { upcoming, past } = useMemo(() => splitLessonsByTime(pages), [pages]);

  if (loading) {
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

  if (pages.length === 0) {
    return (
      <p className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
        {lessonType === 'lecture' ? 'Лекций' : 'Семинаров'} пока нет
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {upcoming.map(({ page, event }) => (
        <LessonPageCard key={page.id} page={page} event={event} onClick={() => onOpen(page.id)} />
      ))}
      {upcoming.length > 0 && past.length > 0 && (
        <div className="pt-3 pb-1">
          <SchedulePastDivider />
        </div>
      )}
      {past.map(({ page, event }) => (
        <LessonPageCard key={page.id} page={page} event={event} onClick={() => onOpen(page.id)} past />
      ))}
    </div>
  );
}

export function StudentLessonPageView({
  pageId,
  onBack,
  backLabel = 'Назад',
  onOpenHomework,
}: {
  pageId: string;
  onBack: () => void;
  backLabel?: string;
  onOpenHomework?: (pageId: string) => void;
}) {
  const [page, setPage] = useState<LessonPage | null>(null);
  const [blocks, setBlocks] = useState<LessonPageBlock[]>([]);
  const [event, setEvent] = useState<LessonEventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      supabase.from('lesson_pages').select('*').eq('id', pageId).single(),
      supabase.from('lesson_page_blocks').select('*').eq('page_id', pageId),
      supabase
        .from('schedule_events')
        .select('scheduled_at, duration_minutes, meeting_url, description')
        .eq('lesson_page_id', pageId)
        .maybeSingle(),
    ]).then(([pageRes, blocksRes, eventRes]) => {
      if (pageRes.error) {
        setLoadError(lessonPageLoadError(pageRes.error.message));
        setPage(null);
        setBlocks([]);
        setEvent(null);
      } else {
        setPage((pageRes.data ?? null) as LessonPage | null);
        setBlocks((blocksRes.data ?? []) as LessonPageBlock[]);
        setEvent((eventRes.data ?? null) as LessonEventInfo | null);
      }
      setLoading(false);
    });
  }, [pageId]);

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {backLabel}
    </button>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (loadError || !page) {
    return (
      <div className="max-w-3xl space-y-4">
        {backButton}
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          {loadError ?? 'Страница не найдена или недоступна'}
        </p>
      </div>
    );
  }

  const beforeEnd = event ? isEventActive(event.scheduled_at, event.duration_minutes) : false;

  return (
    <div className="max-w-3xl space-y-6">
      {backButton}
      <LessonEventHeader
        title={page.title}
        lessonType={page.lesson_type}
        coverUrl={page.cover_url}
        lessonDate={page.lesson_date}
        event={event}
      />
      <LessonPageBlocks
        blocks={blocks}
        onOpenHomework={onOpenHomework}
        emptyState={beforeEnd
          ? {
            title: 'Запись и конспект появятся после занятия',
            text: 'Преподаватель добавит их на эту страницу — загляните сюда, когда занятие закончится.',
          }
          : undefined}
      />
    </div>
  );
}
