import {
  BookOpen, ExternalLink, FileText, FlaskConical, Image, Presentation, Video,
} from 'lucide-react';
import StageEmbedFrame from './StageEmbedFrame';

export type BlockPlaceholderVariant =
  | 'text'
  | 'image'
  | 'video'
  | 'recording'
  | 'materials'
  | 'homework_link'
  | 'yandex_form'
  | 'contest';

const COPY: Record<BlockPlaceholderVariant, { title: string; text: string; Icon: typeof FileText; tone: 'blue' | 'violet' | 'slate' }> = {
  text: {
    title: 'Текст пока не добавлен',
    text: 'Преподаватель опубликует описание или условие задания здесь.',
    Icon: FileText,
    tone: 'slate',
  },
  image: {
    title: 'Изображение появится здесь',
    text: 'Ссылка на картинку будет добавлена позже.',
    Icon: Image,
    tone: 'slate',
  },
  video: {
    title: 'Видео появится здесь',
    text: 'После публикации здесь будет встроенная запись или ссылка на неё.',
    Icon: Video,
    tone: 'slate',
  },
  recording: {
    title: 'Запись занятия появится здесь',
    text: 'После публикации здесь будет запись лекции или семинара.',
    Icon: Presentation,
    tone: 'slate',
  },
  materials: {
    title: 'Материалы появятся здесь',
    text: 'Вставьте публичную ссылку Яндекс.Диска — PDF и презентации откроются прямо на сайте.',
    Icon: BookOpen,
    tone: 'slate',
  },
  homework_link: {
    title: 'Ссылка на домашнее задание',
    text: 'Переход к заданию будет доступен после публикации.',
    Icon: ExternalLink,
    tone: 'violet',
  },
  yandex_form: {
    title: 'Форма сдачи скоро появится',
    text: 'После настройки формы вы сможете отправить ответ прямо на этой странице.',
    Icon: FileText,
    tone: 'blue',
  },
  contest: {
    title: 'Контест скоро появится',
    text: 'После публикации контест откроется прямо здесь.',
    Icon: FlaskConical,
    tone: 'violet',
  },
};

function toneClasses(tone: 'blue' | 'violet' | 'slate') {
  if (tone === 'blue') return { box: 'bg-blue-100 border-blue-200', icon: 'text-blue-500' };
  if (tone === 'violet') return { box: 'bg-violet-100 border-violet-200', icon: 'text-violet-500' };
  return { box: 'bg-slate-100 border-slate-200', icon: 'text-slate-500' };
}

const FLUSH_VARIANTS: BlockPlaceholderVariant[] = ['yandex_form', 'contest'];

/** Заглушка в том же стиле, что форма/контест на отборочном этапе. */
export default function BlockPlaceholder({
  variant,
  minHeight = 420,
}: {
  variant: BlockPlaceholderVariant;
  minHeight?: number;
}) {
  const { title, text, Icon, tone } = COPY[variant];
  const colors = toneClasses(tone);
  const flush = FLUSH_VARIANTS.includes(variant);

  return (
    <StageEmbedFrame minHeight={minHeight} centerContent flush={flush}>
      <div className="flex flex-col items-center justify-center text-center py-12 px-6 w-full">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border ${colors.box}`}>
          <Icon className={`w-8 h-8 ${colors.icon}`} />
        </div>
        <h4 className="text-lg font-semibold text-slate-800 mb-2">{title}</h4>
        <p className="text-slate-500 text-sm max-w-md leading-relaxed">{text}</p>
      </div>
    </StageEmbedFrame>
  );
}
