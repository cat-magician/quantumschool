import { Eye } from 'lucide-react';

export default function StudentPagePreviewBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-600/15 border border-violet-500/35 text-violet-200 text-sm">
      <Eye className="w-4 h-4 shrink-0" />
      <span>Предпросмотр — так страницу видят ученики</span>
    </div>
  );
}
