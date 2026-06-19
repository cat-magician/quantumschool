import StageEmbedFrame from './StageEmbedFrame';
import {
  YANDEX_FORM_EMBED,
  yandexFormIframeName,
  yandexFormIframeSrc,
} from '../lib/constants';

interface YandexFormEmbedProps {
  formId: string;
  title?: string;
  width?: number;
}

/** Яндекс.Форма во встроенном iframe; embed.js в index.html подстраивает высоту. */
export default function YandexFormEmbed({
  formId,
  title,
  width = YANDEX_FORM_EMBED.width,
}: YandexFormEmbedProps) {
  const src = yandexFormIframeSrc(formId);
  const frameName = yandexFormIframeName(formId);

  return (
    <div className="w-full">
      {title && (
        <p className="text-sm text-slate-500 mb-4">{title}</p>
      )}
      <StageEmbedFrame>
        <iframe
          src={src}
          title={title ?? 'Яндекс.Форма'}
          name={frameName}
          width={width}
          frameBorder={0}
          className="block border-0 bg-white"
          style={{ width }}
          allow="clipboard-write"
        />
      </StageEmbedFrame>
    </div>
  );
}
