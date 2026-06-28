import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, GraduationCap, Loader2, LogOut, Mail, MapPin, Pencil, Save, Shield, User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { removeProfileAvatar, uploadProfileAvatar } from '../lib/avatarUtils';
import type { DashboardReturnState } from '../lib/dashboardNavigation';
import { dashboardPathFromProfileSearch, dashboardPathWithState } from '../lib/dashboardNavigation';
import {
  groupsForTeacher,
  loadGroupTeachers,
  loadStudentGroupContext,
  type StudentGroupContext,
} from '../lib/groupUtils';
import {
  canEditApplicationFields,
  formatProfileDate,
  profileToEditable,
  roleBadgeClass,
  roleLabel,
  type ProfileEditableFields,
} from '../lib/profileUtils';
import UserAvatar from '../components/UserAvatar';
import AvatarUploadModal from '../components/AvatarUploadModal';
import { adminStageLabel } from '../lib/selectionDisplayUtils';
import type { Group } from '../lib/types';
import DashboardSiteHomeLink from '../components/DashboardSiteHomeLink';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-white sm:text-right max-w-md break-words">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: DashboardReturnState } | null)?.returnTo;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileEditableFields>({
    display_name: '',
    city: '',
    school: '',
    grade: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [studentGroup, setStudentGroup] = useState<StudentGroupContext | null>(null);
  const [teacherGroups, setTeacherGroups] = useState<Group[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) setForm(profileToEditable(profile));
  }, [profile]);

  useEffect(() => {
    if (!user || !profile) return;
    setExtraLoading(true);

    const load = async () => {
      if (profile.role === 'student' && profile.is_enrolled) {
        const ctx = await loadStudentGroupContext(supabase, user.id);
        setStudentGroup(ctx);
        setTeacherGroups([]);
      } else if (profile.role === 'admin' || profile.role === 'superadmin') {
        const [groupsRes, gtRows] = await Promise.all([
          supabase.from('groups').select('*').eq('group_type', 'teacher').order('name'),
          loadGroupTeachers(supabase),
        ]);
        setTeacherGroups(groupsForTeacher((groupsRes.data ?? []) as Group[], gtRows, user.id));
        setStudentGroup(null);
      } else {
        setStudentGroup(null);
        setTeacherGroups([]);
      }
      setExtraLoading(false);
    };

    load();
  }, [user, profile]);

  const goBack = () => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab')) {
      navigate(dashboardPathFromProfileSearch(params));
      return;
    }

    if (returnTo) {
      const target = dashboardPathWithState(returnTo);
      navigate(`${target.pathname}${target.search}`, { state: target.state });
      return;
    }

    navigate('/dashboard');
  };

  const saveProfile = async () => {
    if (!user || !profile) return;
    setSaving(true);
    setMessage('');

    const payload: Record<string, string> = {
      display_name: form.display_name.trim() || profile.display_name,
    };
    if (canEditApplicationFields(profile)) {
      payload.city = form.city.trim();
      payload.school = form.school.trim();
      payload.grade = form.grade.trim();
    }

    const { error } = await supabase.from('user_profiles').update(payload).eq('id', user.id);

    if (password.trim() || password2.trim()) {
      if (password.length < 6) {
        setMessage('Пароль должен быть не короче 6 символов');
        setSaving(false);
        return;
      }
      if (password !== password2) {
        setMessage('Пароли не совпадают');
        setSaving(false);
        return;
      }
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) {
        setMessage(pwErr.message);
        setSaving(false);
        return;
      }
      setPassword('');
      setPassword2('');
    }

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    await refreshProfile();
    setEditing(false);
    setMessage('Изменения сохранены');
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const isStaff = profile.role === 'admin' || profile.role === 'superadmin';
  const showApplicationFields = canEditApplicationFields(profile);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
          <DashboardSiteHomeLink compact />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6 pb-12">
        <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <UserAvatar
                displayName={editing ? form.display_name : profile.display_name}
                avatarUrl={profile.avatar_url}
                size="lg"
              />
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 border-2 border-slate-900 flex items-center justify-center transition-colors"
                title="Изменить фото"
                aria-label="Изменить фото"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-lg font-semibold"
                  placeholder="Имя"
                />
              ) : (
                <h1 className="text-2xl font-bold truncate">{profile.display_name}</h1>
              )}
              <p className="text-sm text-slate-500 mt-1 truncate">{user.email}</p>
              <span className={`inline-flex mt-3 px-2.5 py-1 rounded-lg text-xs font-medium border ${roleBadgeClass(profile)}`}>
                {roleLabel(profile)}
              </span>
            </div>
          </div>
        </section>

        <AvatarUploadModal
          open={avatarModalOpen}
          onClose={() => setAvatarModalOpen(false)}
          hasAvatar={Boolean(profile.avatar_url?.trim())}
          onSave={async (file) => {
            if (!user) return 'Не удалось определить пользователя';
            const { error } = await uploadProfileAvatar(user.id, file);
            if (error) return error;
            await refreshProfile();
            setMessage('Аватар обновлён');
            return null;
          }}
          onRemove={async () => {
            if (!user) return 'Не удалось определить пользователя';
            const { error } = await removeProfileAvatar(user.id);
            if (error) return error;
            await refreshProfile();
            setMessage('Аватар удалён');
            return null;
          }}
        />

        {message && (
          <p className={`text-sm px-4 py-3 rounded-xl border ${
            message.includes('сохран') || message.includes('Измен') || message.includes('Аватар')
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
              : 'text-rose-300 bg-rose-500/10 border-rose-500/20'
          }`}>
            {message}
          </p>
        )}

        <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8 space-y-1">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5" />
            Основное
          </h2>
          <InfoRow label="Email" value={user.email ?? '—'} />
          <InfoRow label="На платформе с" value={formatProfileDate(profile.created_at)} />
          {profile.privacy_consent_at && (
            <InfoRow label="Согласие на обработку данных" value={formatProfileDate(profile.privacy_consent_at)} />
          )}
        </section>

        {showApplicationFields && (
          <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8 space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              Анкета участника
            </h2>
            {editing ? (
              <div className="space-y-3">
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Город"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
                />
                <input
                  value={form.school}
                  onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
                  placeholder="Школа"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
                />
                <input
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                  placeholder="Класс"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
                />
              </div>
            ) : (
              <>
                <InfoRow label="Город" value={profile.city?.trim() || '—'} />
                <InfoRow label="Школа" value={profile.school?.trim() || '—'} />
                <InfoRow label="Класс" value={profile.grade?.trim() || '—'} />
              </>
            )}
          </section>
        )}

        {profile.role === 'student' && !profile.is_enrolled && (
          <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8 space-y-1">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Отбор
            </h2>
            <InfoRow
              label="Этап 1: эссе"
              value={adminStageLabel(profile.stage1_status, profile.stage1_score, profile.stage1_submitted_at, profile.stage1_viewed_at)}
            />
            <InfoRow
              label="Этап 2: контест"
              value={adminStageLabel(profile.stage2_status, profile.stage2_score, profile.stage2_submitted_at, profile.stage2_viewed_at)}
            />
            <InfoRow
              label="Статус"
              value={profile.selection_rejected ? 'Не прошёл отбор' : profile.is_enrolled ? 'Зачислен' : 'На рассмотрении'}
            />
          </section>
        )}

        {profile.role === 'student' && profile.is_enrolled && (
          <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8 space-y-1">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5" />
              Обучение
            </h2>
            {extraLoading ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              </div>
            ) : studentGroup ? (
              <>
                <InfoRow label="Группа" value={studentGroup.groupName} />
                <InfoRow
                  label="Преподаватели"
                  value={
                    studentGroup.teachers.length
                      ? studentGroup.teachers.map((t) => t.display_name).join(', ')
                      : 'Не назначены'
                  }
                />
              </>
            ) : (
              <InfoRow label="Группа" value="Не назначена" />
            )}
          </section>
        )}

        {isStaff && (
          <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8 space-y-1">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5" />
              {profile.role === 'superadmin' ? 'Доступ и группы' : 'Мои группы'}
            </h2>
            {extraLoading ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              </div>
            ) : teacherGroups.length ? (
              teacherGroups.map((g) => (
                <InfoRow key={g.id} label="Группа" value={g.name} />
              ))
            ) : (
              <InfoRow label="Группы" value="Пока не назначены" />
            )}
            {profile.role === 'superadmin' && (
              <InfoRow label="Права" value="Полный доступ ко всем разделам админки" />
            )}
          </section>
        )}

        {editing && (
          <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8 space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />
              Смена пароля
            </h2>
            <p className="text-xs text-slate-500">Оставьте пустым, если менять пароль не нужно.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Новый пароль"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Повторите пароль"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
              autoComplete="new-password"
            />
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {editing ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={saveProfile}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setForm(profileToEditable(profile));
                  setPassword('');
                  setPassword2('');
                  setMessage('');
                }}
                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border border-blue-500/30 text-sm font-medium transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Редактировать
            </button>
          )}
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>

        <p className="text-center text-xs text-slate-600">
          <Link to="/privacy" className="hover:text-slate-400 underline-offset-2 hover:underline">
            Политика конфиденциальности
          </Link>
        </p>
      </main>
    </div>
  );
}
