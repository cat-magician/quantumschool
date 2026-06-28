import { ExternalLink } from 'lucide-react';
import { resolveVideoEmbed } from '../lib/videoEmbedUtils';

export default function VideoEmbed({ url }: { url: string }) {
  const resolved = resolveVideoEmbed(url);

  if (!resolved) {
    return (
      <p className="text-sm text-slate-500 bg-slate-950/40 border border-white/5 rounded-xl px-4 py-3">
        Укажите ссылку на запись (YouTube, Rutube, VK Video или другой сервис).
      </p>
    );
  }

  if (resolved.kind === 'link') {
    return (
      <a
        href={resolved.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition-colors text-sm font-medium"
      >
        <ExternalLink className="w-4 h-4 shrink-0" />
        Открыть запись занятия
      </a>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black aspect-video">
      <iframe
        src={resolved.embedUrl}
        title="Запись занятия"
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
