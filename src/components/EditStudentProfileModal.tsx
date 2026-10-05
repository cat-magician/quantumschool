import { useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2, X } from 'lucide-react';
import { FormLabel, FormText } from './FormControls';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../lib/types';

type Editable = Pick<UserProfile, 'id' | 'display_name' | 'city' | 'school' | 'grade'>;

/**
 * Сотрудник правит данные ученика за него: имя в профиле, город, школу,
 * класс. Права дают политики базы — staff обновляет профили учеников.
 */
export default function EditStudentProfileModal({
  student,
  onClose,
  onSaved,
}: {
  student: Editable;
  onClose: () => void;
  onSaved: (updated: UserProfile) => void;
}) {
  const [name, setName] = useState(student.display_name ?? '');
  const [city, setCity] = useState(student.city ?? '');
  const [school, setSchool] = useState(student.school ?? '');
  const [grade, setGrade] = useState(student.grade ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const words = name.trim().split(/\s+/).filter(Boolean);

  const save = async () => {
    const displayName = words.join(' ');
    if (!displayName) {
      setError('Укажите имя');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: saveError } = await supabase
      .from('user_profiles')
      .update({
        display_name: displayName,
        city: city.trim() || null,
        school: school.trim() || null,
        grade: grade.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', student.id)
      .select('*')
      .single();
    setSaving(false);
    if (saveError || !data) {
      setError('Не удалось сохранить. Попробуйте ещё раз.');
      return;
    }
    onSaved(data as UserProfile);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] overflow-y-auto scrollbar-site bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-title"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 id="edit-student-title" className="text-lg font-bold text-white">Данные ученика</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400" aria-label="Закрыть">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <FormLabel>Имя и фамилия</FormLabel>
            <div className="flex gap-2">
              <FormText value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              {words.length === 2 && (
                <button
                  type="button"
                  onClick={() => setName(`${words[1]} ${words[0]}`)}
                  title="Поменять местами имя и фамилию"
                  aria-label="Поменять местами имя и фамилию"
                  className="flex-shrink-0 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div>
            <FormLabel>Город</FormLabel>
            <FormText value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <FormLabel>Школа</FormLabel>
            <FormText value={school} onChange={(e) => setSchool(e.target.value)} />
          </div>
          <div>
            <FormLabel>Класс</FormLabel>
            <FormText value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>

          {error && (
            <p className="text-sm text-rose-400 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { void save(); }}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Сохранить
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
