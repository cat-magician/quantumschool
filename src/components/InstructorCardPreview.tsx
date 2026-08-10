import { useEffect, useRef, useState } from 'react';
import LessonCoverImage from './LessonCoverImage';

/** Ширина карточки в карусели на главной (см. App.tsx). */
export const INSTRUCTOR_CARD_WIDTH = 258;

type InstructorCardPreviewProps = {
  name: string;
  title: string;
  bio: string;
  imageUrl: string;
  width?: number;
  /** Кнопка «Читать далее» при обрезке текста */
  interactive?: boolean;
  /** На сайте: пустые поля скрываются, без плейсхолдеров */
  live?: boolean;
  className?: string;
  imageClassName?: string;
};

export default function InstructorCardPreview({
  name,
  title,
  bio,
  imageUrl,
  width = INSTRUCTOR_CARD_WIDTH,
  interactive = false,
  live = false,
  className = '',
  imageClassName = '',
}: InstructorCardPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);
  const [bioClamped, setBioClamped] = useState(false);
  const compact = width < 248;
  const nameTrimmed = name.trim();
  const titleTrimmed = title.trim();
  const bioTrimmed = bio.trim();
  const imageTrimmed = imageUrl.trim();
  const showExpand = interactive && bioTrimmed && bioClamped;

  useEffect(() => {
    setExpanded(false);
  }, [bioTrimmed, width]);

  useEffect(() => {
    const el = bioRef.current;
    if (!el || !bioTrimmed || expanded) {
      setBioClamped(false);
      return;
    }

    const measure = () => {
      setBioClamped(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [bioTrimmed, expanded, width]);

  if (live && !nameTrimmed && !titleTrimmed && !bioTrimmed && !imageTrimmed) {
    return null;
  }

  const showImage = live ? Boolean(imageTrimmed) : true;
  const showName = live ? Boolean(nameTrimmed) : true;
  const showTitle = live ? Boolean(titleTrimmed) : true;
  const showBio = live ? Boolean(bioTrimmed) : true;

  return (
    <div className={`flex-shrink-0 w-full max-w-full ${className}`} style={{ maxWidth: width }}>
      <div className="h-full bg-white rounded-2xl border border-slate-200/90 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]">
        {showImage && (
          <div className={`relative overflow-hidden rounded-t-2xl bg-slate-100 ${compact ? 'h-52' : 'h-60'}`}>
            {imageTrimmed ? (
              <LessonCoverImage url={imageTrimmed} className={`w-full h-full object-cover ${imageClassName}`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs px-3 text-center">
                Фото сверху карточки
              </div>
            )}
          </div>
        )}
        <div className={compact ? 'p-4' : 'p-5'}>
          {showName && (
            <h3 className="text-base font-bold text-slate-900 mb-1">{nameTrimmed || 'Имя'}</h3>
          )}
          {showTitle && (
            <p className="text-cyan-600 font-medium text-sm mb-2.5">{titleTrimmed || 'Должность / звание'}</p>
          )}
          {showBio && (
            bioTrimmed ? (
              <>
                <p
                  ref={bioRef}
                  className={`text-slate-600 text-sm leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}
                >
                  {bioTrimmed}
                </p>
                {showExpand && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2 text-cyan-600 hover:text-cyan-700 text-xs font-medium transition-colors duration-200"
                  >
                    {expanded ? 'Свернуть' : 'Читать далее'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400 italic">Описание не задано</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
