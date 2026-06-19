import { Calendar } from 'lucide-react';

export default function AdminPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Calendar className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400 text-sm">{description}</p>
        <p className="text-slate-500 text-xs mt-4">Раздел в разработке</p>
      </div>
    </div>
  );
}
