import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import { DEFAULT_LANDING_CONFIG, fetchLandingConfig, formatHeroBadgeText, saveLandingConfig } from '../../lib/landingConfig';
import {
  DEFAULT_COMMUNITY_CONFIG,
  fetchCommunityConfig,
  normalizeTelegramInviteUrl,
  saveCommunityConfig,
} from '../../lib/communityConfig';
import HeroBadgePill from '../../components/HeroBadgePill';
import {
  clampInstructorField,
  INSTRUCTOR_BIO_EXPAND_HINT,
  INSTRUCTOR_FIELD_LIMITS,
  COMMUNITY_FIELD_LIMITS,
} from '../../lib/siteContentLimits';
import { supabase } from '../../lib/supabase';
import type { Instructor } from '../../lib/types';
import LessonCoverImage from '../../components/LessonCoverImage';
import InstructorCardPreview, { INSTRUCTOR_CARD_WIDTH } from '../../components/InstructorCardPreview';
import ImageSourceInput from '../../components/ImageSourceInput';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';

type InstructorDraft = {
  id?: string;
  name: string;
  title: string;
  bio: string;
  image_url: string;
};

const emptyDraft = (): InstructorDraft => ({ name: '', title: '', bio: '', image_url: '' });

function FieldCounter({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  return (
    <span className={`text-xs tabular-nums ${left < 20 ? 'text-amber-400' : 'text-slate-500'}`}>
      {value.length}/{max}
    </span>
  );
}

export default function SiteContentTab() {
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const [badgeText, setBadgeText] = useState(DEFAULT_LANDING_CONFIG.hero_badge_text);
  const [telegramUrl, setTelegramUrl] = useState(DEFAULT_COMMUNITY_CONFIG.telegram_invite_url);
  const [telegramMessage, setTelegramMessage] = useState(DEFAULT_COMMUNITY_CONFIG.telegram_invite_message);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [drafts, setDrafts] = useState<Record<string, InstructorDraft>>({});
  const [newDraft, setNewDraft] = useState<InstructorDraft | null>(null);
  const [expandedId, setExpandedId] = useState<string | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBadge, setSavingBadge] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const [landingConfig, communityConfig, instructorsRes] = await Promise.all([
      fetchLandingConfig(),
      fetchCommunityConfig(),
      supabase.from('instructors').select('*').order('sort_order'),
    ]);

    setBadgeText(landingConfig.hero_badge_text);
    setTelegramUrl(communityConfig.telegram_invite_url);
    setTelegramMessage(communityConfig.telegram_invite_message);
    const rows = (instructorsRes.data ?? []) as Instructor[];
    setInstructors(rows);
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            id: row.id,
            name: row.name,
            title: row.title,
            bio: row.bio,
            image_url: row.image_url,
          },
        ]),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (message: string) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(''), 3500);
  };

  const validateDraft = (draft: InstructorDraft) => {
    if (!draft.name.trim() || !draft.title.trim() || !draft.image_url.trim()) {
      setError('Заполните имя, должность и ссылку на фото');
      return false;
    }
    return true;
  };

  const handleSaveBadge = async () => {
    if (!user) return;
    const trimmed = formatHeroBadgeText(badgeText);
    if (!trimmed) {
      setError('Текст плашки не может быть пустым');
      return;
    }

    setSavingBadge(true);
    setError('');
    const { error: saveError } = await saveLandingConfig(trimmed, user.id);
    setSavingBadge(false);

    if (saveError) {
      setError('Не удалось сохранить плашку. Примените миграцию landing_config.');
      return;
    }

    flash('Плашка опубликована на главной');
    setBadgeText(trimmed);
    await load();
  };

  const handleSaveTelegram = async () => {
    if (!user) return;
    const trimmedUrl = telegramUrl.trim();
    if (trimmedUrl && !normalizeTelegramInviteUrl(trimmedUrl)) {
      setError('Ссылка на Telegram должна быть вида https://t.me/… или t.me/+…');
      return;
    }
    if (!telegramMessage.trim()) {
      setError('Добавьте текст сообщения для учеников');
      return;
    }

    setSavingTelegram(true);
    setError('');
    const { error: saveError } = await saveCommunityConfig(
      {
        telegram_invite_url: trimmedUrl,
        telegram_invite_message: telegramMessage.slice(0, COMMUNITY_FIELD_LIMITS.telegramMessage),
      },
      user.id,
    );
    setSavingTelegram(false);

    if (saveError) {
      setError('Не удалось сохранить. Примените миграцию community_config в schema.sql.');
      return;
    }

    flash('Telegram-канал опубликован для зачисленных учеников');
    await load();
  };

  const handleSaveInstructor = async (id: string) => {
    const draft = drafts[id];
    if (!draft || !validateDraft(draft)) return;

    setSavingId(id);
    setError('');
    const { error: saveError } = await supabase
      .from('instructors')
      .update({
        name: draft.name.trim(),
        title: draft.title.trim(),
        bio: draft.bio.trim(),
        image_url: draft.image_url.trim(),
      })
      .eq('id', id);

    setSavingId(null);
    if (saveError) {
      setError('Не удалось сохранить карточку преподавателя');
      return;
    }

    flash('Карточка опубликована на главной');
    await load();
  };

  const handleCreateInstructor = async () => {
    if (!newDraft || !validateDraft(newDraft)) return;

    setCreating(true);
    setError('');
    const nextOrder = instructors.length
      ? Math.max(...instructors.map((i) => i.sort_order ?? 0)) + 1
      : 1;

    const { error: createError } = await supabase.from('instructors').insert({
      name: newDraft.name.trim(),
      title: newDraft.title.trim(),
      bio: newDraft.bio.trim(),
      image_url: newDraft.image_url.trim(),
      specialization: '',
      specializations: [],
      role: 'lecturer',
      sort_order: nextOrder,
    });

    setCreating(false);
    if (createError) {
      setError('Не удалось добавить преподавателя');
      return;
    }

    setNewDraft(null);
    setExpandedId(null);
    flash('Преподаватель опубликован на главной');
    await load();
  };

  const handleDeleteInstructor = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Удалить с главной?',
      message: `Карточка «${name || 'преподавателя'}» исчезнет с сайта сразу после подтверждения.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;

    setDeletingId(id);
    setError('');
    const { error: deleteError } = await supabase.from('instructors').delete().eq('id', id);
    setDeletingId(null);

    if (deleteError) {
      setError('Не удалось удалить карточку');
      return;
    }

    flash('Карточка удалена с главной');
    await load();
  };

  const updateDraft = (id: string, patch: Partial<InstructorDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Контент платформы</h2>
        <p className="text-slate-400 text-sm">
          Главная страница сайта и материалы для зачисленных учеников. Изменения публикуются сразу после сохранения.
        </p>
        <SectionHint text={SECTION_HINT.admin.content} className="mt-1.5" />
      </div>

      {(error || success) && (
        <div className={`rounded-xl px-4 py-3 text-sm ${error ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
          {error || success}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Плашка в hero-блоке</h3>
          <p className="text-slate-400 text-sm">
            Шрифт и оформление фиксированы. Длина плашки подстроится под текст; на сайте он всегда показывается ЗАГЛАВНЫМИ буквами.
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/60 border border-white/10 p-4 flex justify-center overflow-hidden">
          <HeroBadgePill text={badgeText} emptyLabel="Текст плашки" />
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">Текст плашки</span>
          <textarea
            value={badgeText}
            onChange={(e) => setBadgeText(e.target.value)}
            rows={2}
            className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 resize-y min-h-[3.5rem]"
            placeholder="ОТКРЫТ НАБОР НА КУРС 2026-2027 ГОДА"
          />
        </label>

        <button
          type="button"
          onClick={handleSaveBadge}
          disabled={savingBadge}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {savingBadge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить и опубликовать плашку
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Telegram-канал для учеников</h3>
          <p className="text-slate-400 text-sm max-w-2xl">
            Ссылка и текст показываются только зачисленным участникам — на главной странице личного кабинета
            и в разделе «Результаты» после зачисления. На публичном сайте канал не отображается.
          </p>
        </div>

        <label className="block space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-300">Ссылка-приглашение</span>
            <FieldCounter value={telegramUrl} max={COMMUNITY_FIELD_LIMITS.telegramUrl} />
          </div>
          <input
            value={telegramUrl}
            onChange={(e) => setTelegramUrl(e.target.value.slice(0, COMMUNITY_FIELD_LIMITS.telegramUrl))}
            maxLength={COMMUNITY_FIELD_LIMITS.telegramUrl}
            className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
            placeholder="https://t.me/+… или t.me/your_channel"
          />
          <p className="text-[11px] text-slate-500">
            Оставьте пустым, чтобы скрыть блок у учеников.
          </p>
        </label>

        <label className="block space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-300">Текст для учеников</span>
            <FieldCounter value={telegramMessage} max={COMMUNITY_FIELD_LIMITS.telegramMessage} />
          </div>
          <textarea
            value={telegramMessage}
            onChange={(e) => setTelegramMessage(e.target.value.slice(0, COMMUNITY_FIELD_LIMITS.telegramMessage))}
            maxLength={COMMUNITY_FIELD_LIMITS.telegramMessage}
            rows={3}
            className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 resize-y min-h-[4.5rem]"
            placeholder="Кратко объясните, зачем вступать в канал"
          />
        </label>

        {telegramUrl.trim() && normalizeTelegramInviteUrl(telegramUrl) && (
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Как увидят ученики</p>
            <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-600/15 to-blue-600/5 overflow-hidden">
              <div className="px-6 py-6">
                <h4 className="text-lg font-bold text-white mb-1">Telegram-канал кружка</h4>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{telegramMessage.trim()}</p>
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold">
                  Перейти в канал
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveTelegram}
          disabled={savingTelegram}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {savingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить Telegram-канал
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Преподаватели на сайте</h3>
            <p className="text-slate-400 text-sm max-w-xl">
              Фото — сверху карточки, как в карусели на главной. Длинное описание на сайте
              сворачивается до трёх строк; посетитель развернёт его кнопкой «Читать далее» прямо в карточке.
            </p>
          </div>
          {!newDraft && (
            <button
              type="button"
              onClick={() => {
                setNewDraft(emptyDraft());
                setExpandedId('new');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-sm font-medium transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          )}
        </div>

        {newDraft && expandedId === 'new' && (
          <InstructorEditor
            draft={newDraft}
            onChange={setNewDraft}
            onSave={handleCreateInstructor}
            onCancel={() => {
              setNewDraft(null);
              setExpandedId(null);
            }}
            saving={creating}
            saveLabel="Сохранить и опубликовать"
          />
        )}

        <div className="space-y-2">
          {instructors.map((instructor) => {
            const draft =
              drafts[instructor.id] ?? {
                name: instructor.name,
                title: instructor.title,
                bio: instructor.bio,
                image_url: instructor.image_url,
              };
            const isOpen = expandedId === instructor.id;

            return (
              <div key={instructor.id} className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : instructor.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                    {draft.image_url.trim() ? (
                      <LessonCoverImage url={draft.image_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{draft.name.trim() || 'Без имени'}</p>
                    <p className="text-xs text-slate-400 truncate">{draft.title.trim() || 'Должность не указана'}</p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-white/5 p-3 sm:p-4">
                    <InstructorEditor
                      draft={draft}
                      onChange={(next) => updateDraft(instructor.id, next)}
                      onSave={() => handleSaveInstructor(instructor.id)}
                      onDelete={() => handleDeleteInstructor(instructor.id, draft.name.trim())}
                      saving={savingId === instructor.id}
                      deleting={deletingId === instructor.id}
                      saveLabel="Сохранить и опубликовать"
                      embedded
                    />
                  </div>
                )}
              </div>
            );
          })}

          {!instructors.length && !newDraft && (
            <p className="text-slate-500 text-sm py-4 text-center">Пока нет карточек — нажмите «Добавить».</p>
          )}
        </div>
      </section>
    </div>
  );
}

function InstructorEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  onDelete,
  saving,
  deleting,
  saveLabel,
  embedded,
}: {
  draft: InstructorDraft;
  onChange: (next: InstructorDraft) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  saving?: boolean;
  deleting?: boolean;
  saveLabel: string;
  embedded?: boolean;
}) {
  const patch = (field: keyof InstructorDraft, value: string) => {
    if (field === 'name') onChange({ ...draft, name: clampInstructorField('name', value) });
    else if (field === 'title') onChange({ ...draft, title: clampInstructorField('title', value) });
    else if (field === 'bio') onChange({ ...draft, bio: clampInstructorField('bio', value) });
    else if (field === 'image_url') onChange({ ...draft, image_url: clampInstructorField('imageUrl', value) });
  };

  const inputClass =
    'w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50';

  return (
    <div className={embedded ? 'space-y-3' : 'rounded-xl border border-white/10 bg-slate-950/50 p-4 space-y-3'}>
      <div className="flex flex-col lg:flex-row gap-4 lg:items-stretch">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-300">Имя</span>
                <FieldCounter value={draft.name} max={INSTRUCTOR_FIELD_LIMITS.name} />
              </div>
              <input
                value={draft.name}
                onChange={(e) => patch('name', e.target.value)}
                maxLength={INSTRUCTOR_FIELD_LIMITS.name}
                className={inputClass}
                placeholder="Dr. Елена Волкова"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-300">Должность / звание</span>
                <FieldCounter value={draft.title} max={INSTRUCTOR_FIELD_LIMITS.title} />
              </div>
              <input
                value={draft.title}
                onChange={(e) => patch('title', e.target.value)}
                maxLength={INSTRUCTOR_FIELD_LIMITS.title}
                className={inputClass}
                placeholder="Профессор квантовой физики"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300">Описание</span>
              <FieldCounter value={draft.bio} max={INSTRUCTOR_FIELD_LIMITS.bio} />
            </div>
            <textarea
              value={draft.bio}
              onChange={(e) => patch('bio', e.target.value)}
              maxLength={INSTRUCTOR_FIELD_LIMITS.bio}
              rows={3}
              className={`${inputClass} resize-y min-h-[4.5rem]`}
              placeholder="Кратко о специализации и опыте"
            />
            <p className="text-[11px] text-slate-500">
              От ~{INSTRUCTOR_BIO_EXPAND_HINT} символов на главной появится «Читать далее» — без переходов и модальных окон.
            </p>
          </label>

          <label className="block space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300">Фото</span>
              <FieldCounter value={draft.image_url} max={INSTRUCTOR_FIELD_LIMITS.imageUrl} />
            </div>
            <ImageSourceInput
              value={draft.image_url}
              onChange={(image_url) => patch('image_url', clampInstructorField('imageUrl', image_url))}
              placeholder="https://disk.yandex.ru/i/… или загрузите файл"
              previewClassName="w-full h-32 rounded-xl object-cover border border-white/10"
            />
            <p className="text-[11px] text-slate-500">На сайте фото занимает верх карточки, обрезается по краям (object-cover).</p>
          </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4 lg:mt-auto lg:pt-4">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saveLabel}
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50 text-sm"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Удалить с главной
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 text-sm"
              >
                Отмена
              </button>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col min-w-0 w-full lg:w-auto">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Как на сайте</p>
          <div className="rounded-2xl bg-slate-100/90 p-4 w-full max-w-[258px]">
            <InstructorCardPreview
              name={draft.name}
              title={draft.title}
              bio={draft.bio}
              imageUrl={draft.image_url}
              width={INSTRUCTOR_CARD_WIDTH}
              interactive
            />
          </div>
        </div>
      </div>
    </div>
  );
}
