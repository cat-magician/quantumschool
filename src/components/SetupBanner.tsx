import { useEffect, useState } from 'react';
import { Shield, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SetupBanner() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc('needs_setup').then(({ data, error }) => {
      if (error) {
        setNeedsSetup(null);
        return;
      }
      setNeedsSetup(!!data);
    });
  }, []);

  if (!needsSetup) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/90 to-orange-600/90 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Первичная настройка:</strong> зарегистрируйтесь на сайте — первый аккаунт станет суперадмином
          </span>
        </div>
        <a
          href="#contact"
          className="inline-flex items-center gap-1 text-sm font-semibold bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          Зарегистрироваться
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
