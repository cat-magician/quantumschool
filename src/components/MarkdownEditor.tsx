import { useRef, useState } from 'react';
import { Eye, ImagePlus, Loader2, Pencil } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { uploadContentImage } from '../lib/contentImageUtils';
import MarkdownContent from './MarkdownContent';
import HomeworkMarkdown from './HomeworkMarkdown';

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 10,
  preparePreview,
  allowImageUpload = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  preparePreview?: (value: string) => string;
  allowImageUpload?: boolean;
}) {
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const insertImageMarkdown = (url: string) => {
    const snippet = `\n\n![изображение](${url})\n\n`;
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + snippet + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + snippet.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    onChange(value.trim() ? `${value.trim()}${snippet}` : snippet.trim());
  };

  const handleImageFile = async (file: File | null) => {
    if (!file || !user) return;
    setUploading(true);
    setUploadError('');
    const { url, error } = await uploadContentImage(user.id, file);
    setUploading(false);
    if (error) {
      setUploadError(error);
      return;
    }
    if (url) insertImageMarkdown(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === 'edit'
              ? 'bg-blue-600/25 text-blue-200 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
        >
          <Pencil className="w-3 h-3" />
          Редактор
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === 'preview'
              ? 'bg-blue-600/25 text-blue-200 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
        >
          <Eye className="w-3 h-3" />
          Просмотр
        </button>
        {allowImageUpload && mode === 'edit' && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !user}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
              {uploading ? 'Загрузка…' : 'Картинка'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                void handleImageFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder ?? 'Markdown: **жирный**, $E=mc^2$, списки…'}
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm font-mono resize-y min-h-[8rem]"
        />
      ) : (
        <div className="min-h-[8rem] px-3 py-3 rounded-xl bg-slate-950/80 border border-white/10">
          {value.trim() ? (
            preparePreview ? (
              <HomeworkMarkdown source={value} />
            ) : (
              <MarkdownContent content={value} />
            )
          ) : (
            <p className="text-sm text-slate-600">Нет содержимого для предпросмотра</p>
          )}
        </div>
      )}

      {uploadError && <p className="text-[11px] text-rose-400">{uploadError}</p>}

      <p className="text-[11px] text-slate-600">
        Поддерживается Markdown и формулы LaTeX: $inline$ и $$блок$$. Картинки — кнопкой «Картинка» или ссылкой.
      </p>
    </div>
  );
}
