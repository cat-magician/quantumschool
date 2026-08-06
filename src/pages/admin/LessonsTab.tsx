import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Eye, Loader2, Plus, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import type { LessonBlockContent, LessonBlockType, LessonPage, LessonPageBlock, LessonPageType } from '../../lib/types';
import {
  LESSON_BLOCK_LABELS,
  LESSON_BLOCK_TYPES,
  LESSON_TYPE_LABELS,
  createDefaultBlocks,
  defaultBlockContent,
  lessonDateInputValue,
} from '../../lib/lessonPageUtils';
import { lessonPageLoadError, lessonPageSaveError, isSaveSuccessMessage } from '../../lib/lessonPageLoadError';
import VideoEmbed from '../../components/VideoEmbed';
import LessonPageCard from '../../components/LessonPageCard';
import DocumentSourceInput from '../../components/DocumentSourceInput';
import ImageSourceInput from '../../components/ImageSourceInput';
import { FormDate, FormLabel, FormSelect } from '../../components/FormControls';
import LessonMaterialsBlock from '../../components/LessonMaterialsBlock';
import LessonPageStudentPreview from '../../components/LessonPageStudentPreview';
import StudentPagePreviewBanner from '../../components/StudentPagePreviewBanner';

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
    blocks: createDefaultBlocks().map((b, i) => ({
      id: crypto.randomUUID(),
      block_type: b.block_type,
      sort_order: i,
      content: { ...b.content },
      isNew: true,
    })),
  };
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

export default function LessonsTab({ lessonType }: { lessonType: LessonPageType }) {
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const [pages, setPages] = useState<LessonPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [coverPreviewFailed, setCoverPreviewFailed] = useState(false);
  const [homeworkPages, setHomeworkPages] = useState<{ id: string; title: string }[]>([]);

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
      .select('*')
      .eq('lesson_type', lessonType)
      .order('lesson_date', { ascending: false });
    if (error) setLoadError(lessonPageLoadError(error.message));
    else setPages((data ?? []) as LessonPage[]);
    setLoading(false);
  };

  useEffect(() => { loadList(); }, [lessonType]);

  useEffect(() => {
    void loadHomeworkPages();
  }, []);

  useEffect(() => {
    if (previewMode) {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [previewMode]);

  const openCreate = () => {
    setEditor(emptyEditor(lessonType));
    setPreviewMode(false);
    setCoverPreviewFailed(false);
    setMessage('');
  };

  const openEdit = async (pageId: string) => {
    setLoading(true);
    setLoadError(null);
    const [pageRes, blocksRes] = await Promise.all([
      supabase.from('lesson_pages').select('*').eq('id', pageId).single(),
      supabase.from('lesson_page_blocks').select('*').eq('page_id', pageId),
    ]);
    setLoading(false);
    if (pageRes.error) {
      setLoadError(lessonPageLoadError(pageRes.error.message));
      return;
    }
    if (!pageRes.data) return;
    const page = pageRes.data;
    setEditor({
      id: page.id,
      title: page.title,
      lesson_type: page.lesson_type as LessonPageType,
      lesson_date: lessonDateInputValue(page.lesson_date),
      cover_url: page.cover_url ?? '',
      is_published: page.is_published,
      blocks: blocksFromRows((blocksRes.data ?? []) as LessonPageBlock[]),
    });
    setPreviewMode(false);
    setCoverPreviewFailed(false);
    setMessage('');
  };

  const closeEditor = () => {
    setEditor(null);
    setPreviewMode(false);
    loadList();
  };

  const persist = async (publish: boolean) => {
    if (!editor || !user) return;
    if (!editor.title.trim()) {
      setMessage('Укажите название занятия');
      return;
    }
    if (!editor.lesson_date) {
      setMessage('Укажите дату занятия');
      return;
    }

    setSaving(true);
    setMessage('');
    const now = new Date().toISOString();
    const isPublished = publish ? true : editor.is_published;

    try {
      let pageId = editor.id;

      if (!pageId) {
        const { data: created, error } = await supabase
          .from('lesson_pages')
          .insert({
            title: editor.title.trim(),
            lesson_type: editor.lesson_type,
            lesson_date: editor.lesson_date,
            cover_url: editor.cover_url.trim() || null,
            is_published: isPublished,
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
            title: editor.title.trim(),
            lesson_date: editor.lesson_date,
            cover_url: editor.cover_url.trim() || null,
            is_published: isPublished,
            updated_at: now,
          })
          .eq('id', pageId);
        if (error) {
          setMessage(lessonPageSaveError(error, 'Не удалось сохранить'));
          return;
        }
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

      setEditor({
        ...editor,
        id: pageId,
        is_published: isPublished,
      });
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
      message: 'Страница и все блоки будут удалены без возможности восстановления.',
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

    return (
      <div className="space-y-6 max-w-3xl">
        <button
          type="button"
          onClick={closeEditor}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          К списку
        </button>

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
            onClick={() => setPreviewMode((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              previewMode
                ? 'bg-violet-600/20 text-violet-200 border-violet-500/30'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Редактор' : 'Как видят ученики'}
          </button>
        </div>

        {previewMode ? (
          <div ref={previewRef} className="space-y-4">
            <StudentPagePreviewBanner />
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
              <LessonPageStudentPreview
                title={editor.title}
                lessonDate={editor.lesson_date}
                lessonType={editor.lesson_type}
                coverUrl={editor.cover_url}
                blocks={previewBlocks}
              />
            </div>
          </div>
        ) : (
          <>
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
          <div className="block space-y-1.5">
            <FormLabel className="text-xs text-slate-500 mb-0">Дата занятия</FormLabel>
            <FormDate
              value={editor.lesson_date}
              onChange={(lesson_date) => setEditor({ ...editor, lesson_date })}
            />
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
          </>
        )}

        {message && (
          <p className={`text-sm ${isSaveSuccessMessage(message) ? 'text-emerald-400' : 'text-rose-400'}`}>
            {message}
          </p>
        )}

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
        <div className="space-y-2">
          {pages.map((page) => (
            <LessonPageCard
              key={page.id}
              page={page}
              onClick={() => openEdit(page.id)}
              showStatus
            />
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
          <LessonMaterialsBlock content={block.content} />
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
