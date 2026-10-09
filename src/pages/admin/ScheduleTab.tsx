import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, FilePlus2, Loader2, Plus, Trash2, X,
} from 'lucide-react';
import { normalizeMeetingUrl } from '../../lib/meetingLinkUtils';
import MeetingLinkButton from '../../components/MeetingLinkButton';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';
import MonthCalendar from '../../components/MonthCalendar';
import GroupMultiSelect from '../../components/GroupMultiSelect';
import { EVENT_TONES } from '../../lib/scheduleTones';
import {
  LiveChip,
  ScheduleCard,
  ScheduleChip,
  ScheduleDayHeading,
  ScheduleMeta,
  SchedulePastDivider,
} from '../../components/ScheduleCard';
import {
  FormDatetime,
  FormDuration,
  FormLabel,
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
  formatTimeRange,
  getScheduleEmptyMessage,
  getScheduleRefHint,
  groupEventsByDate,
  isEventActive,
  isEventEnded,
  isEventOngoing,
  isLessonEventType,
  sortScheduleEventsAscending,
  sortScheduleEventsDescending,
} from '../../lib/scheduleUtils';
import { schoolInputToIso, toSchoolDateValue, toSchoolInputValue } from '../../lib/schoolTime';
import { useTimeView } from '../../lib/timeView';

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

const DRAFT_CHIP = 'bg-amber-500/10 text-amber-200 border-amber-500/30';
const MUTED_CHIP = 'bg-white/5 text-slate-400 border-white/10';
const GROUP_CHIP = 'bg-white/5 text-slate-300 border-white/10';

export default function ScheduleTab({
  onOpenContent,
}: {
  onOpenContent?: (target: ScheduleContentTarget) => void;
}) {
  const timeView = useTimeView();
  const { confirm } = useAppDialog();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [homework, setHomework] = useState<HomeworkDeadlineRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pageBusyId, setPageBusyId] = useState<string | null>(null);
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
        .select('*, lesson_page:lesson_pages(id, lesson_type, is_published, title, cover_url)')
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

  const sections = useMemo(() => {
    const list = entries.filter((e) => eventMatchesScheduleFilter(e, filter, selectedDate, timeView));
    const upcoming = list.filter((e) => isEventActive(e.scheduled_at, e.duration_minutes));
    const past = list.filter((e) => isEventEnded(e.scheduled_at, e.duration_minutes));
    return {
      upcoming: groupEventsByDate(sortScheduleEventsAscending(upcoming), timeView),
      past: groupEventsByDate(sortScheduleEventsDescending(past), timeView),
    };
  }, [entries, filter, selectedDate, timeView]);

  const hasEntries = sections.upcoming.length > 0 || sections.past.length > 0;

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
      scheduled_at: toSchoolInputValue(event.scheduled_at),
      duration_minutes: event.duration_minutes,
      meeting_url: event.meeting_url,
      group_ids: eventGroupIds(event),
    });
    setError('');
    setShowForm(true);
  };

  /**
   * Карточка ведёт туда, где занятие целиком: на страницу лекции или
   * семинара, на задание. Событие без страницы правится в форме.
   */
  const openEntry = (entry: CalendarEntry) => {
    if (entry.homeworkPageId) {
      onOpenContent?.({ kind: 'homework', pageId: entry.homeworkPageId });
    } else if (entry.lesson_page) {
      onOpenContent?.({ kind: entry.lesson_page.lesson_type, pageId: entry.lesson_page.id });
    } else {
      openEdit(entry);
    }
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

  /**
   * Страница занятия для события расписания: с тем же названием, датой и
   * группами и сразу привязанная. Опубликована сразу: событие ученики уже
   * видят, а неопубликованная страница спрятала бы его из их расписания.
   */
  const createLessonPage = async (event: ScheduleEvent): Promise<string | null> => {
    if (!isLessonEventType(event.event_type)) return null;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: page, error: pageError } = await supabase
      .from('lesson_pages')
      .insert({
        title: event.title,
        lesson_type: event.event_type,
        lesson_date: toSchoolDateValue(event.scheduled_at),
        is_published: true,
        group_ids: eventGroupIds(event),
        created_by: user?.id ?? null,
      })
      .select('id')
      .single();
    if (pageError || !page) return null;

    const blocks = createDefaultBlocks().map((b) => ({ ...b, page_id: page.id }));
    const [{ error: blocksError }, { error: linkError }] = await Promise.all([
      supabase.from('lesson_page_blocks').insert(blocks),
      supabase.from('schedule_events').update({ lesson_page_id: page.id }).eq('id', event.id),
    ]);
    if (linkError) {
      // Без связи страница осиротела бы во вкладке — убираем её.
      await supabase.from('lesson_pages').delete().eq('id', page.id);
      return null;
    }
    if (blocksError) console.error('Default lesson blocks:', blocksError.message);
    return page.id;
  };

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

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      event_type: form.event_type,
      scheduled_at: schoolInputToIso(form.scheduled_at),
      duration_minutes: form.duration_minutes,
      meeting_url: normalizeMeetingUrl(form.meeting_url),
      group_ids: form.group_ids,
      group_id: legacyGroupId(form.group_ids),
      updated_at: new Date().toISOString(),
    };

    const { data: { user } } = await supabase.auth.getUser();

    if (editingEvent) {
      const { error: updateError } = await supabase
        .from('schedule_events')
        .update(payload)
        .eq('id', editingEvent.id);
      setSaving(false);
      if (updateError) {
        setError('Не удалось сохранить. Применена ли последняя версия schema.sql в Supabase?');
        return;
      }
      closeForm();
      load({ silent: true });
      return;
    }

    const { data: created, error: insertError } = await supabase
      .from('schedule_events')
      .insert({ ...payload, created_by: user?.id ?? null })
      .select('*')
      .single();
    if (insertError || !created) {
      setSaving(false);
      setError('Не удалось сохранить. Применена ли последняя версия schema.sql в Supabase?');
      return;
    }
    // Лекция и семинар — сразу со страницей: карточка в расписании ведёт на неё.
    let pageFailed = false;
    if (isLessonEventType(created.event_type)) {
      pageFailed = (await createLessonPage(created as ScheduleEvent)) === null;
    }
    setSaving(false);
    closeForm();
    if (pageFailed) {
      setListError('Событие добавлено, но страницу занятия создать не удалось — нажмите «Создать страницу» на его карточке.');
    }
    load({ silent: true });
  };

  const remove = async (event: ScheduleEvent) => {
    const ok = await confirm({
      title: event.lesson_page_id ? 'Убрать занятие из расписания?' : 'Удалить событие?',
      message: event.lesson_page_id
        ? 'Ученики перестанут видеть его в расписании. Страница занятия с материалами останется во вкладке '
          + `«${event.event_type === 'seminar' ? 'Семинары' : 'Лекции'}» — уже без времени.`
        : 'Событие исчезнет из расписания учеников.',
      confirmLabel: event.lesson_page_id ? 'Убрать' : 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(event.id);
    await supabase.from('schedule_events').delete().eq('id', event.id);
    setDeletingId(null);
    load({ silent: true });
  };

  const createPageAndOpen = async (event: ScheduleEvent) => {
    setPageBusyId(event.id);
    setListError('');
    const pageId = await createLessonPage(event);
    setPageBusyId(null);
    if (!pageId || !isLessonEventType(event.event_type)) {
      setListError('Не удалось создать страницу занятия. Попробуйте ещё раз.');
      return;
    }
    onOpenContent?.({ kind: event.event_type, pageId });
  };

  const isLessonForm = isLessonEventType(form.event_type);

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
          className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-700 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
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
                aria-pressed={filter === id}
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
          ) : !hasEntries ? (
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
            <div className="space-y-8">
              {sections.upcoming.map(({ dateKey, items }) => (
                <section key={dateKey}>
                  <ScheduleDayHeading iso={items[0].scheduled_at} />
                  <div className="space-y-3">
                    {items.map((entry) => renderEntry(entry, false))}
                  </div>
                </section>
              ))}
              {sections.upcoming.length > 0 && sections.past.length > 0 && <SchedulePastDivider />}
              {sections.past.map(({ dateKey, items }) => (
                <section key={dateKey}>
                  <ScheduleDayHeading iso={items[0].scheduled_at} past />
                  <div className="space-y-3">
                    {items.map((entry) => renderEntry(entry, true))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 min-w-0 lg:sticky lg:top-6 lg:self-start">
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
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">Ближайшие</p>
              {upcomingPreview.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => openEntry(e)}
                  className="w-full flex items-start gap-2.5 text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${EVENT_TONES[e.homeworkPageId ? 'homework' : e.event_type].dot}`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white truncate">
                      {e.homeworkPageId ? `Дедлайн: ${e.title}` : e.title}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">{formatEventDateTime(e.scheduled_at, timeView)}</span>
                  </span>
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
            className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain scrollbar-site"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-form-title"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="schedule-form-title" className="text-lg font-bold text-white">
                {editingEvent ? 'Редактировать событие' : 'Новое событие'}
              </h2>
              <button
                onClick={closeForm}
                aria-label="Закрыть"
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <FormLabel>Название *</FormLabel>
                <FormText
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Введение в квантовые вычисления"
                />
              </div>

              <div>
                <FormLabel>Тип</FormLabel>
                <FormSelect
                  value={form.event_type}
                  onChange={(v) => setForm({ ...form, event_type: v as ScheduleEventType })}
                  options={eventTypeOptions}
                />
                {isLessonForm && !editingEvent && (
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    У {form.event_type === 'seminar' ? 'семинара' : 'лекции'} появится страница занятия: ученики увидят
                    на ней время и ссылку, а потом — запись и конспект.
                  </p>
                )}
              </div>

              <div>
                <FormLabel>Дата и время *</FormLabel>
                <FormDatetime
                  value={form.scheduled_at}
                  onChange={(v) => setForm({ ...form, scheduled_at: v })}
                  warnPast={!editingEvent}
                />
              </div>

              <div>
                <FormLabel>Длительность</FormLabel>
                <FormDuration
                  value={form.duration_minutes}
                  onChange={(duration_minutes) => setForm({ ...form, duration_minutes })}
                  startsAt={form.scheduled_at}
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
                  placeholder="Тема занятия, что подготовить…"
                />
              </div>

              <div>
                <FormLabel>Ссылка на трансляцию</FormLabel>
                <FormText
                  value={form.meeting_url}
                  onChange={(e) => setForm({ ...form, meeting_url: e.target.value })}
                  placeholder="https://telemost.yandex.ru/…"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

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

  function renderEntry(entry: CalendarEntry, past: boolean) {
    if (entry.homeworkPageId) {
      return (
        <ScheduleCard
          key={entry.id}
          type="homework"
          title={entry.title}
          past={past}
          onOpen={() => openEntry(entry)}
          openLabel="открыть задание"
          chips={(
            <>
              <ScheduleChip className={EVENT_TONES.homework.chip}>Дедлайн ДЗ</ScheduleChip>
              {!entry.homeworkPublished && (
                <ScheduleChip className={DRAFT_CHIP}>Черновик · ученики не видят</ScheduleChip>
              )}
              {(entry.group_ids?.length ?? 0) > 0 && (
                <ScheduleChip className={GROUP_CHIP}>{groupTargetLabel(entry.group_ids, groups)}</ScheduleChip>
              )}
            </>
          )}
          meta={(
            <ScheduleMeta past={past}>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" aria-hidden />
                до {formatTimeRange(entry.scheduled_at, 0, timeView)}
              </span>
            </ScheduleMeta>
          )}
        />
      );
    }

    const page = entry.lesson_page;
    const lesson = isLessonEventType(entry.event_type);
    const groupIds = eventGroupIds(entry);
    return (
      <ScheduleCard
        key={entry.id}
        type={entry.event_type}
        coverUrl={page?.cover_url}
        title={entry.title}
        description={entry.description}
        past={past}
        onOpen={() => openEntry(entry)}
        openLabel={page
          ? `открыть страницу ${page.lesson_type === 'seminar' ? 'семинара' : 'лекции'}`
          : 'изменить событие'}
        chips={(
          <>
            <ScheduleChip className={EVENT_TONES[entry.event_type].chip}>
              {EVENT_TYPE_LABELS[entry.event_type]}
            </ScheduleChip>
            {isEventOngoing(entry.scheduled_at, entry.duration_minutes) && <LiveChip />}
            {page && !page.is_published && (
              <ScheduleChip className={DRAFT_CHIP}>Черновик · ученики не видят</ScheduleChip>
            )}
            {lesson && !page && <ScheduleChip className={MUTED_CHIP}>Без страницы</ScheduleChip>}
            {groupIds.length > 0 && (
              <ScheduleChip className={GROUP_CHIP}>{groupTargetLabel(groupIds, groups)}</ScheduleChip>
            )}
          </>
        )}
        meta={(
          <ScheduleMeta past={past}>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" aria-hidden />
              {formatTimeRange(entry.scheduled_at, entry.duration_minutes, timeView)}
            </span>
            <span className="text-slate-500">{formatDuration(entry.duration_minutes)}</span>
          </ScheduleMeta>
        )}
        footer={(entry.meeting_url && !past) || (lesson && !page) ? (
          <>
            {entry.meeting_url && (
              <MeetingLinkButton
                url={entry.meeting_url}
                scheduledAt={entry.scheduled_at}
                durationMinutes={entry.duration_minutes}
                variant="card"
              />
            )}
            {lesson && !page && (
              <button
                type="button"
                onClick={() => { void createPageAndOpen(entry); }}
                disabled={pageBusyId === entry.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-dashed border-white/15 transition-colors disabled:opacity-50"
              >
                {pageBusyId === entry.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FilePlus2 className="w-3.5 h-3.5" />}
                Создать страницу
              </button>
            )}
          </>
        ) : undefined}
        actions={(
          <button
            type="button"
            onClick={() => { void remove(entry); }}
            disabled={deletingId === entry.id}
            aria-label={page ? 'Убрать из расписания' : 'Удалить событие'}
            title={page ? 'Убрать из расписания' : 'Удалить событие'}
            className="p-2 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
          >
            {deletingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
      />
    );
  }
}
