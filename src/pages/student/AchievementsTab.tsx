import { useEffect, useState } from 'react';
import { Award, Loader2, Star, CheckCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import type { Achievement } from '../../lib/types';

const ICON_MAP: Record<string, typeof Award> = {
  award: Award,
  star: Star,
  check: CheckCircle,
  send: Send,
};

export default function StudentAchievementsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('achievements')
      .select('*')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false })
      .then(({ data }) => {
        if (data) setItems(data);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-slate-400 text-sm">
        Награды за успехи в обучении и отборе. Новые достижения появляются автоматически.
      </p>

      {items.length === 0 ? (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center">
          <Award className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Пока нет достижений — они появятся по мере обучения</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((a) => {
            const Icon = ICON_MAP[a.icon] ?? Award;
            return (
              <div
                key={a.id}
                className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 rounded-2xl p-5"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white mb-1">{a.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{a.description}</p>
                <p className="text-xs text-slate-600 mt-3">
                  {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a.earned_at))}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
