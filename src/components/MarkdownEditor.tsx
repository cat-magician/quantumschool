import { useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import MarkdownContent from './MarkdownContent';
import HomeworkMarkdown from './HomeworkMarkdown';

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 10,
  preparePreview,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  preparePreview?: (value: string) => string;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
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
      </div>

      {mode === 'edit' ? (
        <textarea
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

      <p className="text-[11px] text-slate-600">
        Поддерживается Markdown и формулы LaTeX: $inline$ и $$блок$$
      </p>
    </div>
  );
}
