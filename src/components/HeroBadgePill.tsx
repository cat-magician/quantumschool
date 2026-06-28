import { Atom } from 'lucide-react';
import { DEFAULT_LANDING_CONFIG, formatHeroBadgeText } from '../lib/landingConfig';

type HeroBadgePillProps = {
  text: string;
  /** Подпись в превью, когда поле пустое */
  emptyLabel?: string;
  className?: string;
};

export default function HeroBadgePill({ text, emptyLabel, className = '' }: HeroBadgePillProps) {
  const formatted = formatHeroBadgeText(text);
  const display = formatted || emptyLabel || formatHeroBadgeText(DEFAULT_LANDING_CONFIG.hero_badge_text);

  return (
    <div
      className={`inline-flex max-w-full items-center gap-3 px-4 sm:px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full text-blue-300 text-sm sm:text-base font-semibold tracking-wide ${className}`}
    >
      <Atom className="w-5 h-5 flex-shrink-0" />
      <span className="text-center break-words">{display}</span>
    </div>
  );
}
