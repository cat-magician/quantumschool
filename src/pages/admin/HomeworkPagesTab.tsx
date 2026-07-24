import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Eye, Loader2, Plus, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import type { HomeworkBlockContent, HomeworkBlockType, HomeworkPage, HomeworkPageBlock } from '../../lib/types';
import {
  HOMEWORK_BLOCK_LABELS,
  HOMEWORK_CONTENT_BLOCK_TYPES,
  HOMEWORK_SUBMISSION_BLOCK_TYPES,
  createDefaultHomeworkBlocks,
  defaultHomeworkBlockContent,
  homeworkDueInputValue,
  normalizeHomeworkMarkdown,
} from '../../lib/homeworkPageUtils';
import {
  DEFAULT_HOMEWORK_MAX_SCORE,
  formatHomeworkScoreValue,
  parseHomeworkMaxScore,
} from '../../lib/homeworkUtils';
import { parseYandexFormId, normalizeContestUrl } from '../../lib/selectionConfig';
import { YANDEX_FORM_EMBED } from '../../lib/constants';
import { homeworkPageLoadError, homeworkPageSaveError } from '../../lib/homeworkPageLoadError';
import VideoEmbed from '../../components/VideoEmbed';
import MarkdownEditor from '../../components/MarkdownEditor';
import YandexFormEmbed from '../../components/YandexFormEmbed';
import YandexContestEmbed, { isContestEmbeddable } from '../../components/YandexContestEmbed';
import HomeworkPageCard from '../../components/HomeworkPageCard';
import HomeworkPageStudentPreview from '../../components/HomeworkPageStudentPreview';
import StudentPagePreviewBanner from '../../components/StudentPagePreviewBanner';
import BlockPlaceholder from '../../components/BlockPlaceholder';

type EditorBlock = {
  id: string;
  block_type: HomeworkBlockType;
  sort_order: number;
  content: HomeworkBlockContent;
  isNew?: boolean;
};

type EditorState = {
  id: string | null;
  title: string;
  due_at: string;
  max_score: string;
  is_published: boolean;
  blocks: EditorBlock[];
};

function emptyEditor(): EditorState {
  return {
    id: null,
    title: '',
    due_at: '',
    max_score: String(DEFAULT_HOMEWORK_MAX_SCORE),
    is_published: false,
    blocks: createDefaultHomeworkBlocks().map((b, i) => ({
      id: crypto.randomUUID(),
      block_type: b.block_type,
      sort_order: i,
      content: { ...b.content },
      isNew: true,
    })),
  };
}

function blocksFromRows(rows: HomeworkPageBlock[]): EditorBlock[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((b) => ({
      id: b.id,
      block_type: b.block_type,
      sort_order: b.sort_order,
      content:
        b.block_type === 'text' && b.content.body
          ? { body: normalizeHomeworkMarkdown(b.content.body) }
          : { ...b.content },
    }));
}

export default function HomeworkPagesTab() {
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const [pages, setPages] = useState<HomeworkPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadList = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('homework_pages')
      .select('*')
      // Черновики сверху, затем ближайший срок; без срока — в конце группы
      .order('is_published', { ascending: true })
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false });
    if (error) setLoadError(homeworkPageLoadError(error.message));
    else setPages((data ?? []) as HomeworkPage[]);
    setLoading(false);
  };

  useEffect(() => { loadList(); }, []);

  useEffect(() => {
    if (previewMode) {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [previewMode]);

  const openCreate = () => {
    setEditor(emptyEditor());
    setPreviewMode(false);
    setMessage('');
  };

  const openEdit = async (pageId: string) => {
    setLoading(true);
    setLoadError(null);
    const [pageRes, blocksRes] = await Promise.all([
      supabase.from('homework_pages').select('*').eq('id', pageId).single(),
      supabase.from('homework_page_blocks').select('*').eq('page_id', pageId),
    ]);
    setLoading(false);
    if (pageRes.error) {
      setLoadError(homeworkPageLoadError(pageRes.error.message));
      return;
    }
    if (!pageRes.data) return;
    const page = pageRes.data;
    setEditor({
      id: page.id,
      title: page.title,
      due_at: homeworkDueInputValue(page.due_at),
      max_score: formatHomeworkScoreValue(page.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE),
      is_published: page.is_published,
      blocks: blocksFromRows((blocksRes.data ?? []) as HomeworkPageBlock[]),
    });
    setPreviewMode(false);
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
      setMessage('Укажите название задания');
      return;
    }
    const maxScore = parseHomeworkMaxScore(editor.max_score);
    if (maxScore === null) {
      setMessage('Укажите максимальный балл (например, 10 или 20)');
      return;
    }

    setSaving(true);
    setMessage('');
    const now = new Date().toISOString();
    const isPublished = publish ? true : editor.is_published;
    let pageId = editor.id;

    if (!pageId) {
      const { data: created, error } = await supabase
        .from('homework_pages')
        .insert({
          title: editor.title.trim(),
          due_at: editor.due_at ? new Date(editor.due_at).toISOString() : null,
          max_score: maxScore,
          is_published: isPublished,
          created_by: user.id,
          updated_at: now,
        })
        .select('id')
        .single();
      if (error || !created) {
        setSaving(false);
        setMessage(homeworkPageSaveError(error, 'Не удалось создать страницу'));
        return;
      }
      pageId = created.id;
    } else {
      const { error } = await supabase
        .from('homework_pages')
        .update({
          title: editor.title.trim(),
          due_at: editor.due_at ? new Date(editor.due_at).toISOString() : null,
          max_score: maxScore,
          is_published: isPublished,
          updated_at: now,
        })
        .eq('id', pageId);
      if (error) {
        setSaving(false);
        setMessage(homeworkPageSaveError(error, 'Не удалось сохранить'));
        return;
      }
    }

    await supabase.from('homework_page_blocks').delete().eq('page_id', pageId);

    const blockRows = editor.blocks.map((b, index) => {
      let content = b.content;
      if (b.block_type === 'yandex_form') {
        const formId = parseYandexFormId(b.content.form_id ?? '');
        content = { form_id: formId ?? b.content.form_id?.trim() ?? '' };
      } else if (b.block_type === 'contest') {
        const url = normalizeContestUrl(b.content.url ?? '');
        content = { url: url ?? b.content.url?.trim() ?? '' };
      } else if (b.block_type === 'text') {
        content = { body: normalizeHomeworkMarkdown(b.content.body ?? '') };
      }
      return {
        page_id: pageId,
        block_type: b.block_type,
        sort_order: index,
        content,
      };
    });

    if (blockRows.length > 0) {
      const { error: blockError } = await supabase.from('homework_page_blocks').insert(blockRows);
      if (blockError) {
        setSaving(false);
        setMessage(homeworkPageSaveError(blockError, 'Страница сохранена, но блоки не записались'));
        return;
      }
    }

    setSaving(false);
    setEditor({ ...editor, id: pageId, is_published: isPublished });
    setMessage(isPublished ? 'Сохранено и опубликовано' : 'Сохранено');
    loadList();
  };

  const unpublish = async () => {
    if (!editor?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('homework_pages')
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq('id', editor.id);
    setSaving(false);
    if (error) {
      setMessage(homeworkPageSaveError(error, 'Не удалось снять с публикации'));
      return;
    }
    setEditor({ ...editor, is_published: false });
    setMessage('Снято с публикации');
    loadList();
  };

  const deletePage = async () => {
    if (!editor?.id) return;
    const ok = await confirm({
      title: 'Удалить задание?',
      message: 'Страница и все блоки будут удалены без возможности восстановления.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase.from('homework_pages').delete().eq('id', editor.id);
    setSaving(false);
    if (error) {
      setMessage(homeworkPageSaveError(error, 'Не удалось удалить'));
      return;
    }
    closeEditor();
  };

  const updateBlockContent = (id: string, patch: Partial<HomeworkBlockContent>) => {
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

  const addBlock = (type: HomeworkBlockType) => {
    if (!editor) return;
    setEditor({
      ...editor,
      blocks: [
        ...editor.blocks,
        {
          id: crypto.randomUUID(),
          block_type: type,
          sort_order: editor.blocks.length,
          content: defaultHomeworkBlockContent(type),
          isNew: true,
        },
      ],
    });
  };

  if (editor) {
    const previewBlocks: HomeworkPageBlock[] = editor.blocks.map((b, i) => ({
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
              {editor.id ? 'Редактирование' : 'Новое задание'}
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
              <HomeworkPageStudentPreview
                title={editor.title}
                dueAt={editor.due_at ? new Date(editor.due_at).toISOString() : null}
                blocks={previewBlocks}
                preview
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
                  placeholder="Например: ДЗ 1 — Базовые кубиты"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-slate-500">Срок сдачи (необязательно)</span>
                <input
                  type="datetime-local"
                  value={editor.due_at}
                  onChange={(e) => setEditor({ ...editor, due_at: e.target.value })}
                  className="w-full max-w-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm [color-scheme:dark]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-slate-500">Максимальный балл</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editor.max_score}
                  onChange={(e) => {
                    const next = e.target.value.replace(',', '.');
                    if (next === '' || /^\d{0,4}(\.\d{0,2})?$/.test(next)) {
                      setEditor({ ...editor, max_score: next });
                    }
                  }}
                  className="w-full max-w-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
                  placeholder="10"
                />
                <p className="text-[11px] text-slate-600">Можно дробное значение, например 10 или 25. Средний балл считается по сумме.</p>
              </label>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Блоки задания</h3>
                <div className="flex flex-wrap gap-2">
                  {HOMEWORK_CONTENT_BLOCK_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addBlock(type)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                    >
                      + {HOMEWORK_BLOCK_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Сдача ответов</h3>
                <div className="flex flex-wrap gap-2">
                  {HOMEWORK_SUBMISSION_BLOCK_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addBlock(type)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 border border-violet-500/20"
                    >
                      + {HOMEWORK_BLOCK_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {editor.blocks.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-white/10 rounded-xl">
                  Добавьте блок с задачами и блок сдачи (форма или контест)
                </p>
              ) : (
                editor.blocks.map((block, index) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    index={index}
                    total={editor.blocks.length}
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
          <p className={`text-sm ${message.includes('Не') || message.includes('не настроены') ? 'text-rose-400' : 'text-emerald-400'}`}>
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
    <div className="space-y-6 max-w-4xl">
      <p className="text-slate-400 text-sm">
        Страницы домашних заданий: условие (Markdown, картинки, видео) и сдача через Яндекс.Форму или Контест.
        Список: сначала черновики, затем по сроку сдачи (ближайшие сверху).
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
        Создать задание
      </button>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : loadError ? null : pages.length === 0 ? (
        <p className="text-center py-12 text-slate-500 border border-white/5 rounded-2xl">
          Заданий пока нет
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <HomeworkPageCard key={page.id} page={page} onClick={() => openEdit(page.id)} />
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
  onMove,
  onRemove,
  onContentChange,
}: {
  block: EditorBlock;
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: () => void;
  onContentChange: (patch: Partial<HomeworkBlockContent>) => void;
}) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {HOMEWORK_BLOCK_LABELS[block.block_type]}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 disabled:opacity-30" title="Выше">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 disabled:opacity-30" title="Ниже">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRemove} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-300" title="Удалить блок">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {block.block_type === 'text' && (
        <MarkdownEditor
          value={block.content.body ?? ''}
          onChange={(body) => onContentChange({ body })}
          preparePreview={normalizeHomeworkMarkdown}
          placeholder={'## Задача 1\n\nДокажите, что $|0\\rangle$ и $|1\\rangle$ ортогональны.'}
        />
      )}

      {block.block_type === 'image' && (
        <div className="space-y-2">
          <input
            value={block.content.url ?? ''}
            onChange={(e) => onContentChange({ url: e.target.value })}
            placeholder="URL изображения"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
          />
          <input
            value={block.content.caption ?? ''}
            onChange={(e) => onContentChange({ caption: e.target.value })}
            placeholder="Подпись (необязательно)"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
          />
          {block.content.url?.trim() ? (
            <img
              src={block.content.url.trim()}
              alt={block.content.caption || 'Предпросмотр'}
              className="max-w-full rounded-xl border border-white/10"
            />
          ) : (
            <BlockPlaceholder variant="image" />
          )}
        </div>
      )}

      {block.block_type === 'video' && (
        <div className="space-y-3">
          <input
            value={block.content.url ?? ''}
            onChange={(e) => onContentChange({ url: e.target.value })}
            placeholder="Ссылка на YouTube, Rutube, VK Video…"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
          />
          {block.content.url?.trim() ? (
            <VideoEmbed url={block.content.url} />
          ) : (
            <BlockPlaceholder variant="video" />
          )}
        </div>
      )}

      {block.block_type === 'yandex_form' && (
        <div className="space-y-3">
          <input
            value={block.content.form_id ?? ''}
            onChange={(e) => onContentChange({ form_id: e.target.value })}
            placeholder="https://forms.yandex.ru/u/… или ID формы"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
          />
          {parseYandexFormId(block.content.form_id ?? '') ? (
            <YandexFormEmbed formId={parseYandexFormId(block.content.form_id ?? '')!} />
          ) : (
            <BlockPlaceholder variant="yandex_form" />
          )}
        </div>
      )}

      {block.block_type === 'contest' && (
        <div className="space-y-3">
          <input
            value={block.content.url ?? ''}
            onChange={(e) => onContentChange({ url: e.target.value })}
            placeholder="https://contest.yandex.ru/…"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
          />
          {(() => {
            const url = block.content.url ?? '';
            const embeddable = url.trim() && isContestEmbeddable(normalizeContestUrl(url) ?? '');
            return embeddable ? (
              <YandexContestEmbed url={url} />
            ) : (
              <BlockPlaceholder variant="contest" />
            );
          })()}
        </div>
      )}
    </div>
  );
}
