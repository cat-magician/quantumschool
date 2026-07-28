import { useEffect, useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import {
  DEFAULT_COMMUNITY_CONFIG,
  fetchCommunityConfig,
  isCommunityTelegramVisible,
} from '../lib/communityConfig';
import type { CommunityConfig } from '../lib/types';

export default function TelegramCommunityCard({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const [config, setConfig] = useState<CommunityConfig>(DEFAULT_COMMUNITY_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCommunityConfig()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !isCommunityTelegramVisible(config)) return null;

  const message =
    config.telegram_invite_message.trim() || DEFAULT_COMMUNITY_CONFIG.telegram_invite_message;
  const url = config.telegram_invite_url.trim();

  if (compact) {
    return (
      <div className={`rounded-2xl border border-sky-500/25 bg-sky-500/5 px-5 py-4 ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <MessageCircle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors shrink-0"
          >
            Telegram-канал
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-600/15 to-blue-600/5 overflow-hidden ${className}`}>
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6 text-sky-300" />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Telegram-канал кружка</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors"
            >
              Перейти в канал
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
