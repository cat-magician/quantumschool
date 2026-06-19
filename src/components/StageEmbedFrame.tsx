import type { ReactNode } from 'react';

interface StageEmbedFrameProps {
  children: ReactNode;
  minHeight?: number;
}

/** Белая панель-фрейм для встроенного контента этапов (форма, контест). */
export default function StageEmbedFrame({ children, minHeight }: StageEmbedFrameProps) {
  return (
    <div className="overflow-x-auto">
      <div
        className="stage-embed-frame mx-auto bg-white border border-slate-200/70 shadow-[0_2px_16px_rgba(0,0,0,0.12)] px-8 py-6 sm:px-10 sm:py-8"
        style={minHeight ? { minHeight } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
