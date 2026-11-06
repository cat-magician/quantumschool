import { useEffect, useMemo, useState } from 'react';
import { Loader2, Medal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppDialog } from '../../lib/AppDialogContext';
import { SearchableCheckboxList, type PickerRow } from '../../components/SearchablePicker';
import { profileAccountLabel, profileDisplayName } from '../../lib/profileUtils';
import type { UserProfile } from '../../lib/types';
import UserAvatar from '../../components/UserAvatar';
import { loadAchievementCatalog, resetAchievementCatalogCache } from '../../lib/achievementApi';
import { invalidateRecentAchievementImagesCache } from '../../hooks/useRecentAchievementImages';

export default function AchievementsGrantTab() {
  const { toast } = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hint, setHint] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('100');
  const [staffOk, setStaffOk] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .in('role', ['student', 'admin'])
        .order('display_name');
      if (cancelled) return;
      if (error) {
        toast('Не удалось загрузить список людей');
        setProfiles([]);
      } else {
        setProfiles((data ?? []) as UserProfile[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const pickerRows: PickerRow[] = useMemo(
    () =>
      profiles.map((p) => ({
        id: p.id,
        title: profileDisplayName(p),
        subtitle: profileAccountLabel(p, null) ?? undefined,
        searchText: `${profileDisplayName(p)} ${profileAccountLabel(p, null) ?? ''} ${p.role}`,
        leading: (
          <UserAvatar
            displayName={profileDisplayName(p)}
            avatarUrl={p.avatar_url}
            size="chip"
            userId={p.id}
            showAchievementBadges
          />
        ),
        trailing: (
          <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">
            {p.role === 'student' ? 'Ученик' : 'Админ'}
          </span>
        ),
      })),
    [profiles],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const grant = async () => {
    const trimmedCode = code.trim().toLowerCase();
    if (!trimmedCode || !/^[a-z0-9_]+$/.test(trimmedCode)) {
      toast('Код: латиница, цифры и подчёркивание, например club_hero_2026');
      return;
    }
    if (!title.trim()) {
      toast('Введите название достижения');
      return;
    }
    if (selectedIds.length === 0) {
      toast('Выберите хотя бы одного человека');
      return;
    }

    const so = parseInt(sortOrder.trim(), 10);
    const sort = Number.isFinite(so) ? so : 100;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('superadmin_grant_personal_achievement', {
        p_code: trimmedCode,
        p_title: title.trim(),
        p_description: description.trim(),
        p_hint: hint.trim(),
        p_image_url: imageUrl.trim(),
        p_sort_order: sort,
        p_staff_ok: staffOk,
        p_recipient_ids: selectedIds,
      });

      if (error) {
        toast(error.message);
        return;
      }

      const payload = data as { ok?: boolean; awarded?: number; error?: string } | null;
      if (!payload?.ok) {
        if (payload?.error === 'code_is_system') {
          toast('Этот код зарезервирован системой — выберите другой');
        } else {
          toast('Не удалось выдать достижение');
        }
        return;
      }

      toast(`Выдано: ${payload.awarded ?? 0} из ${selectedIds.length}`);
      for (const uid of selectedIds) {
        invalidateRecentAchievementImagesCache(uid);
      }
      resetAchievementCatalogCache();
      await loadAchievementCatalog();
      setSelectedIds([]);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-200 text-xs font-medium mb-3">
          <Medal className="w-3.5 h-3.5" />
          Персональные достижения
        </div>
        <h2 className="text-xl font-bold text-white">Создать и выдать достижение</h2>
        <p className="text-sm text-slate-400 mt-1">
          Картинку положите в{' '}
          <code className="text-slate-300">public/achievements/</code>
          {' '}и укажите путь от корня, например{' '}
          <code className="text-slate-300">/achievements/badge.png</code>
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Код (латиница, уникальный)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="my_unique_badge"
              className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Порядок в каталоге</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Название</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Описание (в попапе и карточке)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-y min-h-[4rem]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Подсказка «как получить» (для тех, у кого ещё нет)</span>
          <textarea
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            rows={2}
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-y min-h-[4rem]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Картинка (URL или путь /achievements/…)</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="/achievements/award.png"
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
          />
        </label>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-white/10 bg-slate-950/50 p-4">
          <input
            type="checkbox"
            checked={staffOk}
            onChange={(e) => setStaffOk(e.target.checked)}
            className="mt-0.5 rounded border-white/20 bg-slate-900 text-violet-500 focus:ring-violet-500/40"
          />
          <span className="text-sm text-slate-300 leading-snug">
            Разрешить эту награду <strong className="text-white">администраторам</strong> (не только ученикам).
            Ученикам система выдаёт всегда; без галочки выбранным админам награда не начислится.
          </span>
        </label>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Кому выдать</h3>
        <SearchableCheckboxList
          items={pickerRows}
          selectedIds={selectedIds}
          onToggle={toggle}
          searchPlaceholder="Имя, почта, роль…"
          emptyText="Нет учеников и админов в базе"
        />
      </div>

      <button
        type="button"
        onClick={() => { void grant(); }}
        disabled={submitting}
        className="w-full sm:w-auto min-h-11 px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Medal className="w-4 h-4" />}
        {submitting ? 'Выдаём…' : 'Сохранить и выдать'}
      </button>
    </div>
  );
}
