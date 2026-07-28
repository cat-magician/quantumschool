import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  CONTENT_IMAGE_ACCEPT,
  CONTENT_IMAGE_HINT,
  uploadContentImage,
} from '../lib/contentImageUtils';
import LessonCoverImage from './LessonCoverImage';

type ImageSourceInputProps = {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  hint?: string;
  previewClassName?: string;
  onPreviewError?: () => void;
  previewFailed?: boolean;
};

export default function ImageSourceInput({
  value,
  onChange,
  placeholder = 'https://disk.yandex.ru/i/… или прямая ссылка',
  hint = CONTENT_IMAGE_HINT,
  previewClassName = 'max-w-full rounded-xl border border-white/10',
  onPreviewError,
  previewFailed,
}: ImageSourceInputProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (file: File | null) => {
    if (!file || !user) return;
    setUploading(true);
    setUploadError('');
    const { url, error } = await uploadContentImage(user.id, file);
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
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {uploading ? 'Загрузка…' : 'Файл'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={CONTENT_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>

      {hint && <p className="text-[11px] text-slate-600 leading-relaxed">{hint}</p>}
      {uploadError && <p className="text-[11px] text-rose-400">{uploadError}</p>}

      {value.trim() && (
        previewFailed ? (
          <p className="text-[11px] text-rose-400">
            Не удалось показать изображение. Проверьте ссылку или загрузите файл заново.
          </p>
        ) : (
          <LessonCoverImage
            url={value.trim()}
            className={previewClassName}
            onError={onPreviewError}
          />
        )
      )}
    </div>
  );
}
