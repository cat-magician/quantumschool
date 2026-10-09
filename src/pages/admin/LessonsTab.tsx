import { useEffect, useMemo, useState } from 'react';
import ListSearchBar from '../../components/ListSearchBar';
import { textMatches } from '../../lib/listFilters';
import {
  ArrowDown, ArrowLeft, ArrowUp, Eye, Loader2, Plus, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import type {
  Group, LessonBlockContent, LessonBlockType, LessonPage, LessonPageBlock, LessonPageType, ScheduleEvent,
} from '../../lib/types';
import GroupMultiSelect from '../../components/GroupMultiSelect';
import { normalizeMeetingUrl } from '../../lib/meetingLinkUtils';
import { legacyGroupId } from '../../lib/groupTargeting';
import { toDatetimeLocalValue } from '../../lib/scheduleUtils';
import {
  LESSON_BLOCK_LABELS,
  LESSON_BLOCK_TYPES,
  LESSON_LIST_SELECT,
  LESSON_TYPE_LABELS,
  createDefaultBlocks,
  defaultBlockContent,
  lessonDateInputValue,
  splitLessonsByTime,
  type LessonPageWithEvent,
} from '../../lib/lessonPageUtils';
import { lessonPageLoadError, lessonPageSaveError, isSaveSuccessMessage } from '../../lib/lessonPageLoadError';
import VideoEmbed from '../../components/VideoEmbed';
import LessonPageCard from '../../components/LessonPageCard';
import DocumentSourceInput from '../../components/DocumentSourceInput';
import ImageSourceInput from '../../components/ImageSourceInput';
import {
  FormDate, FormDatetime, FormDuration, FormLabel, FormSelect, FormSwitch, FormText, FormTextarea,
} from '../../components/FormControls';
import LessonMaterialsBlock from '../../components/LessonMaterialsBlock';
import LessonPageView from '../../components/LessonPageView';
import AdminPageViewBar from '../../components/AdminPageViewBar';
import { SchedulePastDivider } from '../../components/ScheduleCard';

type EditorBlock = {
  id: string;
  block_type: LessonBlockType;
  sort_order: number;
  content: LessonBlockContent;
  isNew?: boolean;
};

type EditorState = {
  id: string | null;
  title: string;
  lesson_type: LessonPageType;
  lesson_date: string;
  cover_url: string;
  is_published: boolean;
  /** Группы-адресаты: им видны и занятие в расписании, и материалы. */
  group_ids: string[];
  /**
   * Занятие в расписании — то же событие, что эта страница. Время, ссылка и
   * группы хранятся у события; название, дату и группы страницы база
   * копирует с него сама.
   */
  in_schedule: boolean;
  event_id: string | null;
  starts_at: string;
  duration_minutes: number;
  meeting_url: string;
  /** Анонс занятия — на карточке в расписании и вверху страницы. */
  description: string;
  blocks: EditorBlock[];
};

function emptyEditor(type: LessonPageType): EditorState {
  return {
    id: null,
    title: '',
    lesson_type: type,
    lesson_date: new Date().toISOString().slice(0, 10),
    cover_url: '',
    is_published: false,
    group_ids: [],
    in_schedule: true,
    event_id: null,
    starts_at: '',
    duration_minutes: 90,
    meeting_url: '',
    description: '',
    blocks: createDefaultBlocks().map((b, i) => ({
      id: crypto.randomUUID(),
      block_type: b.block_type,
      sort_order: i,
      content: { ...b.content },
      isNew: true,
    })),
  };
}

/**
 * Слепок редактора для сравнения с сохранённым. Публикация не в счёт: её
 * переключают отдельными кнопками, и она сразу пишется в базу.
 */
function editorSnapshot(editor: EditorState): string {
  return JSON.stringify({ ...editor, is_published: null });
}

/** Наверх к началу страницы при смене вида (без анимации, если её отключили). */
function scrollToTop() {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}

function blocksFromRows(rows: LessonPageBlock[]): EditorBlock[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((b) => ({
      id: b.id,
      block_type: b.block_type,
      sort_order: b.sort_order,
      content: { ...b.content },
    }));
}

export default function LessonsTab({
  lessonType,
  openPageId,
  onPageOpened,
  backLabel = 'К списку',
  onBack,
}: {
  lessonType: LessonPageType;
  /** Открыть эту страницу сразу — например, по карточке занятия в расписании. */
  openPageId?: string;
  onPageOpened?: () => void;
  /** Куда ведёт «назад» из редактора, если пришли не из списка (из расписания). */
  backLabel?: string;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const [groups, setGroups] = useState<Group[]>([]);
  const [pages, setPages] = useState<LessonPageWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  // Открытую страницу сотрудник сначала видит как ученик; редактор — по кнопке.
  const [pageView, setPageView] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [coverPreviewFailed, setCoverPreviewFailed] = useState(false);
  const [homeworkPages, setHomeworkPages] = useState<{ id: string; title: string }[]>([]);
  const [listActionId, setListActionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const visiblePages = useMemo(
    () => pages.filter((p) => textMatches(query, [p.title])),
    [pages, query],
  );
  const { upcoming, past } = useMemo(() => splitLessonsByTime(visiblePages), [visiblePages]);

  const loadHomeworkPages = async () => {
    const { data } = await supabase
      .from('homework_pages')
      .select('id, title')
      .order('title');
    setHomeworkPages((data ?? []) as { id: string; title: string }[]);
  };

  const loadList = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('lesson_pages')
      .select(LESSON_LIST_SELECT)
      .eq('lesson_type', lessonType)
      .order('lesson_date', { ascending: false });
    if (error) setLoadError(lessonPageLoadError(error.message));
    else setPages((data ?? []) as LessonPageWithEvent[]);
    setLoading(false);
  };

  useEffect(() => { loadList(); }, [lessonType]);

  useEffect(() => {
    void loadHomeworkPages();
    supabase
      .from('groups')
      .select('*')
      .eq('group_type', 'teacher')
      .order('name')
      .then(({ data }) => setGroups((data ?? []) as Group[]));
  }, []);

  useEffect(() => {
    if (!openPageId) return;
    void openEdit(openPageId);
    onPageOpened?.();
  }, [openPageId, onPageOpened]);

  const openCreate = () => {
    setEditor(emptyEditor(lessonType));
    setSavedSnapshot('');
    setPageView(false);
    setCoverPreviewFailed(false);
    setMessage('');
  };

  const openEdit = async (pageId: string) => {
    setLoading(true);
    setLoadError(null);
    const [pageRes, blocksRes, eventRes] = await Promise.all([
      supabase.from('lesson_pages').select('*').eq('id', pageId).single(),
      supabase.from('lesson_page_blocks').select('*').eq('page_id', pageId),
      supabase.from('schedule_events').select('*').eq('lesson_page_id', pageId).maybeSingle(),
    ]);
    setLoading(false);
    if (pageRes.error) {
      setLoadError(lessonPageLoadError(pageRes.error.message));
      return;
    }
    if (!pageRes.data) return;
    const page = pageRes.data as LessonPage;
    const event = (eventRes.data ?? null) as ScheduleEvent | null;
    const opened: EditorState = {
      id: page.id,
      title: page.title,
      lesson_type: page.lesson_type as LessonPageType,
      lesson_date: lessonDateInputValue(page.lesson_date),
      cover_url: page.cover_url ?? '',
      is_published: page.is_published,
      group_ids: event?.group_ids ?? page.group_ids ?? [],
      in_schedule: Boolean(event),
      event_id: event?.id ?? null,
      starts_at: event ? toDatetimeLocalValue(event.scheduled_at) : '',
      duration_minutes: event?.duration_minutes ?? 90,
      meeting_url: event?.meeting_url ?? '',
      description: event?.description ?? '',
      blocks: blocksFromRows((blocksRes.data ?? []) as LessonPageBlock[]),
    };
    setEditor(opened);
    setSavedSnapshot(editorSnapshot(opened));
    setPageView(true);
    setCoverPreviewFailed(false);
    setMessage('');
  };

  const closeEditor = () => {
    if (onBack) {
      onBack();
      return;
    }
    setEditor(null);
    setPageView(false);
    loadList();
  };

  const persist = async (publish: boolean) => {
    if (!editor || !user) return;
    if (!editor.title.trim()) {
      setMessage('Укажите название занятия');
      return;
    }
    if (editor.in_schedule ? !editor.starts_at : !editor.lesson_date) {
      setMessage(editor.in_schedule ? 'Укажите дату и время занятия' : 'Укажите дату занятия');
      return;
    }

    setSaving(true);
    setMessage('');
    const now = new Date().toISOString();
    const isPublished = publish ? true : editor.is_published;
    const title = editor.title.trim();
    // В расписании дата — из времени занятия; база потом уточнит её по Москве.
    const lessonDate = editor.in_schedule ? editor.starts_at.slice(0, 10) : editor.lesson_date;

    try {
      let pageId = editor.id;

      if (!pageId) {
        const { data: created, error } = await supabase
          .from('lesson_pages')
          .insert({
            title,
            lesson_type: editor.lesson_type,
            lesson_date: lessonDate,
            cover_url: editor.cover_url.trim() || null,
            is_published: isPublished,
            group_ids: editor.group_ids,
            created_by: user.id,
            updated_at: now,
          })
          .select('id')
          .single();
        if (error || !created) {
          setMessage(lessonPageSaveError(error, 'Не удалось создать страницу'));
          return;
        }
        pageId = created.id;
      } else {
        const { error } = await supabase
          .from('lesson_pages')
          .update({
            title,
            lesson_date: lessonDate,
            cover_url: editor.cover_url.trim() || null,
            is_published: isPublished,
            group_ids: editor.group_ids,
            updated_at: now,
          })
          .eq('id', pageId);
        if (error) {
          setMessage(lessonPageSaveError(error, 'Не удалось сохранить'));
          return;
        }
      }

      // Событие расписания — то же занятие: создаём, обновляем или убираем.
      let eventId = editor.event_id;
      if (editor.in_schedule) {
        const eventFields = {
          title,
          event_type: editor.lesson_type,
          scheduled_at: new Date(editor.starts_at).toISOString(),
          duration_minutes: editor.duration_minutes,
          meeting_url: normalizeMeetingUrl(editor.meeting_url),
          description: editor.description.trim(),
          group_ids: editor.group_ids,
          group_id: legacyGroupId(editor.group_ids),
          lesson_page_id: pageId,
          updated_at: now,
        };
        const insertEvent = () => supabase
          .from('schedule_events')
          .insert({ ...eventFields, created_by: user.id })
          .select('id')
          .single();
        let eventRes = eventId
          ? await supabase.from('schedule_events').update(eventFields).eq('id', eventId).select('id').maybeSingle()
          : await insertEvent();
        // Событие успели удалить из расписания — заводим заново.
        if (eventId && !eventRes.error && !eventRes.data) eventRes = await insertEvent();
        if (eventRes.error || !eventRes.data) {
          setEditor({ ...editor, id: pageId });
          setMessage('Страница сохранена, но в расписание не попала. Попробуйте сохранить ещё раз.');
          return;
        }
        eventId = eventRes.data.id;
      } else if (eventId) {
        const { error } = await supabase.from('schedule_events').delete().eq('id', eventId);
        if (error) {
          setEditor({ ...editor, id: pageId });
          setMessage('Страница сохранена, но из расписания не убралась. Попробуйте ещё раз.');
          return;
        }
        eventId = null;
      }

      await supabase.from('lesson_page_blocks').delete().eq('page_id', pageId);

      const blockRows = editor.blocks.map((b, index) => ({
        page_id: pageId,
        block_type: b.block_type,
        sort_order: index,
        content: b.content,
      }));

      if (blockRows.length > 0) {
        const { error: blockError } = await supabase.from('lesson_page_blocks').insert(blockRows);
        if (blockError) {
          setMessage(lessonPageSaveError(blockError, 'Страница сохранена, но блоки не записались'));
          return;
        }
      }

      const saved: EditorState = {
        ...editor,
        id: pageId,
        event_id: eventId,
        lesson_date: lessonDate,
        is_published: isPublished,
      };
      setEditor(saved);
      setSavedSnapshot(editorSnapshot(saved));
      setMessage(isPublished ? 'Сохранено и опубликовано' : 'Сохранено');
      loadList();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setMessage(lessonPageLoadError(raw) ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    if (!editor?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('lesson_pages')
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq('id', editor.id);
    setSaving(false);
    if (error) {
      setMessage(lessonPageSaveError(error, 'Не удалось снять с публикации'));
      return;
    }
    setEditor({ ...editor, is_published: false });
    setMessage('Снято с публикации');
    loadList();
  };

  const deletePage = async () => {
    if (!editor?.id) return;
    const ok = await confirm({
      title: 'Удалить страницу?',
      message: editor.event_id
        ? 'Страница, все блоки и занятие в расписании будут удалены без возможности восстановления.'
        : 'Страница и все блоки будут удалены без возможности восстановления.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase.from('lesson_pages').delete().eq('id', editor.id);
    setSaving(false);
    if (error) {
      setMessage(lessonPageSaveError(error, 'Не удалось удалить страницу'));
      return;
    }
    closeEditor();
  };

  const togglePublishFromList = async (page: LessonPage) => {
    setListActionId(page.id);
    setLoadError(null);
    const nextPublished = !page.is_published;
    const { error } = await supabase
      .from('lesson_pages')
      .update({ is_published: nextPublished, updated_at: new Date().toISOString() })
      .eq('id', page.id);
    setListActionId(null);
    if (error) {
      setLoadError(lessonPageSaveError(error, nextPublished ? 'Не удалось опубликовать' : 'Не удалось снять с публикации'));
      return;
    }
    setPages((prev) => prev.map((p) => (
      p.id === page.id ? { ...p, is_published: nextPublished } : p
    )));
  };

  const deleteFromList = async (page: LessonPage) => {
    const ok = await confirm({
      title: 'Удалить страницу?',
      message: `«${page.title}», все блоки и занятие в расписании, если оно есть, будут удалены без возможности восстановления.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setListActionId(page.id);
    setLoadError(null);
    const { error } = await supabase.from('lesson_pages').delete().eq('id', page.id);
    setListActionId(null);
    if (error) {
      setLoadError(lessonPageSaveError(error, 'Не удалось удалить страницу'));
      return;
    }
    setPages((prev) => prev.filter((p) => p.id !== page.id));
  };

  const updateBlockContent = (id: string, patch: Partial<LessonBlockContent>) => {
    if (!editor) return;
    setEditor({
      ...editor,
      blocks: editor.blocks.map((b) => (
        b.id === id ? { ...b, content: { ...b.content, ...patch } } : b
      )),
    });
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    if (!editor) return;
    const next = index + dir;
    if (next < 0 || next >= editor.blocks.length) return;
    const blocks = [...editor.blocks];
    [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
    setEditor({ ...editor, blocks });
  };

  const removeBlock = (id: string) => {
    if (!editor) return;
    setEditor({ ...editor, blocks: editor.blocks.filter((b) => b.id !== id) });
  };

  const addBlock = (type: LessonBlockType) => {
    if (!editor) return;
    setEditor({
      ...editor,
      blocks: [
        ...editor.blocks,
        {
          id: crypto.randomUUID(),
          block_type: type,
          sort_order: editor.blocks.length,
          content: defaultBlockContent(type),
          isNew: true,
        },
      ],
    });
  };

  if (editor) {
    const previewBlocks: LessonPageBlock[] = editor.blocks.map((b, i) => ({
      id: b.id,
      page_id: editor.id ?? '',
      block_type: b.block_type,
      sort_order: i,
      content: b.content,
      created_at: '',
    }));

    const backButton = (
      <button
        type="button"
        onClick={closeEditor}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </button>
    );

    const messageLine = message && (
      <p className={`text-sm ${isSaveSuccessMessage(message) ? 'text-emerald-400' : 'text-rose-400'}`}>
        {message}
      </p>
    );

    if (pageView) {
      return (
        <div className="space-y-6 max-w-6xl">
          {backButton}
          <AdminPageViewBar
            published={editor.is_published}
            dirty={editorSnapshot(editor) !== savedSnapshot}
            saving={saving}
            onEdit={() => {
              setPageView(false);
              scrollToTop();
            }}
            onPublish={() => { void persist(true); }}
            onSave={() => { void persist(false); }}
          />
          {messageLine}
          <LessonPageView
            title={editor.title}
            lessonDate={editor.in_schedule && editor.starts_at ? editor.starts_at.slice(0, 10) : editor.lesson_date}
            lessonType={editor.lesson_type}
            coverUrl={editor.cover_url}
            event={editor.in_schedule && editor.starts_at
              ? {
                scheduled_at: new Date(editor.starts_at).toISOString(),
                duration_minutes: editor.duration_minutes,
                meeting_url: normalizeMeetingUrl(editor.meeting_url),
                description: editor.description,
              }
              : null}
            blocks={previewBlocks}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-3xl">
        {backButton}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              {editor.id ? 'Редактирование' : 'Новая страница'}
              {' · '}
              {LESSON_TYPE_LABELS[editor.lesson_type]}
            </h2>
            <p className="text-slate-400 text-sm">
              {editor.is_published ? 'Опубликовано — сохранение сразу видно ученикам' : 'Черновик — ученики не видят'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPageView(true);
              scrollToTop();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors bg-white/5 text-slate-300 border-white/10 hover:text-white"
          >
            <Eye className="w-4 h-4" />
            Как видят ученики
          </button>
        </div>

        <div className="space-y-4 bg-slate-900/60 border border-white/5 rounded-2xl p-5">
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-500">Название</span>
            <input
              value={editor.title}
              onChange={(e) => setEditor({ ...editor, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
              placeholder="Например: Кубиты и суперпозиция"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-500">Обложка</span>
            <ImageSourceInput
              value={editor.cover_url}
              onChange={(cover_url) => {
                setCoverPreviewFailed(false);
                setEditor({ ...editor, cover_url });
              }}
              previewClassName="mt-2 h-24 w-40 rounded-xl object-cover border border-white/10 bg-slate-950"
              onPreviewError={() => setCoverPreviewFailed(true)}
              previewFailed={coverPreviewFailed}
            />
            {!editor.cover_url.trim() && (
              <p className="text-[11px] text-slate-600">Без обложки — градиентная заглушка в списке</p>
            )}
          </label>
        </div>

        <div className="space-y-5 bg-slate-900/60 border border-white/5 rounded-2xl p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Занятие</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Страница и есть занятие: его карточка в «Расписании» показывает то же, что здесь, — обложку,
              время и ссылку. Пока страница черновик, ученики не видят ни её, ни карточку.
            </p>
          </div>
          <FormSwitch
            checked={editor.in_schedule}
            onChange={(in_schedule) => setEditor({ ...editor, in_schedule })}
            label="Показывать в расписании"
            description="Со временем и ссылкой на трансляцию — ученики увидят занятие в календаре"
          />
          {editor.in_schedule ? (
            <>
              <div>
                <FormLabel className="text-xs text-slate-500">Дата и время *</FormLabel>
                <FormDatetime
                  value={editor.starts_at}
                  onChange={(starts_at) => setEditor({ ...editor, starts_at })}
                  warnPast={!editor.event_id}
                />
              </div>
              <div>
                <FormLabel className="text-xs text-slate-500">Длительность</FormLabel>
                <FormDuration
                  value={editor.duration_minutes}
                  onChange={(duration_minutes) => setEditor({ ...editor, duration_minutes })}
                  startsAt={editor.starts_at}
                />
              </div>
              <div>
                <FormLabel className="text-xs text-slate-500">Ссылка на трансляцию</FormLabel>
                <FormText
                  value={editor.meeting_url}
                  onChange={(e) => setEditor({ ...editor, meeting_url: e.target.value })}
                  placeholder="https://telemost.yandex.ru/…"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <FormLabel className="text-xs text-slate-500">Анонс</FormLabel>
                <FormTextarea
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  rows={2}
                  placeholder="О чём занятие, что подготовить…"
                />
                <p className="text-[11px] text-slate-600 mt-1">Коротко: виден на карточке в расписании и вверху страницы</p>
              </div>
            </>
          ) : (
            <div>
              <FormLabel className="text-xs text-slate-500">Дата занятия</FormLabel>
              <FormDate
                value={editor.lesson_date}
                onChange={(lesson_date) => setEditor({ ...editor, lesson_date })}
                className="max-w-xs"
              />
              {editor.event_id && (
                <p className="text-[11px] text-amber-400/90 mt-1.5">При сохранении занятие уберётся из расписания</p>
              )}
            </div>
          )}
          <div>
            <FormLabel className="text-xs text-slate-500">Группы</FormLabel>
            <GroupMultiSelect
              groups={groups}
              value={editor.group_ids}
              onChange={(group_ids) => setEditor({ ...editor, group_ids })}
            />
            <p className="text-[11px] text-slate-600 mt-1.5">Только эти группы увидят занятие и материалы</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Блоки страницы</h3>
            <div className="flex flex-wrap gap-2">
              {LESSON_BLOCK_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                >
                  + {LESSON_BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {editor.blocks.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-white/10 rounded-xl">
              Добавьте хотя бы один блок
            </p>
          ) : (
            editor.blocks.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                index={index}
                total={editor.blocks.length}
                homeworkPages={homeworkPages}
                onMove={moveBlock}
                onRemove={() => removeBlock(block.id)}
                onContentChange={(patch) => updateBlockContent(block.id, patch)}
              />
            ))
          )}
        </div>

        {messageLine}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => persist(false)}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => persist(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
          >
            Сохранить и опубликовать
          </button>
          {editor.is_published && editor.id && (
            <button
              type="button"
              disabled={saving}
              onClick={unpublish}
              className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-sm font-medium border border-amber-500/20 disabled:opacity-50"
            >
              Снять с публикации
            </button>
          )}
          {editor.id && (
            <button
              type="button"
              disabled={saving}
              onClick={deletePage}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-sm font-medium border border-rose-500/20 disabled:opacity-50 ml-auto"
            >
              <Trash2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Удалить
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-slate-400 text-sm">
        {lessonType === 'lecture'
          ? 'Лекции для учеников. Не забудьте «Сохранить и опубликовать».'
          : 'Семинары для учеников. Не забудьте «Сохранить и опубликовать».'}
      </p>

      {loadError && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          {loadError}
        </p>
      )}

      <button
        type="button"
        onClick={openCreate}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Создать {lessonType === 'lecture' ? 'лекцию' : 'семинар'}
      </button>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : loadError ? null : pages.length === 0 ? (
        <p className="text-center py-12 text-slate-500 border border-white/5 rounded-2xl">
          {lessonType === 'lecture' ? 'Лекций' : 'Семинаров'} пока нет
        </p>
      ) : (
        <div className="space-y-3">
          {pages.length > 5 && (
            <ListSearchBar
              value={query}
              onChange={setQuery}
              placeholder="Поиск по названию…"
              shownCount={visiblePages.length}
              totalCount={pages.length}
            />
          )}
          {visiblePages.length === 0 && (
            <p className="text-center py-12 text-slate-500 border border-white/5 rounded-2xl">
              Ничего не найдено по запросу
            </p>
          )}
          {[...upcoming, ...past].map(({ page, event }, index) => (
            <div key={page.id}>
              {index === upcoming.length && upcoming.length > 0 && (
                <div className="pt-3 pb-4">
                  <SchedulePastDivider />
                </div>
              )}
              <LessonPageCard
                page={page}
                event={event}
                past={index >= upcoming.length}
                onClick={() => openEdit(page.id)}
                showStatus
                onTogglePublish={() => { void togglePublishFromList(page); }}
                onDelete={() => { void deleteFromList(page); }}
                actionBusy={listActionId === page.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  index,
  total,
  homeworkPages,
  onMove,
  onRemove,
  onContentChange,
}: {
  block: EditorBlock;
  index: number;
  total: number;
  homeworkPages: { id: string; title: string }[];
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: () => void;
  onContentChange: (patch: Partial<LessonBlockContent>) => void;
}) {
  const homeworkOptions = [
    { value: '', label: '— Не прикреплено —' },
    ...homeworkPages.map((p) => ({ value: p.id, label: p.title })),
  ];

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {LESSON_BLOCK_LABELS[block.block_type]}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 disabled:opacity-30"
            title="Выше"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 disabled:opacity-30"
            title="Ниже"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-300"
            title="Удалить блок"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {block.block_type === 'recording' && (
        <div className="space-y-3">
          <input
            value={block.content.url ?? ''}
            onChange={(e) => onContentChange({ url: e.target.value })}
            placeholder="Ссылка на YouTube, Rutube, VK Video…"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
          />
          {block.content.url?.trim() && (
            <VideoEmbed url={block.content.url} />
          )}
        </div>
      )}

      {(block.block_type === 'text' || block.block_type === 'materials') && block.block_type === 'text' && (
        <textarea
          value={block.content.body ?? ''}
          onChange={(e) => onContentChange({ body: e.target.value })}
          rows={5}
          placeholder="Описание, конспект…"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm resize-y min-h-[6rem]"
        />
      )}

      {block.block_type === 'materials' && (
        <div className="space-y-3">
          <DocumentSourceInput
            value={block.content.pdf_url ?? ''}
            onChange={(pdf_url) => onContentChange({ pdf_url })}
            placeholder="Загрузите PDF/картинку или вставьте ссылку"
          />
          <input
            value={block.content.pdf_title ?? ''}
            onChange={(e) => onContentChange({ pdf_title: e.target.value })}
            placeholder="Название документа (необязательно)"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
          />
          <textarea
            value={block.content.body ?? ''}
            onChange={(e) => onContentChange({ body: e.target.value })}
            rows={3}
            placeholder="Дополнительные ссылки и материалы…"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm resize-y min-h-[4rem]"
          />
          {(block.content.pdf_url?.trim() || block.content.body?.trim()) && (
            <LessonMaterialsBlock content={block.content} />
          )}
        </div>
      )}

      {block.block_type === 'homework_link' && (
        <div className="space-y-2">
          <FormSelect
            value={block.content.homework_page_id ?? ''}
            onChange={(homework_page_id) => {
              const page = homeworkPages.find((p) => p.id === homework_page_id);
              onContentChange({
                homework_page_id,
                label: page?.title ?? block.content.label ?? 'Перейти к домашнему заданию',
              });
            }}
            options={homeworkOptions}
            placeholder="Выберите домашнее задание…"
          />
          {homeworkPages.length === 0 && (
            <p className="text-[11px] text-slate-500">
              Сначала создайте домашнее задание во вкладке «Домашние задания».
            </p>
          )}
          <input
            value={block.content.label ?? ''}
            onChange={(e) => onContentChange({ label: e.target.value })}
            placeholder="Текст кнопки"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
          />
        </div>
      )}
    </div>
  );
}
