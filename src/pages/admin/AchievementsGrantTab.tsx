import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Check, Eye, ImagePlus, Loader2, Medal, Plus, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import { SearchableCheckboxList, type PickerRow } from '../../components/SearchablePicker';
import { profileAccountLabel, profileDisplayName } from '../../lib/profileUtils';
import type { AchievementDefinition, UserProfile, UserRole } from '../../lib/types';
import UserAvatar from '../../components/UserAvatar';
import AchievementImage from '../../components/achievements/AchievementImage';
import AchievementUnlockDialog from '../../components/achievements/AchievementUnlockDialog';
import { achievementImageSrc, type AchievementUnlock } from '../../lib/achievementUtils';
import { loadAchievementCatalog, requestAchievementCheck, resetAchievementCatalogCache } from '../../lib/achievementApi';
import { CONTENT_IMAGE_ACCEPT, uploadContentImage, validateContentImageInput } from '../../lib/contentImageUtils';
import { invalidateRecentAchievementImagesCache } from '../../hooks/useRecentAchievementImages';

const ROLE_LABELS: Record<UserRole, string> = { student: 'Ученик', admin: 'Админ', superadmin: 'Суперадмин' };
const INPUT_CLASS = 'w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-400/60';
const newCode = () => `personal_${crypto.randomUUID().replace(/-/g, '')}`;

export default function AchievementsGrantTab() {
  const { user } = useAuth();
  const { toast } = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [definitions, setDefinitions] = useState<AchievementDefinition[]>([]);
  const [code, setCode] = useState(newCode);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hint, setHint] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [preview, setPreview] = useState<AchievementUnlock[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [people, catalog] = await Promise.all([
        supabase.from('user_profiles').select('*').in('role', ['student', 'admin', 'superadmin']).order('display_name'),
        loadAchievementCatalog({ forceRefresh: true, strict: true }),
      ]);
      if (people.error) throw people.error;
      setProfiles((people.data ?? []) as UserProfile[]);
      setDefinitions(catalog.filter((definition) => !definition.is_system));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!imageFile) { setLocalImageUrl(null); return; }
    const url = URL.createObjectURL(imageFile);
    setLocalImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const imageSrc = localImageUrl ?? achievementImageSrc(imageUrl);
  const selectedProfiles = useMemo(() => profiles.filter((p) => selectedIds.includes(p.id)), [profiles, selectedIds]);
  const pickerRows: PickerRow[] = useMemo(() => profiles
    .filter((profile) => roleFilter === 'all' || profile.role === roleFilter)
    .map((profile) => ({
      id: profile.id,
      title: `${profileDisplayName(profile)}${profile.id === user?.id ? ' (вы)' : ''}`,
      subtitle: profileAccountLabel(profile, null),
      searchText: `${profileDisplayName(profile)} ${profileAccountLabel(profile, null) ?? ''} ${profile.role} ${ROLE_LABELS[profile.role]}`,
      disabled: submitting,
      leading: <UserAvatar displayName={profileDisplayName(profile)} avatarUrl={profile.avatar_url} size="chip" userId={profile.id} />,
      trailing: <span className="text-[10px] text-slate-400 shrink-0">{ROLE_LABELS[profile.role]}</span>,
    })), [profiles, roleFilter, submitting, user?.id]);

  const chooseDefinition = (definition: AchievementDefinition | null) => {
    if (submitting) return;
    setSelectedCode(definition?.code ?? null);
    setCode(definition?.code ?? newCode());
    setTitle(definition?.title ?? '');
    setDescription(definition?.description ?? '');
    setHint(definition?.hint ?? '');
    setImageUrl(definition?.image_url ?? '');
    setImageFile(null);
  };

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const error = validateContentImageInput(file);
    if (error) { toast(error, 'error'); return; }
    setImageFile(file);
  };

  const toggleRecipient = (id: string) => {
    if (!submitting) setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };

  const save = async () => {
    if (submitting || !user) return;
    if (!title.trim()) { toast('Введите название награды', 'warning'); return; }
    const recipientIds = [...selectedIds];
    setSubmitting(true);
    try {
      let savedImageUrl = imageUrl.trim();
      if (imageFile) {
        setUploading(true);
        const result = await uploadContentImage(user.id, imageFile);
        setUploading(false);
        if (result.error || !result.url) { toast(result.error ?? 'Не удалось загрузить картинку', 'error'); return; }
        savedImageUrl = result.url;
        setImageUrl(savedImageUrl);
        setImageFile(null);
      }
      const existing = definitions.find((definition) => definition.code === code);
      const { data, error } = await supabase.rpc('superadmin_grant_personal_achievement', {
        p_code: code,
        p_title: title.trim(),
        p_description: description.trim(),
        p_hint: hint.trim(),
        p_image_url: savedImageUrl,
        p_sort_order: existing?.sort_order ?? 100 + definitions.length,
        p_staff_ok: true,
        p_recipient_ids: recipientIds,
      });
      if (error) { toast(error.message, 'error'); return; }
      const result = data as { ok?: boolean; awarded?: number; error?: string } | null;
      if (!result?.ok) { toast('Не удалось сохранить награду. Попробуйте ещё раз.', 'error'); return; }
      setSelectedCode(code);
      const savedDefinition: AchievementDefinition = {
        code,
        title: title.trim(),
        description: description.trim(),
        hint: hint.trim(),
        image_url: savedImageUrl,
        sort_order: existing?.sort_order ?? 100 + definitions.length,
        is_system: false,
        staff_ok: true,
      };
      setDefinitions((current) => [...current.filter((definition) => definition.code !== code), savedDefinition]
        .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)));
      resetAchievementCatalogCache();
      const catalog = await loadAchievementCatalog();
      if (catalog.some((definition) => definition.code === code)) {
        setDefinitions(catalog.filter((definition) => !definition.is_system));
      }
      recipientIds.forEach((id) => invalidateRecentAchievementImagesCache(id));
      requestAchievementCheck();
      setSelectedIds([]);
      toast(recipientIds.length
        ? `Награда сохранена. Новых выдач: ${result.awarded ?? 0} из ${recipientIds.length}. Повторно награда не начисляется.`
        : 'Награда сохранена. Её можно выдать сейчас или позже.', 'success');
    } catch {
      toast('Не удалось сохранить награду. Проверьте соединение и попробуйте ещё раз.', 'error');
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 aria-label="Загружаем награды" className="w-8 h-8 text-violet-400 animate-spin" /></div>;
  if (loadError) return <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-3"><p className="text-slate-300">Не удалось загрузить награды и список людей.</p><button type="button" onClick={() => { void load(); }} className="text-violet-300 hover:text-white text-sm">Попробовать снова</button></div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Medal className="w-6 h-6 text-violet-300" />Награды</h2>
        <p className="text-sm text-slate-400 mt-2">Создайте награду или выберите готовую, затем отметьте, кому её выдать.</p>
      </div>

      <section className="space-y-3" aria-label="Выбор награды">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Созданные награды{definitions.length > 0 ? ` · ${definitions.length}` : ''}</h3>
          <button type="button" disabled={submitting} onClick={() => chooseDefinition(null)} aria-pressed={!selectedCode} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium border transition-colors disabled:opacity-50 ${!selectedCode ? 'border-violet-400/40 bg-violet-500/20 text-violet-200' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}><Plus className="w-4 h-4" />Новая награда</button>
        </div>
        {definitions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
            {definitions.map((definition) => (
              <button type="button" key={definition.code} disabled={submitting} aria-pressed={selectedCode === definition.code} onClick={() => chooseDefinition(definition)} className={`flex items-center gap-3 p-3 rounded-xl border text-left min-w-0 transition-colors disabled:opacity-50 ${selectedCode === definition.code ? 'bg-violet-500/15 border-violet-400/50' : 'bg-slate-900/60 border-white/10 hover:border-white/25'}`}>
                <AchievementImage code={definition.code} imageSrc={achievementImageSrc(definition.image_url)} className="w-11 h-11 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white truncate">{definition.title}</span><span className="block text-xs text-slate-500 truncate">{definition.description || 'Персональная награда'}</span></span>
                {selectedCode === definition.code && <Check className="w-4 h-4 text-violet-300 shrink-0" />}
              </button>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">Здесь появятся ваши награды. Создайте первую ниже.</p>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-5 items-start">
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6 space-y-5" aria-labelledby="award-editor-title">
          <h3 id="award-editor-title" className="font-semibold text-white">{selectedCode ? 'Редактировать награду' : 'Новая награда'}</h3>
          <fieldset disabled={submitting} className="space-y-5 disabled:opacity-60">
            <label className="block space-y-2"><span className="text-sm text-slate-300">Название</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, «Вопрос науке»" maxLength={120} className={INPUT_CLASS} /></label>
            <label className="block space-y-2"><span className="text-sm text-slate-300">За что выдаётся</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Расскажите, чем отличился человек" rows={3} maxLength={600} className={`${INPUT_CLASS} resize-y`} /></label>
            <div className="space-y-2">
              <span className="text-sm text-slate-300">Картинка награды</span>
              <label className="flex items-center gap-3 rounded-xl border border-dashed border-violet-400/30 bg-violet-500/5 p-4 cursor-pointer hover:bg-violet-500/10 transition-colors focus-within:ring-2 focus-within:ring-violet-400">
                <ImagePlus className="w-6 h-6 text-violet-300 shrink-0" /><span className="min-w-0"><span className="block text-sm font-medium text-violet-200 truncate">{imageFile?.name ?? (imageUrl ? 'Заменить картинку' : 'Загрузить картинку')}</span><span className="block text-xs text-slate-500 mt-1">PNG, JPG, WebP или GIF · до 5 МБ</span></span>
                <input type="file" accept={CONTENT_IMAGE_ACCEPT} onChange={pickImage} className="sr-only" aria-label="Загрузить картинку награды" />
              </label>
              {imageSrc && <button type="button" onClick={() => { setImageFile(null); setImageUrl(''); }} className="text-xs text-slate-400 hover:text-rose-300">Убрать картинку</button>}
              <details className="text-xs text-slate-500"><summary className="cursor-pointer py-1 hover:text-slate-300">Или использовать ссылку</summary><input aria-label="Ссылка на картинку награды" value={imageUrl} onChange={(event) => { setImageFile(null); setImageUrl(event.target.value); }} placeholder="https://…" className={`${INPUT_CLASS} mt-2`} /></details>
            </div>
            <details className="text-sm text-slate-400"><summary className="cursor-pointer hover:text-slate-200">Подсказка о получении · необязательно</summary><label className="block mt-3 space-y-2"><span className="text-xs text-slate-500">Увидят те, у кого этой награды ещё нет.</span><textarea aria-label="Как получить награду" value={hint} onChange={(event) => setHint(event.target.value)} rows={2} placeholder="Что нужно сделать, чтобы получить эту награду" className={`${INPUT_CLASS} resize-y`} /></label></details>
          </fieldset>
        </section>

        <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-900/20 to-slate-900/50 p-5 sm:p-6 text-center overflow-hidden" aria-label="Предпросмотр награды">
          <p className="text-xs font-medium text-slate-500 mb-4">Так будет выглядеть награда</p>
          <div className="relative mx-auto w-36 h-36 flex items-center justify-center"><div className="absolute inset-4 rounded-full bg-violet-500/20 blur-2xl" /><AchievementImage code={code} imageSrc={imageSrc} className="relative w-32 h-32" /></div>
          <h3 className="text-xl font-bold text-white mt-4 break-words">{title.trim() || 'Название награды'}</h3>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed whitespace-pre-wrap break-words">{description.trim() || 'Здесь появится описание — за что вы вручаете эту награду.'}</p>
          <button type="button" onClick={() => setPreview([{ id: `preview-${crypto.randomUUID()}`, code, title: title.trim() || 'Название награды', description: description.trim(), imageSrc }])} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-slate-200 px-4 py-2.5 mt-5"><Eye className="w-4 h-4" />Посмотреть окно получения</button>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6 space-y-4" aria-labelledby="award-recipients-title">
        <div className="flex items-start justify-between gap-3"><div><h3 id="award-recipients-title" className="font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-blue-300" />Кому выдать</h3><p className="text-xs text-slate-500 mt-1.5">Ученикам, админам и суперадминам — в том числе себе. Можно сохранить без выдачи.</p></div>{selectedIds.length > 0 && <button type="button" disabled={submitting} onClick={() => setSelectedIds([])} className="text-xs text-slate-400 hover:text-white shrink-0 py-1 disabled:opacity-50">Снять выбор</button>}</div>
        <div className="flex flex-wrap gap-2" aria-label="Фильтр по роли">
          {(['all', 'student', 'admin', 'superadmin'] as const).map((role) => <button key={role} type="button" aria-pressed={roleFilter === role} onClick={() => setRoleFilter(role)} className={`rounded-lg px-3 py-1.5 text-xs border transition-colors ${roleFilter === role ? 'bg-blue-500/15 border-blue-400/40 text-blue-200' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>{role === 'all' ? 'Все' : role === 'student' ? 'Ученики' : role === 'admin' ? 'Админы' : 'Суперадмины'}</button>)}
        </div>
        {selectedProfiles.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Выбранные получатели">{selectedProfiles.map((profile) => <button key={profile.id} type="button" disabled={submitting} onClick={() => toggleRecipient(profile.id)} aria-label={`Убрать ${profileDisplayName(profile)} из получателей`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-violet-500/15 border border-violet-400/20 px-2.5 py-1 text-xs text-violet-200 disabled:opacity-50"><span className="truncate">{profileDisplayName(profile)}</span><X className="w-3 h-3 shrink-0" /></button>)}</div>}
        <SearchableCheckboxList items={pickerRows} selectedIds={selectedIds} onToggle={toggleRecipient} searchPlaceholder="Найти человека по имени или логину…" emptyText="В этой группе пока нет пользователей" selectedLabel={(count) => `Выбрано: ${count}`} />
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between pb-2">
        <p className="text-xs text-slate-500 max-w-md">{selectedIds.length ? `Награда появится в личном кабинете выбранных людей. Получателей: ${selectedIds.length}.` : 'Сохраните награду в коллекцию, чтобы выдать её позже.'}</p>
        <button type="button" onClick={() => { void save(); }} disabled={submitting || !title.trim()} className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Medal className="w-4 h-4" />}{uploading ? 'Загружаем картинку…' : submitting ? 'Сохраняем…' : selectedIds.length ? `Сохранить и выдать · ${selectedIds.length}` : selectedCode ? 'Сохранить изменения' : 'Сохранить награду'}</button>
      </div>
      {preview.length > 0 && <AchievementUnlockDialog items={preview} onDismiss={() => setPreview([])} onClosed={() => setPreview([])} />}
    </div>
  );
}
