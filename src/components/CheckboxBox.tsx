import { Check } from 'lucide-react';

/**
 * Квадратик чекбокса в стиле сайта. Внутри — настоящий input type="checkbox",
 * поэтому клавиатура, подпись-label и required работают как у обычного.
 * Ставится внутрь своего label рядом с текстом. Отдельный модуль: его берёт
 * и согласие на обработку данных, которое грузится вместе со стартом сайта,
 * — тянуть туда остальные поля форм незачем.
 */
export function CheckboxBox({
  tone = 'dark',
  className = '',
  ...props
}: { tone?: 'dark' | 'light' } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const box = tone === 'dark'
    ? 'border-white/25 bg-slate-950/80 group-hover:border-white/40 checked:border-blue-500 checked:bg-blue-600 focus-visible:ring-offset-slate-900'
    : 'border-slate-300 bg-white group-hover:border-slate-400 checked:border-blue-600 checked:bg-blue-600 focus-visible:ring-offset-white';
  return (
    <span className={`relative inline-flex h-[18px] w-[18px] shrink-0 ${className}`}>
      <input
        type="checkbox"
        {...props}
        className={`peer absolute inset-0 m-0 appearance-none rounded-[5px] border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${box}`}
      />
      <Check
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  );
}
