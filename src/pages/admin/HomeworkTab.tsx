import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, Loader2, Pencil, Plus, Save, Trash2, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import type { Group, HomeworkAssignment, HomeworkSubmission, ScheduleEvent } from '../../lib/types';
import {
  assignmentVisibleToStaff,
  groupsForTeacher,
  loadGroupTeachers,
  studentGroupMap,
  submissionVisibleToStaff,
  ENROLLED_GROUP_LABEL,
} from '../../lib/groupUtils';
import {
  formatDueDate,
  maybeGrantAchievement,
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_STATUS_LABELS,
  syncProgressFromGrade,
} from '../../lib/homeworkUtils';
import { studentInitials } from '../../lib/adminUtils';
import { toDatetimeLocalValue } from '../../lib/scheduleUtils';
import HomeworkCards from '../../components/HomeworkCards';
import { homeworkLoadError } from '../../lib/homeworkLoadError';

type Section = 'view' | 'grading' | 'assignments';

const EMPTY_ASSIGNMENT = {
  title: '',
  lesson_summary: '',
  materials: '',
  tasks: '',
  external_url: '',
  due_at: '',
  schedule_event_id: '',
  group_id: '',
  is_published: true,
};

export default function HomeworkTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { user } = useAuth();
  const { confirm, toast } = useAppDialog();
  const [section, setSection] = useState<Section>('view');
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<HomeworkSubmission[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teacherGroupIds, setTeacherGroupIds] = useState<Set<string>>(new Set());
  const [studentGroups, setStudentGroups] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_ASSIGNMENT);
  const [saving, setSaving] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user) return;
    if (silent) setRefreshing(true);
    else {
      setInitialLoading(true);
      setLoadError(null);
    }
    const [aRes, sRes, gRes, eRes, membersRes, gtRows] = await Promise.all([
      supabase
        .from('homework_assignments')
        .select('*, group:groups(id, name), schedule_event:schedule_events(id, title, scheduled_at)')
        .order('created_at', { ascending: false }),
      supabase
        .from('homework_submissions')
        .select('*, assignment:homework_assignments(id, title, group_id)')
        .in('status', ['submitted', 'graded'])
        .order('submitted_at', { ascending: false }),
      supabase.from('groups').select('*').eq('group_type', 'teacher').order('name'),
      supabase.from('schedule_events').select('id, title, scheduled_at').order('scheduled_at', { ascending: false }).limit(30),
      supabase.from('group_members').select('*'),
      loadGroupTeachers(supabase),
    ]);
    if (aRes.error) {
      setLoadError(homeworkLoadError(aRes.error.message));
      setAssignments([]);
    } else if (aRes.data) {
      setAssignments(aRes.data as HomeworkAssignment[]);
    }
    if (sRes.data) {
      const subs = sRes.data as HomeworkSubmission[];
      const userIds = [...new Set(subs.map((s) => s.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from('user_profiles').select('id, display_name, email').in('id', userIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setAllSubmissions(subs.map((s) => ({ ...s, student: profileMap[s.user_id] ?? null })));
    }
    const rawGroups = (gRes.data ?? []) as Group[];
    const visibleGroups = isSuperAdmin
      ? rawGroups
      : groupsForTeacher(rawGroups, gtRows, user.id);
    setGroups(visibleGroups);
    setTeacherGroupIds(new Set(visibleGroups.map((g) => g.id)));
    setStudentGroups(studentGroupMap((membersRes.data ?? []) as { user_id: string; group_id: string }[]));
    if (eRes.data) setEvents(eRes.data as ScheduleEvent[]);
    if (silent) setRefreshing(false);
    else setInitialLoading(false);
  };

  useEffect(() => { load(); }, [user?.id, isSuperAdmin]);

  const visibleAssignments = useMemo(
    () => assignments.filter((a) => assignmentVisibleToStaff(a, teacherGroupIds, isSuperAdmin)),
    [assignments, teacherGroupIds, isSuperAdmin],
  );

  const submissions = useMemo(
    () => allSubmissions.filter((s) =>
      submissionVisibleToStaff(s, studentGroups, teacherGroupIds, isSuperAdmin),
    ),
    [allSubmissions, studentGroups, teacherGroupIds, isSuperAdmin],
  );

  const publishedAssignments = useMemo(
    () => visibleAssignments.filter((a) => a.is_published),
    [visibleAssignments],
  );

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === 'submitted').length,
    [submissions],
  );

  const submissionsByGroup = useMemo(() => {
    const buckets = new Map<string, { label: string; items: HomeworkSubmission[] }>();
    const ensure = (id: string, label: string) => {
      if (!buckets.has(id)) buckets.set(id, { label, items: [] });
      return buckets.get(id)!;
    };
    for (const s of submissions) {
      const gid = studentGroups[s.user_id];
      if (!gid) {
        ensure('none', 'Без учебной группы').items.push(s);
      } else {
        const name = groups.find((g) => g.id === gid)?.name ?? 'Группа';
        ensure(gid, name).items.push(s);
      }
    }
    return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [submissions, studentGroups, groups]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_ASSIGNMENT);
    setError('');
    setShowForm(true);
  };

  const openEdit = (a: HomeworkAssignment) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      lesson_summary: a.lesson_summary,
      materials: a.materials,
      tasks: a.tasks,
      external_url: a.external_url,
      due_at: a.due_at ? toDatetimeLocalValue(a.due_at) : '',
      schedule_event_id: a.schedule_event_id ?? '',
      group_id: a.group_id ?? '',
      is_published: a.is_published,
    });
    setError('');
    setShowForm(true);
  };

  const saveAssignment = async () => {
    if (!form.title.trim()) {
      setError('Укажите название задания');
      return;
    }
    if (!isSuperAdmin && !form.group_id) {
      setError('Выберите учебную группу');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      lesson_summary: form.lesson_summary.trim(),
      materials: form.materials.trim(),
      tasks: form.tasks.trim(),
      external_url: form.external_url.trim(),
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      schedule_event_id: form.schedule_event_id || null,
      group_id: form.group_id || null,
      is_published: form.is_published,
      updated_at: new Date().toISOString(),
    };
    const { data: { user } } = await supabase.auth.getUser();
    const result = editingId
      ? await supabase.from('homework_assignments').update(payload).eq('id', editingId)
      : await supabase.from('homework_assignments').insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (result.error) {
      setError('Не удалось сохранить. Применена ли миграция homework_learning?');
      return;
    }
    setShowForm(false);
    load({ silent: true });
  };

  const removeAssignment = async (id: string) => {
    const ok = await confirm({
      title: 'Удалить задание?',
      message: 'Все ответы учеников по этому заданию тоже будут удалены.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    await supabase.from('homework_assignments').delete().eq('id', id);
    load({ silent: true });
  };

  const getGradeDraft = (s: HomeworkSubmission) =>
    gradeDrafts[s.id] ?? { score: s.score?.toString() ?? '', feedback: s.feedback ?? '' };

  const setGradeDraft = (id: string, patch: Partial<{ score: string; feedback: string }>, fallback?: HomeworkSubmission) => {
    setGradeDrafts((prev) => {
      const current = prev[id] ?? {
        score: fallback?.score?.toString() ?? '',
        feedback: fallback?.feedback ?? '',
      };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };

  const gradeSubmission = async (s: HomeworkSubmission) => {
    const draft = gradeDrafts[s.id] ?? { score: '', feedback: '' };
    const score = Number(draft.score);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      toast('Оценка должна быть от 0 до 10', 'warning');
      return;
    }
    setGradingId(s.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('homework_submissions').update({
      score,
      feedback: draft.feedback.trim(),
      status: 'graded',
      graded_at: new Date().toISOString(),
      graded_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', s.id);
    if (!err && s.assignment) {
      const idx = visibleAssignments.findIndex((a) => a.id === s.assignment_id);
      await syncProgressFromGrade(supabase, s.user_id, s.assignment.title, idx >= 0 ? idx : 0, score);
      if (score >= 8) {
        await maybeGrantAchievement(supabase, s.user_id, 'Отличная работа', `Оценка ${score}/10 за «${s.assignment.title}»`, 'star');
      }
      if (score >= 6) {
        await maybeGrantAchievement(supabase, s.user_id, 'ДЗ сдано', `Успешно выполнено: ${s.assignment.title}`, 'check');
      }
    }
    setGradingId(null);
    load({ silent: true });
  };

  return (
    <div className={`space-y-6 max-w-4xl relative transition-opacity duration-200 ${refreshing ? 'opacity-80' : ''}`}>
      {refreshing && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-white/10 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Обновление…
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Домашние задания</h2>
        <p className="text-slate-400 text-sm">
          {isSuperAdmin
            ? 'Все работы учеников по учебным группам. Оценку может выставить суперадмин или преподаватель группы.'
            : 'Работы учеников из ваших учебных групп'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSection('view')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            section === 'view'
              ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          Задания
        </button>
        <button
          onClick={() => setSection('grading')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            section === 'grading'
              ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          Проверка {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button
          onClick={() => setSection('assignments')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            section === 'assignments'
              ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          Управление
        </button>
      </div>

      {section === 'view' ? (
        <HomeworkCards
          assignments={publishedAssignments}
          loading={initialLoading}
          loadError={loadError}
          emptyMessage="Опубликованных заданий пока нет"
          readOnly
        />
      ) : initialLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : section === 'grading' ? (
        <div className="space-y-6">
          {submissions.length === 0 ? (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center text-slate-400 text-sm">
              Нет работ на проверке
            </div>
          ) : isSuperAdmin ? (
            submissionsByGroup.map(({ label, items }) => (
              <div key={label} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{label}</h3>
                {items.map((s) => (
                  <SubmissionGradeCard
                    key={s.id}
                    submission={s}
                    draft={getGradeDraft(s)}
                    gradingId={gradingId}
                    onScoreChange={(v) => setGradeDraft(s.id, { score: v }, s)}
                    onFeedbackChange={(v) => setGradeDraft(s.id, { feedback: v }, s)}
                    onSave={() => gradeSubmission(s)}
                  />
                ))}
              </div>
            ))
          ) : (
            submissions.map((s) => (
              <SubmissionGradeCard
                key={s.id}
                submission={s}
                draft={getGradeDraft(s)}
                gradingId={gradingId}
                onScoreChange={(v) => setGradeDraft(s.id, { score: v }, s)}
                onFeedbackChange={(v) => setGradeDraft(s.id, { feedback: v }, s)}
                onSave={() => gradeSubmission(s)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Новое задание
          </button>
          <HomeworkCards
            assignments={assignments}
            loading={false}
            loadError={loadError}
            emptyMessage="Заданий пока нет — создайте первое"
            readOnly
          />
          {visibleAssignments.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Редактирование</p>
              {visibleAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{a.title}</div>
                    <div className="text-xs text-slate-500">
                      {a.is_published ? 'Опубликовано' : 'Черновик'}
                      {a.due_at && ` · ${formatDueDate(a.due_at)}`}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(a)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400" title="Редактировать">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeAssignment(a.id)} className="p-2 rounded-xl bg-rose-500/10 text-rose-400" title="Удалить">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editingId ? 'Редактировать' : 'Новое задание'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Название *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
              <Field label="О пройденном занятии" value={form.lesson_summary} onChange={(v) => setForm({ ...form, lesson_summary: v })} multiline />
              <Field label="Материалы" value={form.materials} onChange={(v) => setForm({ ...form, materials: v })} multiline placeholder="Ссылки, конспект..." />
              <Field label="Задания" value={form.tasks} onChange={(v) => setForm({ ...form, tasks: v })} multiline />
              <Field label="Ссылка (Яндекс.Контест / форма)" value={form.external_url} onChange={(v) => setForm({ ...form, external_url: v })} placeholder="https://..." />
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Привязка к занятию</label>
                <select
                  value={form.schedule_event_id}
                  onChange={(e) => setForm({ ...form, schedule_event_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
                >
                  <option value="" className="bg-slate-900">Без привязки</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id} className="bg-slate-900">{e.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Срок сдачи</label>
                  <input
                    type="datetime-local"
                    value={form.due_at}
                    onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Группа</label>
                  <select
                    value={form.group_id}
                    onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
                  >
                    <option value="" className="bg-slate-900">{isSuperAdmin ? ENROLLED_GROUP_LABEL : 'Выберите группу'}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id} className="bg-slate-900">{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Опубликовано для учеников
              </label>
              {error && <p className="text-sm text-rose-400">{error}</p>}
              <button
                onClick={saveAssignment}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionGradeCard({
  submission: s,
  draft,
  gradingId,
  onScoreChange,
  onFeedbackChange,
  onSave,
}: {
  submission: HomeworkSubmission;
  draft: { score: string; feedback: string };
  gradingId: string | null;
  onScoreChange: (v: string) => void;
  onFeedbackChange: (v: string) => void;
  onSave: () => void;
}) {
  const name = s.student?.display_name ?? 'Ученик';
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {studentInitials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white">{name}</div>
          <div className="text-xs text-slate-500">{s.student?.email}</div>
          <div className="text-sm text-blue-300 mt-1">{s.assignment?.title}</div>
          <span className={`inline-flex mt-2 text-xs px-2.5 py-1 rounded-lg border ${SUBMISSION_STATUS_COLORS[s.status]}`}>
            {SUBMISSION_STATUS_LABELS[s.status]}
            {s.score !== null && ` · ${s.score}/10`}
          </span>
        </div>
      </div>
      {s.answer_text && (
        <div className="px-4 py-3 rounded-xl bg-white/5 text-sm text-slate-300 whitespace-pre-wrap">
          {s.answer_text}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Оценка (0–10)</label>
          <input
            type="number"
            min={0}
            max={10}
            value={draft.score}
            onChange={(e) => onScoreChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs text-slate-500 mb-1">Комментарий</label>
          <input
            value={draft.feedback}
            onChange={(e) => onFeedbackChange(e.target.value)}
            placeholder="Обратная связь ученику"
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={gradingId === s.id}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
      >
        {gradingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Сохранить оценку
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, multiline, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const cls = 'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500';
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1.5">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={`${cls} resize-none`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  );
}
