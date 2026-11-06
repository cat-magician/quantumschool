import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { BarChart3, Calendar, GraduationCap, Home, Sparkles } from 'lucide-react';
import AchievementUnlockDialog from '../../components/achievements/AchievementUnlockDialog';
import type { AchievementUnlock } from '../../lib/achievementUtils';
import { publicAsset } from '../../lib/appPaths';

/**
 * Только для разработки (/dev/achievement): окно «новое достижение» без входа
 * и без базы — проверить свою картинку, тексты и анимацию.
 */
export default function AchievementPreview() {
  const [title, setTitle] = useState('Кот Шрёдингера');
  const [description, setDescription] = useState(
    'Здесь будет описание: за что выдано достижение. Лучше всего читаются одна-две строки.',
  );
  const [imageSrc, setImageSrc] = useState<string | null>(publicAsset('/cat-schrodinger.svg'));
  const [queue, setQueue] = useState<AchievementUnlock[]>([]);
  const [run, setRun] = useState(0);
  const blobUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
  }, []);

  const custom = (suffix: string): AchievementUnlock => ({
    id: `preview-${run}-${suffix}`,
    code: null,
    title: title.trim() || 'Без названия',
    description: description.trim(),
    imageSrc,
  });

  const showOne = () => {
    setRun((n) => n + 1);
    setQueue([custom('one')]);
  };

  const showQueue = () => {
    setRun((n) => n + 1);
    setQueue([
      custom('first'),
      {
        id: `preview-${run}-graded`,
        code: 'homework_first_graded',
        title: 'ДЗ проверено',
        description: 'Преподаватель проверил вашу работу и поставил оценку',
        imageSrc: null,
      },
      {
        id: `preview-${run}-excellent`,
        code: 'homework_excellent',
        title: 'Отличная работа',
        description: 'Оценка за домашнее задание — не меньше 80% от максимума',
        imageSrc: null,
      },
    ]);
  };

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = URL.createObjectURL(file);
    setImageSrc(blobUrl.current);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <CabinetBackdrop />

      <div className="fixed left-4 right-4 top-4 z-10 space-y-3 rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl sm:left-auto sm:right-6 sm:top-6 sm:w-80">
        <p className="text-sm font-semibold">Предпросмотр окна достижения</p>
        <label className="block text-xs text-slate-400">
          Картинка
          <input
            type="file"
            accept="image/*"
            onChange={pickImage}
            className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Название
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Описание
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={showOne}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2.5 text-sm font-semibold"
          >
            Показать
          </button>
          <button
            type="button"
            onClick={showQueue}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium"
          >
            Три подряд
          </button>
        </div>
      </div>

      {queue.length > 0 && (
        <AchievementUnlockDialog
          key={run}
          items={queue}
          onDismiss={(id) => setQueue((current) => current.filter((item) => item.id !== id))}
          onClosed={() => setQueue([])}
        />
      )}
    </div>
  );
}

/** Подобие кабинета под окном — чтобы было видно, как просвечивает стекло. */
function CabinetBackdrop() {
  const nav = [
    { icon: Home, label: 'Главная' },
    { icon: Calendar, label: 'Расписание' },
    { icon: GraduationCap, label: 'Обучение' },
    { icon: BarChart3, label: 'Прогресс', active: true },
  ];
  return (
    <div className="flex min-h-screen" aria-hidden>
      <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-white/5 bg-slate-900/80 p-4 lg:flex">
        <div className="mb-4 flex items-center gap-3 px-2 py-3">
          <img src={publicAsset('/logo_qc.svg')} alt="" className="h-9 w-9 brightness-0 invert" />
          <span className="font-bold">Квантовый кружок</span>
        </div>
        {nav.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
              item.active
                ? 'border border-blue-500/20 bg-gradient-to-r from-blue-600/30 to-violet-600/30'
                : 'text-slate-400'
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </div>
        ))}
      </aside>
      <main className="flex-1 p-4 pt-[25rem] sm:p-8 sm:pt-8">
        <h1 className="mb-6 text-lg font-semibold">Прогресс</h1>
        <div className="grid max-w-3xl grid-cols-3 gap-2.5">
          {['Проверено', 'На проверке', 'Средняя'].map((label, i) => (
            <div key={label} className="rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2.5">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <div className="mt-3 text-lg font-bold">{['4', '1', '8,5/10'][i]}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 max-w-3xl space-y-1.5">
          {['Кубит и сфера Блоха', 'Гейты Паули', 'Запутанность и неравенства Белла', 'Квантовая телепортация'].map((name) => (
            <div key={name} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2.5">
              <span className="text-sm">{name}</span>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                Проверено
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
