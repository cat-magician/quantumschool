import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, CalendarClock, CheckCircle, ChevronDown, ChevronUp,
  FlaskConical, GripVertical, Loader2, Plus, Save, Trash2,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import {
  DEFAULT_LANDING_CONFIG,
  KEY_DATES_LIMITS,
  fetchLandingConfig,
  formatHeroBadgeText,
  normalizeKeyDates,
  saveKeyDates,
  saveLandingConfig,
} from '../../lib/landingConfig';
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
  isInstructorPublishable,
} from '../../lib/siteContentLimits';
import { supabase } from '../../lib/supabase';
import type { Instructor, KeyDate } from '../../lib/types';
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

function draftFromRow(row: Instructor): InstructorDraft {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    bio: row.bio,
    image_url: row.image_url,
  };
}

function draftMatchesRow(draft: InstructorDraft, row: Instructor) {
  return (
    draft.name.trim() === row.name.trim() &&
    draft.title.trim() === row.title.trim() &&
    draft.bio.trim() === row.bio.trim() &&
    draft.image_url.trim() === row.image_url.trim()
  );
}

function reorderList<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
  if (fromId === toId) return items;
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) return items;

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

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
  const [keyDatesTitle, setKeyDatesTitle] = useState(DEFAULT_LANDING_CONFIG.key_dates_title);
  const [keyDatesNote, setKeyDatesNote] = useState(DEFAULT_LANDING_CONFIG.key_dates_note);
  const [keyDateItems, setKeyDateItems] = useState<KeyDate[]>([]);
  const [keyDatesPublished, setKeyDatesPublished] = useState(false);
  const [savingKeyDates, setSavingKeyDates] = useState(false);
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
  const [savingAll, setSavingAll] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const pendingOrderRef = useRef<Instructor[]>([]);
  const orderAtDragStartRef = useRef<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const applyInstructorRows = (rows: Instructor[]) => {
    setInstructors(rows);
    setDrafts(Object.fromEntries(rows.map((row) => [row.id, draftFromRow(row)])));
  };

  const loadInstructors = async () => {
    const instructorsRes = await supabase.from('instructors').select('*').order('sort_order');
    if (instructorsRes.error) {
      setError('Не удалось загрузить карточки преподавателей');
      return false;
    }
    applyInstructorRows((instructorsRes.data ?? []) as Instructor[]);
    return true;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    const [landingConfig, communityConfig, instructorsOk] = await Promise.all([
      fetchLandingConfig(),
      fetchCommunityConfig(),
      loadInstructors(),
    ]);

    setBadgeText(landingConfig.hero_badge_text);
    setKeyDatesTitle(landingConfig.key_dates_title);
    setKeyDatesNote(landingConfig.key_dates_note);
    setKeyDateItems(landingConfig.key_dates);
    setKeyDatesPublished(landingConfig.key_dates_published);
    setTelegramUrl(communityConfig.telegram_invite_url);
    setTelegramMessage(communityConfig.telegram_invite_message);
    if (!instructorsOk) {
      setError('Не удалось загрузить карточки преподавателей');
    }
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

  const patchKeyDate = (index: number, patch: Partial<KeyDate>) => {
    setKeyDateItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addKeyDate = () => {
    setKeyDateItems((prev) => (
      prev.length >= KEY_DATES_LIMITS.items ? prev : [...prev, { date: '', label: '' }]
    ));
  };

  const removeKeyDate = (index: number) => {
    setKeyDateItems((prev) => prev.filter((_, i) => i !== index));
  };

  const moveKeyDate = (index: number, delta: -1 | 1) => {
    setKeyDateItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  /** published приходит явно: «Сохранить» оставляет текущее состояние блока. */
  const persistKeyDates = async (published: boolean) => {
    if (!user) return;
    const items = normalizeKeyDates(keyDateItems);

    if (published && items.length === 0) {
      setError('Добавьте хотя бы одну дату — публиковать пустой блок нечего');
      return;
    }

    setSavingKeyDates(true);
    setError('');
    const { error: saveError } = await saveKeyDates(
      { title: keyDatesTitle, note: keyDatesNote, items, published },
      user.id,
    );
    setSavingKeyDates(false);

    if (saveError) {
      setError('Не удалось сохранить даты. Примените миграцию landing_config в schema.sql.');
      return;
    }

    if (published) flash('Блок с датами опубликован на главной');
    else if (keyDatesPublished) flash('Блок снят с публикации — на главной его больше нет');
    else flash('Черновик сохранён, на главной блока пока нет');

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

  const dirtyInstructorIds = useMemo(
    () =>
      instructors
        .filter((row) => {
          const draft = drafts[row.id];
          return draft && !draftMatchesRow(draft, row);
        })
        .map((row) => row.id),
    [drafts, instructors],
  );

  const persistInstructorDraft = async (id: string, draft: InstructorDraft) => {
    const payload = {
      name: draft.name.trim(),
      title: draft.title.trim(),
      bio: draft.bio.trim(),
      image_url: draft.image_url.trim(),
    };

    const { error: saveError } = await supabase.from('instructors').update(payload).eq('id', id);
    if (saveError) return false;

    setInstructors((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...payload } : row)),
    );
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...payload } }));
    return true;
  };

  const handleSaveInstructor = async (id: string) => {
    const draft = drafts[id];
    if (!draft || !validateDraft(draft)) return;

    setSavingId(id);
    setError('');
    const ok = await persistInstructorDraft(id, draft);
    setSavingId(null);

    if (!ok) {
      setError('Не удалось сохранить карточку преподавателя');
      return;
    }

    flash('Карточка опубликована на главной');
  };

  const handleSaveAllInstructors = async () => {
    if (!dirtyInstructorIds.length) return;

    const invalidId = dirtyInstructorIds.find((id) => {
      const draft = drafts[id];
      return !draft || !isInstructorPublishable(draft);
    });
    if (invalidId) {
      setError('У каждой изменённой карточки должны быть имя, должность и фото');
      return;
    }

    setSavingAll(true);
    setError('');
    const results = await Promise.all(
      dirtyInstructorIds.map((id) => persistInstructorDraft(id, drafts[id])),
    );
    setSavingAll(false);

    if (results.some((ok) => !ok)) {
      setError('Не удалось сохранить часть карточек');
      return;
    }

    flash(
      dirtyInstructorIds.length === 1
        ? 'Карточка опубликована на главной'
        : `Опубликовано карточек: ${dirtyInstructorIds.length}`,
    );
  };

  const handleCreateInstructor = async () => {
    if (!newDraft || !validateDraft(newDraft)) return;

    setCreating(true);
    setError('');
    const nextOrder = instructors.length
      ? Math.max(...instructors.map((i) => i.sort_order ?? 0)) + 1
      : 1;

    const { data, error: createError } = await supabase
      .from('instructors')
      .insert({
        name: newDraft.name.trim(),
        title: newDraft.title.trim(),
        bio: newDraft.bio.trim(),
        image_url: newDraft.image_url.trim(),
        specialization: '',
        specializations: [],
        role: 'lecturer',
        sort_order: nextOrder,
      })
      .select('*')
      .single();

    setCreating(false);
    if (createError || !data) {
      setError('Не удалось добавить преподавателя');
      return;
    }

    const created = data as Instructor;
    setInstructors((prev) => [...prev, created]);
    setDrafts((prev) => ({ ...prev, [created.id]: draftFromRow(created) }));
    setNewDraft(null);
    setExpandedId(null);
    flash('Преподаватель опубликован на главной');
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

    setInstructors((prev) => prev.filter((row) => row.id !== id));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (expandedId === id) setExpandedId(null);
    flash('Карточка удалена с главной');
  };

  const persistInstructorOrder = async (ordered: Instructor[]) => {
    const withOrder = ordered.map((row, index) => ({ ...row, sort_order: index + 1 }));
    setInstructors(withOrder);

    setReordering(true);
    setError('');
    const results = await Promise.all(
      withOrder.map((row) =>
        supabase.from('instructors').update({ sort_order: row.sort_order }).eq('id', row.id),
      ),
    );
    setReordering(false);

    if (results.some(({ error: orderError }) => orderError)) {
      setError('Не удалось сохранить порядок карточек');
      await loadInstructors();
      return;
    }

    flash('Порядок карточек сохранён');
  };

  const handleDragStart = (id: string) => {
    pendingOrderRef.current = instructors;
    orderAtDragStartRef.current = instructors.map((row) => row.id);
    setDragId(id);
    setDropTargetId(id);
  };

  const handleDragOver = (event: React.DragEvent, targetId: string) => {
    event.preventDefault();
    if (!dragId || dragId === targetId) return;

    setDropTargetId(targetId);
    const next = reorderList(pendingOrderRef.current, dragId, targetId);
    pendingOrderRef.current = next;
    setInstructors(next);
  };

  const handleDragEnd = async () => {
    const ordered = pendingOrderRef.current;
    const orderChanged =
      ordered.map((row) => row.id).join('|') !== orderAtDragStartRef.current.join('|');
    setDragId(null);
    setDropTargetId(null);
    if (!orderChanged) return;
    await persistInstructorOrder(ordered);
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
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-white">Ключевые даты на главной</h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
              keyDatesPublished
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                : 'text-slate-400 bg-white/5 border-white/10'
            }`}>
              {keyDatesPublished ? <CheckCircle className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
              {keyDatesPublished ? 'Опубликовано' : 'Черновик'}
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Блок со сроками приёма — сразу под hero. «Сохранить» правит черновик и на сайт
            ничего не выносит, «Опубликовать» показывает блок посетителям.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">Заголовок блока</span>
          <input
            value={keyDatesTitle}
            onChange={(e) => setKeyDatesTitle(e.target.value.slice(0, KEY_DATES_LIMITS.title))}
            placeholder={DEFAULT_LANDING_CONFIG.key_dates_title}
            className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-300">
            Даты <span className="text-slate-500 font-normal">— порядок карточек сверху вниз</span>
          </span>

          {keyDateItems.length === 0 && (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center">
              Пока ни одной даты. Добавьте первую — до этого блок публиковать нечего.
            </p>
          )}

          {keyDateItems.map((item, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3"
            >
              <input
                value={item.date}
                onChange={(e) => patchKeyDate(index, { date: e.target.value.slice(0, KEY_DATES_LIMITS.date) })}
                placeholder="до 20 сентября"
                aria-label={`Срок, строка ${index + 1}`}
                className="sm:w-52 rounded-lg bg-slate-950 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <input
                value={item.label}
                onChange={(e) => patchKeyDate(index, { label: e.target.value.slice(0, KEY_DATES_LIMITS.label) })}
                placeholder="Мотивационное письмо и анкета"
                aria-label={`Что происходит, строка ${index + 1}`}
                className="flex-1 min-w-0 rounded-lg bg-slate-950 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveKeyDate(index, -1)}
                  disabled={index === 0}
                  aria-label={`Поднять строку ${index + 1}`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveKeyDate(index, 1)}
                  disabled={index === keyDateItems.length - 1}
                  aria-label={`Опустить строку ${index + 1}`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeKeyDate(index)}
                  aria-label={`Удалить строку ${index + 1}`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addKeyDate}
            disabled={keyDateItems.length >= KEY_DATES_LIMITS.items}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Добавить дату
          </button>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">
            Примечание под блоком <span className="text-slate-500 font-normal">— необязательно</span>
          </span>
          <textarea
            value={keyDatesNote}
            onChange={(e) => setKeyDatesNote(e.target.value.slice(0, KEY_DATES_LIMITS.note))}
            rows={2}
            placeholder="Например: даты могут уточняться, следите за объявлениями"
            className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 resize-y min-h-[3.5rem]"
          />
        </label>

        {normalizeKeyDates(keyDateItems).length > 0 && (
          <div className="rounded-xl bg-slate-950/60 border border-white/10 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Предпросмотр</p>
            <div className="flex items-center gap-2 text-blue-300 text-xs mb-3">
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Сроки приёма</span>
            </div>
            <p className="text-white font-bold mb-3">
              {keyDatesTitle.trim() || DEFAULT_LANDING_CONFIG.key_dates_title}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {normalizeKeyDates(keyDateItems).map((item, index) => (
                <div
                  key={index}
                  className="relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-3 pl-4"
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-violet-600"
                  />
                  {item.date && <div className="text-sm font-semibold text-white">{item.date}</div>}
                  {item.label && <div className="text-xs text-slate-400 mt-0.5">{item.label}</div>}
                </div>
              ))}
            </div>
            {keyDatesNote.trim() && (
              <p className="text-xs text-slate-500 mt-3">{keyDatesNote.trim()}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { void persistKeyDates(keyDatesPublished); }}
            disabled={savingKeyDates}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
          >
            {savingKeyDates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
          <button
            type="button"
            onClick={() => { void persistKeyDates(true); }}
            disabled={savingKeyDates}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {keyDatesPublished ? 'Опубликовать изменения' : 'Опубликовать'}
          </button>
          {keyDatesPublished && (
            <button
              type="button"
              onClick={() => { void persistKeyDates(false); }}
              disabled={savingKeyDates}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
            >
              Снять с публикации
            </button>
          )}
        </div>
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
              Перетаскивайте карточки за ручку слева, чтобы изменить порядок на главной.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {dirtyInstructorIds.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAllInstructors}
                disabled={savingAll || Boolean(savingId) || reordering}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {savingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить все ({dirtyInstructorIds.length})
              </button>
            )}
            {!newDraft && (
              <button
                type="button"
                onClick={() => {
                  setNewDraft(emptyDraft());
                  setExpandedId('new');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            )}
          </div>
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
              drafts[instructor.id] ?? draftFromRow(instructor);
            const isOpen = expandedId === instructor.id;
            const isDirty = !draftMatchesRow(draft, instructor);
            const isDragging = dragId === instructor.id;
            const isDropTarget = dropTargetId === instructor.id && dragId !== instructor.id;

            return (
              <div
                key={instructor.id}
                onDragOver={(event) => handleDragOver(event, instructor.id)}
                className={`rounded-xl border bg-slate-950/40 overflow-hidden transition-colors ${
                  isDragging
                    ? 'border-blue-400/40 opacity-60'
                    : isDropTarget
                      ? 'border-blue-400/60'
                      : 'border-white/10'
                }`}
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => handleDragStart(instructor.id)}
                    onDragEnd={() => void handleDragEnd()}
                    disabled={reordering || savingAll}
                    className="flex items-center justify-center px-2 text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] cursor-grab active:cursor-grabbing disabled:opacity-40 shrink-0"
                    aria-label="Перетащить для изменения порядка"
                    title="Перетащите для изменения порядка"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : instructor.id)}
                    className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors min-w-0"
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                      {draft.image_url.trim() ? (
                        <LessonCoverImage url={draft.image_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{draft.name.trim() || 'Без имени'}</p>
                        {isDirty && (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-400 shrink-0">
                            не сохранено
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{draft.title.trim() || 'Должность не указана'}</p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>
                </div>

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
