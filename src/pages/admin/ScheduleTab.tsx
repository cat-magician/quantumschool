import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Calendar, Clock, FileText, Loader2, Pencil, Plus, Trash2, X,
} from 'lucide-react';
import { normalizeMeetingUrl } from '../../lib/meetingLinkUtils';
import MeetingLinkButton from '../../components/MeetingLinkButton';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';
import MonthCalendar from '../../components/MonthCalendar';
import GroupMultiSelect from '../../components/GroupMultiSelect';
import {
  FormDatetime,
  FormLabel,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
} from '../../components/FormControls';
import { supabase } from '../../lib/supabase';
import { useAppDialog } from '../../lib/AppDialogContext';
import type {
  CalendarEntry, Group, HomeworkPage, ScheduleEvent, ScheduleEventType,
} from '../../lib/types';
import { createDefaultBlocks } from '../../lib/lessonPageUtils';
import { groupTargetLabel, legacyGroupId } from '../../lib/groupTargeting';
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  buildCalendar,
  eventGroupIds,
  eventMatchesScheduleFilter,
  formatDuration,
  formatEventDateTime,
  getScheduleEmptyMessage,
  getScheduleRefHint,
  isEventActive,
  isEventEnded,
  isEventOngoing,
  isLessonEventType,
  sortScheduleEventsAscending,
  sortScheduleEventsDescending,
  sortScheduleEventsForList,
  toDatetimeLocalValue,
  toLocalDateValue,
} from '../../lib/scheduleUtils';

type Filter = 'upcoming' | 'past' | 'all';

/** Куда ведёт карточка расписания: редактор лекции, семинара или ДЗ. */
export type ScheduleContentTarget = { kind: 'lecture' | 'seminar' | 'homework'; pageId: string };

type HomeworkDeadlineRow = Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'is_published' | 'group_ids' | 'updated_at'>;

const EMPTY_FORM = {
  title: '',
  description: '',
  event_type: 'lecture' as ScheduleEventType,
  scheduled_at: '',
  duration_minutes: 60,
  meeting_url: '',
  group_ids: [] as string[],
};

const BADGE = 'text-xs px-2.5 py-1 rounded-lg border';

export default function ScheduleTab({
  onOpenContent,
}: {
  onOpenContent?: (target: ScheduleContentTarget) => void;
}) {
  const { confirm } = useAppDialog();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [homework, setHomework] = useState<HomeworkDeadlineRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [materialsBusyId, setMaterialsBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setInitialLoading(true);
    const [eventsRes, groupsRes, homeworkRes] = await Promise.all([
      supabase
        .from('schedule_events')
        .select('*, lesson_page:lesson_pages(id, lesson_type, is_published, title)')
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('groups')
        .select('*')
        .eq('group_type', 'teacher')
        .order('name'),
      // Дедлайны ДЗ — в расписании сами, черновики тоже: сотрудник видит всё.
      supabase
        .from('homework_pages')
        .select('id, title, due_at, is_published, group_ids, updated_at')
        .not('due_at', 'is', null),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data as ScheduleEvent[]);
    if (groupsRes.data) setGroups(groupsRes.data);
    if (homeworkRes.data) setHomework(homeworkRes.data as HomeworkDeadlineRow[]);
    if (silent) setRefreshing(false);
    else setInitialLoading(false);
  };

  useEffect(() => { load(); }, []);

  const entries = useMemo(() => buildCalendar(events, homework), [events, homework]);

  const filtered = useMemo(() => {
    const list = entries.filter((e) => eventMatchesScheduleFilter(e, filter, selectedDate));
    if (filter === 'upcoming') return sortScheduleEventsAscending(list);
    if (filter === 'past') return sortScheduleEventsDescending(list);
    return sortScheduleEventsForList(list);
  }, [entries, filter, selectedDate]);

  const refHint = useMemo(() => getScheduleRefHint(filter, selectedDate), [filter, selectedDate]);

  const upcomingPreview = useMemo(
    () => sortScheduleEventsAscending(
      entries.filter((e) => isEventActive(e.scheduled_at, e.duration_minutes)),
    ).slice(0, 4),
    [entries],
  );

  const emptyMessage = useMemo(
    () => getScheduleEmptyMessage(filter, selectedDate, 'событий'),
    [filter, selectedDate],
  );

  // Тип «Домашнее задание» новым событиям не предлагаем, но у старого
  // события он должен остаться виден в списке.
  const eventTypeOptions = useMemo(() => {
    const types = EVENT_TYPE_OPTIONS.includes(form.event_type)
      ? EVENT_TYPE_OPTIONS
      : [...EVENT_TYPE_OPTIONS, form.event_type];
    return types.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }));
  }, [form.event_type]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description,
      event_type: event.event_type,
      scheduled_at: toDatetimeLocalValue(event.scheduled_at),
      duration_minutes: event.duration_minutes,
      meeting_url: event.meeting_url,
      group_ids: eventGroupIds(event),
    });
    setError('');
    setShowForm(true);
  };

  const openEntry = (entry: CalendarEntry) => {
    if (entry.homeworkPageId) onOpenContent?.({ kind: 'homework', pageId: entry.homeworkPageId });
    else openEdit(entry);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  useEffect(() => {
    if (!showForm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeForm();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForm]);

  const save = async () => {
    if (!form.title.trim()) {
      setError('Укажите название');
      return;
    }
    if (!form.scheduled_at) {
      setError('Укажите дату и время');
      return;
    }

    setSaving(true);
    setError('');

    // Название, дату и группы связанной страницы материалов база обновит сама.
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      event_type: form.event_type,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      meeting_url: normalizeMeetingUrl(form.meeting_url),
      group_ids: form.group_ids,
      group_id: legacyGroupId(form.group_ids),
      updated_at: new Date().toISOString(),
    };

    const { data: { user } } = await supabase.auth.getUser();

    const result = editingEvent
      ? await supabase.from('schedule_events').update(payload).eq('id', editingEvent.id)
      : await supabase.from('schedule_events').insert({ ...payload, created_by: user?.id ?? null });

    setSaving(false);

    if (result.error) {
      setError('Не удалось сохранить. Применена ли последняя версия schema.sql в Supabase?');
      return;
    }

    closeForm();
    load({ silent: true });
  };

  const remove = async (event: ScheduleEvent) => {
    const ok = await confirm({
      title: 'Удалить событие?',
      message: event.lesson_page_id
        ? 'Событие исчезнет из расписания учеников. Страница с материалами останется во вкладке '
          + `«${event.event_type === 'seminar' ? 'Семинары' : 'Лекции'}».`
        : 'Событие исчезнет из расписания учеников.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(event.id);
    await supabase.from('schedule_events').delete().eq('id', event.id);
    setDeletingId(null);
    load({ silent: true });
  };

  /**
   * Страница материалов для занятия из расписания: черновик с теми же
   * названием, датой и группами, сразу привязанный к событию.
   */
  const createMaterials = async (event: ScheduleEvent) => {
    if (!isLessonEventType(event.event_type)) return;
    setMaterialsBusyId(event.id);
    setListError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: page, error: pageError } = await supabase
      .from('lesson_pages')
      .insert({
        title: event.title,
        lesson_type: event.event_type,
        lesson_date: toLocalDateValue(event.scheduled_at),
        is_published: false,
        group_ids: eventGroupIds(event),
        created_by: user?.id ?? null,
      })
      .select('id')
      .single();

    if (pageError || !page) {
      setMaterialsBusyId(null);
      setListError('Не удалось создать страницу материалов. Попробуйте ещё раз.');
      return;
    }

    const blocks = createDefaultBlocks().map((b) => ({ ...b, page_id: page.id }));
    const [{ error: blocksError }, { error: linkError }] = await Promise.all([
      supabase.from('lesson_page_blocks').insert(blocks),
      supabase.from('schedule_events').update({ lesson_page_id: page.id }).eq('id', event.id),
    ]);
    setMaterialsBusyId(null);

    if (linkError) {
      // Без связи страница осиротела бы во вкладке — убираем её.
      await supabase.from('lesson_pages').delete().eq('id', page.id);
      setListError('Не удалось привязать материалы к событию. Попробуйте ещё раз.');
      return;
    }
    if (blocksError) console.error('Default lesson blocks:', blocksError.message);

    onOpenContent?.({ kind: event.event_type, pageId: page.id });
  };

  const editingLinked = Boolean(editingEvent?.lesson_page_id);

  return (
    <div className={`space-y-6 max-w-6xl relative transition-opacity duration-200 ${refreshing ? 'opacity-80' : ''}`}>
      {refreshing && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-white/10 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Обновление…
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-slate-400 text-sm">
            Календарь для зачисленных учеников: занятия, созвоны и дедлайны домашних заданий.
          </p>
          <SectionHint text={SECTION_HINT.admin.schedule} className="mt-1.5" />
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-700 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Добавить событие
        </button>
      </div>

      {listError && (
        <p className="text-sm text-rose-400 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
          {listError}
        </p>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'Все'],
          ['upcoming', 'Предстоящие'],
          ['past', 'Прошедшие'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === id
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {initialLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{emptyMessage}</p>
          {filter === 'all' && !selectedDate && (
            <button onClick={openCreate} className="mt-4 text-sm text-blue-400 hover:text-blue-300">
              Создать первое занятие
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            entry.homeworkPageId ? (
              <DeadlineCard
                key={entry.id}
                entry={entry}
                groups={groups}
                onOpen={() => onOpenContent?.({ kind: 'homework', pageId: entry.homeworkPageId! })}
              />
            ) : (
              <EventCard
                key={entry.id}
                event={entry}
                groups={groups}
                deleting={deletingId === entry.id}
                materialsBusy={materialsBusyId === entry.id}
                onEdit={() => openEdit(entry)}
                onDelete={() => { void remove(entry); }}
                onOpenMaterials={(pageId, kind) => onOpenContent?.({ kind, pageId })}
                onCreateMaterials={() => { void createMaterials(entry); }}
              />
            )
          ))}
        </div>
      )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <MonthCalendar
            events={entries}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate((prev) =>
                prev && prev.getTime() === d.getTime() ? null : d,
              );
            }}
          />
          {refHint && (
            <p className="text-xs text-slate-500 text-center leading-snug">{refHint}</p>
          )}
          {upcomingPreview.length > 0 && (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Ближайшие</p>
              {upcomingPreview.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => openEntry(e)}
                  className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="text-sm font-medium text-white truncate">
                    {e.homeworkPageId ? `Дедлайн: ${e.title}` : e.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatEventDateTime(e.scheduled_at)}</div>
                </button>
              ))}
            </div>
          )}
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {filter === 'all' ? 'Сбросить фильтр по дате' : 'Вернуться к сегодня'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={closeForm}
          role="presentation"
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-site"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-form-title"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="schedule-form-title" className="text-lg font-bold text-white">
                {editingEvent ? 'Редактировать событие' : 'Новое событие'}
              </h2>
              <button onClick={closeForm} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <FormLabel>Название *</FormLabel>
                <FormText
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Введение в квантовые вычисления"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>Тип</FormLabel>
                  {editingLinked ? (
                    // Тип связанного события задаёт страница материалов.
                    <p className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300">
                      {EVENT_TYPE_LABELS[form.event_type]}
                    </p>
                  ) : (
                    <FormSelect
                      value={form.event_type}
                      onChange={(v) => setForm({ ...form, event_type: v as ScheduleEventType })}
                      options={eventTypeOptions}
                    />
                  )}
                </div>
                <div>
                  <FormLabel>Длительность (мин)</FormLabel>
                  <FormNumber
                    min={1}
                    max={480}
                    value={form.duration_minutes}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n)) {
                        setForm({ ...form, duration_minutes: Math.min(480, Math.max(1, n)) });
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <FormLabel>Дата и время *</FormLabel>
                <FormDatetime
                  value={form.scheduled_at}
                  onChange={(v) => setForm({ ...form, scheduled_at: v })}
                />
              </div>

              <div>
                <FormLabel>Группы</FormLabel>
                <GroupMultiSelect
                  groups={groups}
                  value={form.group_ids}
                  onChange={(group_ids) => setForm({ ...form, group_ids })}
                />
              </div>

              <div>
                <FormLabel>Описание</FormLabel>
                <FormTextarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Тема занятия, что подготовить..."
                />
              </div>

              <div>
                <FormLabel>Ссылка на трансляцию</FormLabel>
                <FormText
                  value={form.meeting_url}
                  onChange={(e) => setForm({ ...form, meeting_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              {editingLinked && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  Связано со страницей материалов: название, дата и группы обновятся и там.
                </p>
              )}

              {error && (
                <p className="text-sm text-rose-400 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-700 text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingEvent ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  onClick={closeForm}
                  className="px-5 py-3 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupsBadge({ groupIds, groups }: { groupIds: string[]; groups: Group[] }) {
  if (groupIds.length === 0) return null;
  return (
    <span className={`${BADGE} bg-blue-500/10 text-blue-300 border-blue-500/20`}>
      {groupTargetLabel(groupIds, groups)}
    </span>
  );
}

function EventCard({
  event, groups, deleting, materialsBusy, onEdit, onDelete, onOpenMaterials, onCreateMaterials,
}: {
  event: ScheduleEvent;
  groups: Group[];
  deleting: boolean;
  materialsBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenMaterials: (pageId: string, kind: 'lecture' | 'seminar') => void;
  onCreateMaterials: () => void;
}) {
  const page = event.lesson_page;
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`${BADGE} bg-violet-500/15 text-violet-300 border-violet-500/25`}>
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
          {isEventOngoing(event.scheduled_at, event.duration_minutes) && (
            <span className={`${BADGE} bg-emerald-500/15 text-emerald-300 border-emerald-500/25`}>
              Идёт сейчас
            </span>
          )}
          {isEventEnded(event.scheduled_at, event.duration_minutes) && (
            <span className={`${BADGE} bg-slate-500/15 text-slate-400 border-slate-500/20`}>
              Завершено
            </span>
          )}
          <GroupsBadge groupIds={eventGroupIds(event)} groups={groups} />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{event.title}</h3>
        {event.description && (
          <p className="text-sm text-slate-400 mb-3 leading-relaxed">{event.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {formatEventDateTime(event.scheduled_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {formatDuration(event.duration_minutes)}
          </span>
          {event.meeting_url && (
            <MeetingLinkButton
              url={event.meeting_url}
              scheduledAt={event.scheduled_at}
              durationMinutes={event.duration_minutes}
              variant="admin"
            />
          )}
        </div>
        {isLessonEventType(event.event_type) && (
          <div className="mt-3">
            {page ? (
              <button
                type="button"
                onClick={() => onOpenMaterials(page.id, page.lesson_type)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Материалы
                <span className={page.is_published ? 'text-emerald-400' : 'text-amber-400'}>
                  · {page.is_published ? 'опубликованы' : 'черновик'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onCreateMaterials}
                disabled={materialsBusy}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-dashed border-white/15 transition-colors disabled:opacity-50"
              >
                {materialsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Добавить материалы
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Редактировать"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors disabled:opacity-50"
          title="Удалить"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function DeadlineCard({
  entry, groups, onOpen,
}: {
  entry: CalendarEntry;
  groups: Group[];
  onOpen: () => void;
}) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`${BADGE} bg-amber-500/15 text-amber-300 border-amber-500/25`}>Дедлайн ДЗ</span>
          {!entry.homeworkPublished && (
            <span className={`${BADGE} bg-slate-500/15 text-slate-400 border-slate-500/20`}>
              Черновик — ученики не видят
            </span>
          )}
          {isEventEnded(entry.scheduled_at, 0) && (
            <span className={`${BADGE} bg-slate-500/15 text-slate-400 border-slate-500/20`}>Срок прошёл</span>
          )}
          <GroupsBadge groupIds={entry.group_ids ?? []} groups={groups} />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{entry.title}</h3>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            до {formatEventDateTime(entry.scheduled_at)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors flex-shrink-0"
      >
        <BookOpen className="w-4 h-4" />
        Открыть ДЗ
      </button>
    </div>
  );
}
