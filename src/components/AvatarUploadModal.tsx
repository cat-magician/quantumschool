import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload, X, ZoomIn } from 'lucide-react';
import {
  AVATAR_ACCEPT,
  AVATAR_CROP_UI_SIZE,
  AVATAR_HINT,
  type AvatarCropState,
  clampCropOffset,
  createCropState,
  cropStateForZoom,
  renderCroppedAvatarFile,
  validateAvatarInput,
} from '../lib/avatarUtils';

type Step = 'pick' | 'crop';

type AvatarUploadModalProps = {
  open: boolean;
  onClose: () => void;
  hasAvatar: boolean;
  onSave: (file: File) => Promise<string | null>;
  onRemove: () => Promise<string | null>;
};

export default function AvatarUploadModal({
  open,
  onClose,
  hasAvatar,
  onSave,
  onRemove,
}: AvatarUploadModalProps) {
  const [step, setStep] = useState<Step>('pick');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<AvatarCropState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const reset = useCallback(() => {
    setStep('pick');
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImageSize(null);
    setCrop(null);
    setZoom(1);
    setDragging(false);
    setDropActive(false);
    setError('');
    setSaving(false);
    setRemoving(false);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !removing) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, saving, removing]);

  const loadFile = async (file: File) => {
    const validationError = validateAvatarInput(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    const url = URL.createObjectURL(file);
    try {
      const bitmap = await createImageBitmap(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setImageSize({ width: bitmap.width, height: bitmap.height });
      setCrop(createCropState(bitmap.width, bitmap.height, AVATAR_CROP_UI_SIZE, 1));
      setZoom(1);
      setStep('crop');
      bitmap.close();
    } catch {
      URL.revokeObjectURL(url);
      setError('Не удалось прочитать изображение');
    }
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void loadFile(file);
  };

  const handleZoomChange = (nextZoom: number) => {
    if (!imageSize || !crop) return;
    const clamped = Math.min(3, Math.max(1, nextZoom));
    setZoom(clamped);
    setCrop(cropStateForZoom(imageSize.width, imageSize.height, AVATAR_CROP_UI_SIZE, clamped, crop));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!crop || !imageSize) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: crop.offsetX,
      offsetY: crop.offsetY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current || !crop || !imageSize) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setCrop(clampCropOffset(imageSize.width, imageSize.height, AVATAR_CROP_UI_SIZE, crop.coverScale, {
      coverScale: crop.coverScale,
      offsetX: dragStartRef.current.offsetX + dx,
      offsetY: dragStartRef.current.offsetY + dy,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    dragStartRef.current = null;
  };

  const handleSave = async () => {
    if (!previewUrl || !crop || !imageSize) return;

    setSaving(true);
    setError('');

    try {
      const image = await loadImage(previewUrl);
      const { file, error: renderError } = await renderCroppedAvatarFile(image, crop);
      if (renderError || !file) {
        setError(renderError ?? 'Не удалось подготовить аватар');
        setSaving(false);
        return;
      }

      const saveError = await onSave(file);
      setSaving(false);
      if (saveError) {
        setError(saveError);
        return;
      }
      onClose();
    } catch {
      setSaving(false);
      setError('Не удалось сохранить аватар');
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError('');
    const removeError = await onRemove();
    setRemoving(false);
    if (removeError) {
      setError(removeError);
      return;
    }
    onClose();
  };

  if (!open) return null;

  const busy = saving || removing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] overflow-y-auto scrollbar-site bg-slate-900 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl shadow-violet-900/20 my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>

        <h2 id="avatar-modal-title" className="text-lg font-bold text-white pr-10">
          {step === 'pick' ? 'Фото профиля' : 'Подгонка'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">{AVATAR_HINT}</p>

        {error && (
          <p className="mt-4 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {step === 'pick' && (
          <div className="mt-5 space-y-4">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDropActive(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDropActive(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                dropActive
                  ? 'border-blue-400 bg-blue-500/10'
                  : 'border-white/10 bg-slate-950/50 hover:border-white/20'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-white font-medium">Перетащите файл сюда</p>
              <p className="text-xs text-slate-500 mt-1">или выберите на устройстве</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                Выбрать файл
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        )}

        {step === 'crop' && previewUrl && imageSize && crop && (
          <div className="mt-5 space-y-4">
            <div
              className={`relative mx-auto rounded-2xl overflow-hidden bg-slate-950 border border-white/10 touch-none select-none ${
                dragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{ width: AVATAR_CROP_UI_SIZE, height: AVATAR_CROP_UI_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={previewUrl}
                alt=""
                draggable={false}
                className="absolute max-w-none pointer-events-none"
                style={{
                  width: imageSize.width * crop.coverScale,
                  height: imageSize.height * crop.coverScale,
                  left: crop.offsetX,
                  top: crop.offsetY,
                }}
              />
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-2xl" />
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />
            </div>

            <div className="flex items-center gap-3">
              <ZoomIn className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="flex-1 accent-blue-500"
                aria-label="Масштаб"
              />
            </div>
            <p className="text-xs text-slate-500 text-center">Перетащите фото и настройте масштаб</p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep('pick');
                  setError('');
                }}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Сохранить
              </button>
            </div>
          </div>
        )}

        {step === 'pick' && hasAvatar && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRemove()}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Удалить текущее фото
          </button>
        )}
      </div>
    </div>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed'));
    img.src = url;
  });
}
