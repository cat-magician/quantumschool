import { FileText, FlaskConical } from 'lucide-react';
import StageEmbedFrame from './StageEmbedFrame';

type Stage = 'essay' | 'contest';

const COPY: Record<Stage, { title: string; text: string; Icon: typeof FileText }> = {
  essay: {
    title: 'Форма скоро появится',
    text: 'Следите за обновлениями в личном кабинете. После публикации форма откроется прямо здесь.',
    Icon: FileText,
  },
  contest: {
    title: 'Контест скоро появится',
    text: 'Следите за обновлениями в личном кабинете. После публикации контест откроется прямо здесь.',
    Icon: FlaskConical,
  },
};

export default function StageComingSoon({ stage, minHeight = 420 }: { stage: Stage; minHeight?: number }) {
  const { title, text, Icon } = COPY[stage];
  return (
    <StageEmbedFrame minHeight={minHeight}>
      <div className="flex flex-col items-center justify-center text-center py-12 px-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border ${
          stage === 'essay'
            ? 'bg-blue-100 border-blue-200'
            : 'bg-violet-100 border-violet-200'
        }`}>
          <Icon className={`w-8 h-8 ${stage === 'essay' ? 'text-blue-500' : 'text-violet-500'}`} />
        </div>
        <h4 className="text-lg font-semibold text-slate-800 mb-2">{title}</h4>
        <p className="text-slate-500 text-sm max-w-md leading-relaxed">{text}</p>
      </div>
    </StageEmbedFrame>
  );
}
