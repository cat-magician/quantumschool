import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import UserAvatar from '../../components/UserAvatar';
import { UserAchievementsContent } from '../../components/achievements/UserAchievementsPanel';
import AchievementUnlockDialog from '../../components/achievements/AchievementUnlockDialog';
import type { UserAchievement } from '../../hooks/useUserAchievements';
import { publicAsset } from '../../lib/appPaths';
import type { AchievementUnlock } from '../../lib/achievementUtils';

/** Настоящие компоненты с примерами; данные не читаются и не записываются в базу. */
export default function AchievementGallery() {
  const [count, setCount] = useState(4);
  const [queue, setQueue] = useState<AchievementUnlock[]>([]);
  const cat = publicAsset('/cat-schrodinger.svg');
  const logo = publicAsset('/logo_qc.svg');
  const examples: UserAchievement[] = [
    { id: 'example-4', code: 'curiosity', title: 'Вопрос науке', description: 'За вопрос, который помог всей группе разобраться в сложной теме.', imageSrc: cat, earnedAt: '2026-11-06T10:00:00Z' },
    { id: 'example-3', code: 'researcher', title: 'Исследователь', description: 'За самостоятельное исследование и смелую идею.', imageSrc: logo, earnedAt: '2026-11-05T10:00:00Z' },
    { id: 'example-2', code: 'teammate', title: 'Квантовая команда', description: 'За помощь участникам кружка.', imageSrc: cat, earnedAt: '2026-11-04T10:00:00Z' },
    { id: 'example-1', code: 'inspiration', title: 'Вдохновитель', description: 'За увлекательный рассказ о науке.', imageSrc: logo, earnedAt: '2026-11-03T10:00:00Z' },
  ];
  const items = examples.slice(0, count);
  const images = items.map((item) => item.imageSrc ?? logo);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/dev/achievement" className="inline-flex items-center gap-2 py-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Окно получения</Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-violet-300">Предпросмотр</p>
          <h1 className="mt-2 text-2xl font-bold">Достижения в кабинете</h1>
          <p className="mt-2 text-sm text-slate-400">Примеры для проверки вида. Рядом с аватаром — максимум три последние награды.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Количество наград">
          {[0, 1, 2, 3, 4].map((value) => <button key={value} type="button" aria-pressed={count === value} onClick={() => setCount(value)} className={`min-h-10 rounded-xl border px-4 text-sm ${count === value ? 'border-violet-400/50 bg-violet-500/20 text-violet-200' : 'border-white/10 text-slate-400'}`}>{value === 4 ? '4 и больше' : value}</button>)}
        </div>
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="mb-5 text-sm font-semibold text-slate-300">В шапке и списках людей</h2>
          <div className="space-y-4">
            {(['student', 'admin', 'superadmin'] as const).map((role, index) => (
              <div key={role} className="flex items-center gap-3 rounded-xl bg-slate-950/50 p-3">
                <UserAvatar displayName={['Алексей Иванов', 'Анна Петрова', 'Мария Соколова'][index]} size="xs" achievementImageUrls={images} />
                <div className="min-w-0"><p className="truncate text-sm font-medium">{['Алексей Иванов', 'Анна Петрова', 'Мария Соколова'][index]}</p><p className="text-xs text-slate-500">{['Ученик', 'Админ', 'Суперадмин'][index]}</p></div>
              </div>
            ))}
          </div>
        </section>
        <UserAchievementsContent items={items} compact />
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">В личном профиле</h2>
          <button type="button" onClick={() => setQueue(items.map((item) => ({ id: item.id, code: item.code, title: item.title, description: item.description, imageSrc: item.imageSrc })))} disabled={!items.length} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-violet-200 disabled:opacity-40">Окно получения</button>
        </div>
        <UserAchievementsContent items={items} />
      </div>
      {queue.length > 0 && <AchievementUnlockDialog items={queue} onDismiss={(id) => setQueue((current) => current.filter((item) => item.id !== id))} onClosed={() => setQueue([])} />}
    </main>
  );
}
