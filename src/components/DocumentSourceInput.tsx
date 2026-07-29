import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  LESSON_DOCUMENT_ACCEPT,
  LESSON_DOCUMENT_HINT,
  uploadLessonDocument,
} from '../lib/contentDocumentUtils';

type DocumentSourceInputProps = {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  hint?: string;
};

export default function DocumentSourceInput({
  value,
  onChange,
  placeholder = 'Загрузите файл или вставьте ссылку',
  hint = LESSON_DOCUMENT_HINT,
}: DocumentSourceInputProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (file: File | null) => {
    if (!file || !user) return;
    setUploading(true);
    setUploadError('');
    const { url, error } = await uploadLessonDocument(user.id, file);
    setUploading(false);
    if (error) {
      setUploadError(error);
      return;
    }
    if (url) onChange(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => {
            setUploadError('');
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="flex-1 min-w-[12rem] px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !user}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
          {uploading ? 'Загрузка…' : 'Загрузить'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={LESSON_DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>

      {hint && <p className="text-[11px] text-slate-600 leading-relaxed">{hint}</p>}
      {uploadError && <p className="text-[11px] text-rose-400">{uploadError}</p>}
    </div>
  );
}
