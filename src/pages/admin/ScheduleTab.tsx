import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, Loader2, Pencil, Plus, Trash2, Video, X,
} from 'lucide-react';
import MonthCalendar from '../../components/MonthCalendar';
import { supabase } from '../../lib/supabase';
import { useAppDialog } from '../../lib/AppDialogContext';
import type { Group, ScheduleEvent, ScheduleEventType } from '../../lib/types';
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  formatDuration,
  formatEventDateTime,
  isEventUpcoming,
  toDatetimeLocalValue,
} from '../../lib/scheduleUtils';

type Filter = 'upcoming' | 'past' | 'all';

const EMPTY_FORM = {
  title: '',
  description: '',
  event_type: 'lecture' as ScheduleEventType,
  scheduled_at: '',
  duration_minutes: 60,
  meeting_url: '',
  group_id: '',
};

export default function ScheduleTab() {
  const { confirm } = useAppDialog();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setInitialLoading(true);
    const [eventsRes, groupsRes] = await Promise.all([
      supabase
        .from('schedule_events')
        .select('*, group:groups(id, name)')
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('groups')
        .select('*')
        .eq('group_type', 'teacher')
        .order('name'),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data as ScheduleEvent[]);
    if (groupsRes.data) setGroups(groupsRes.data);
    if (silent) setRefreshing(false);
    else setInitialLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return events.filter((e) => {
      const d = new Date(e.scheduled_at);
      if (selectedDate) {
        const same =
          d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth() === selectedDate.getMonth() &&
          d.getDate() === selectedDate.getDate();
        if (!same) return false;
      }
      const upcoming = d >= now;
      if (filter === 'upcoming') return upcoming;
      if (filter === 'past') return !upcoming;
      return true;
    });
  }, [events, filter, selectedDate]);

  const upcomingPreview = useMemo(
    () => events.filter((e) => isEventUpcoming(e.scheduled_at)).slice(0, 4),
    [events],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (event: ScheduleEvent) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description,
      event_type: event.event_type,
      scheduled_at: toDatetimeLocalValue(event.scheduled_at),
      duration_minutes: event.duration_minutes,
      meeting_url: event.meeting_url,
      group_id: event.group_id ?? '',
    });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
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
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      meeting_url: form.meeting_url.trim(),
      group_id: form.group_id || null,
      updated_at: new Date().toISOString(),
    };

    const { data: { user } } = await supabase.auth.getUser();

    const result = editingId
      ? await supabase.from('schedule_events').update(payload).eq('id', editingId)
      : await supabase.from('schedule_events').insert({ ...payload, created_by: user?.id ?? null });

    setSaving(false);

    if (result.error) {
      setError('Не удалось сохранить. Применена ли миграция schedule_events в Supabase?');
      return;
    }

    closeForm();
    load({ silent: true });
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: 'Удалить событие?',
      message: 'Событие исчезнет из расписания учеников.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(id);
    await supabase.from('schedule_events').delete().eq('id', id);
    setDeletingId(null);
    load({ silent: true });
  };

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
            Создавайте лекции и семинары — зачисленные ученики увидят их в своём расписании
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-700 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Добавить событие
        </button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        <div className="space-y-4">
          <MonthCalendar
            events={events}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate((prev) =>
              prev && prev.getTime() === d.getTime() ? null : d
            )}
          />
          {upcomingPreview.length > 0 && (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Ближайшие</p>
              {upcomingPreview.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => openEdit(e)}
                  className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="text-sm font-medium text-white truncate">{e.title}</div>
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
              Сбросить фильтр по дате
            </button>
          )}
        </div>

        <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ['upcoming', 'Предстоящие'],
          ['past', 'Прошедшие'],
          ['all', 'Все'],
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
          <p className="text-slate-400 text-sm">
            {filter === 'upcoming' ? 'Нет предстоящих событий' : 'Событий пока нет'}
          </p>
          <button onClick={openCreate} className="mt-4 text-sm text-blue-400 hover:text-blue-300">
            Создать первое занятие
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => (
            <div
              key={event.id}
              className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/25">
                    {EVENT_TYPE_LABELS[event.event_type]}
                  </span>
                  {!isEventUpcoming(event.scheduled_at) && (
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-500/15 text-slate-400 border border-slate-500/20">
                      Завершено
                    </span>
                  )}
                  {event.group?.name && (
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {event.group.name}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{event.title}</h3>
                {event.description && (
                  <p className="text-sm text-slate-400 mb-3 leading-relaxed">{event.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {formatEventDateTime(event.scheduled_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {formatDuration(event.duration_minutes)}
                  </span>
                  {event.meeting_url && (
                    <a
                      href={event.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
                    >
                      <Video className="w-4 h-4" />
                      Ссылка на занятие
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(event)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Редактировать"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(event.id)}
                  disabled={deletingId === event.id}
                  className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors disabled:opacity-50"
                  title="Удалить"
                >
                  {deletingId === event.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Редактировать событие' : 'Новое событие'}
              </h2>
              <button onClick={closeForm} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Название *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Введение в квантовые вычисления"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Тип</label>
                  <select
                    value={form.event_type}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value as ScheduleEventType })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  >
                    {EVENT_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t} className="bg-slate-900">
                        {EVENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Длительность (мин)</label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Дата и время *</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Группа</label>
                <select
                  value={form.group_id}
                  onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="" className="bg-slate-900">Все зачисленные ученики</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id} className="bg-slate-900">
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Описание</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Тема занятия, что подготовить..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Ссылка на трансляцию</label>
                <input
                  value={form.meeting_url}
                  onChange={(e) => setForm({ ...form, meeting_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
                  {editingId ? 'Сохранить' : 'Создать'}
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
