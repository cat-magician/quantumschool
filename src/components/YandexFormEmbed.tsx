import StageEmbedFrame from './StageEmbedFrame';
import {
  yandexFormIframeName,
  yandexFormIframeSrc,
} from '../lib/constants';

interface YandexFormEmbedProps {
  formId: string;
  title?: string;
}

/** Яндекс.Форма во встроенном iframe; embed.js в index.html подстраивает высоту. */
export default function YandexFormEmbed({
  formId,
  title,
}: YandexFormEmbedProps) {
  const src = yandexFormIframeSrc(formId);
  const frameName = yandexFormIframeName(formId);

  return (
    <div className="w-full">
      {title && (
        <p className="text-sm text-slate-500 mb-4">{title}</p>
      )}
      <StageEmbedFrame flush minHeight={420}>
        <iframe
          src={src}
          title={title ?? 'Яндекс.Форма'}
          name={frameName}
          frameBorder={0}
          className="block w-full border-0 bg-white"
          allow="clipboard-write"
        />
      </StageEmbedFrame>
    </div>
  );
}
