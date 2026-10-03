import { useEffect, useRef } from 'react';
import StageEmbedFrame from './StageEmbedFrame';
import {
  yandexFormIframeName,
  yandexFormIframeSrc,
  type YandexFormPrefill,
} from '../lib/selectionConfig';

type YandexFormEmbedProps = {
  formId: string;
  title?: string;
  /** Ответ, подставленный за участника: код аккаунта в скрытом вопросе формы. */
  prefill?: YandexFormPrefill | null;
};

/**
 * Яндекс.Форма во встроенном iframe. Высоту форма сообщает сама — раньше её
 * подхватывал embed.js Яндекса, но он стоял в index.html на каждой странице и
 * блокировал загрузку сайта ради одной подписки на сообщения.
 */
export default function YandexFormEmbed({
  formId,
  title,
  prefill = null,
}: YandexFormEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const src = yandexFormIframeSrc(formId, prefill);
  const frameName = yandexFormIframeName(formId);

  // Как в embed.js: форма шлёт {"iframe-height": N}, подгоняем свой iframe.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;
      try {
        const height = JSON.parse(event.data)['iframe-height'];
        if (height) iframe.style.height = `${height}px`;
      } catch {
        // Сообщение другого формата — не о высоте.
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!src) return null;

  return (
    <div className="yandex-form-embed w-full">
      {title && (
        <p className="text-sm text-slate-500 mb-4">{title}</p>
      )}
      <StageEmbedFrame flush minHeight={420}>
        <iframe
          ref={iframeRef}
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
