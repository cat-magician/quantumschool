import type { ReactNode } from 'react';

interface StageEmbedFrameProps {
  children: ReactNode;
  minHeight?: number;
  /** Центрировать содержимое по вертикали (заглушки) */
  centerContent?: boolean;
  /** Без внутренних отступов — iframe на всю ширину рамки */
  flush?: boolean;
}

/** Белая панель-фрейм для встроенного контента (форма, контест, заглушки). */
export default function StageEmbedFrame({
  children,
  minHeight,
  centerContent = false,
  flush = false,
}: StageEmbedFrameProps) {
  if (flush) {
    return (
      <div
        className={`stage-embed-frame stage-embed-frame--flush mx-auto w-full max-w-[650px] overflow-hidden rounded-xl bg-white border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.12)] ${
          centerContent ? 'flex flex-col items-center justify-center' : ''
        }`}
        style={minHeight ? { minHeight } : undefined}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className={`stage-embed-frame mx-auto w-full max-w-[650px] bg-white border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.12)] px-4 py-4 sm:px-8 sm:py-6 lg:px-10 lg:py-8 ${
          centerContent ? 'flex flex-col items-center justify-center' : ''
        }`}
        style={minHeight ? { minHeight } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
