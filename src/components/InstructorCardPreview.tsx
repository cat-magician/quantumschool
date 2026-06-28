import { useState } from 'react';
import LessonCoverImage from './LessonCoverImage';
import { INSTRUCTOR_BIO_EXPAND_HINT } from '../lib/siteContentLimits';

/** Ширина карточки в карусели на главной (см. App.tsx). */
export const INSTRUCTOR_CARD_WIDTH = 258;

type InstructorCardPreviewProps = {
  name: string;
  title: string;
  bio: string;
  imageUrl: string;
  width?: number;
  /** Кнопка «Читать далее» в превью админки */
  interactive?: boolean;
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
  className = '',
  imageClassName = '',
}: InstructorCardPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const compact = width < 248;
  const bioTrimmed = bio.trim();
  const showExpand = interactive && bioTrimmed.length > INSTRUCTOR_BIO_EXPAND_HINT;

  return (
    <div className={`flex-shrink-0 w-full max-w-full ${className}`} style={{ maxWidth: width }}>
      <div className="h-full bg-white rounded-2xl border border-slate-200/90 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]">
        <div className={`relative overflow-hidden rounded-t-2xl bg-slate-100 ${compact ? 'h-52' : 'h-60'}`}>
          {imageUrl.trim() ? (
            <LessonCoverImage url={imageUrl} className={`w-full h-full object-cover ${imageClassName}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs px-3 text-center">
              Фото сверху карточки
            </div>
          )}
        </div>
        <div className={compact ? 'p-4' : 'p-5'}>
          <h3 className="text-base font-bold text-slate-900 mb-1">{name.trim() || 'Имя'}</h3>
          <p className="text-cyan-600 font-medium text-sm mb-2.5">{title.trim() || 'Должность / звание'}</p>
          {bioTrimmed ? (
            <>
              <p
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
          )}
        </div>
      </div>
    </div>
  );
}
