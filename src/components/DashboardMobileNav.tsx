import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTouchScrollLock } from '../hooks/useTouchScrollLock';

export type MobileNavQuickItem = {
  id: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  active: boolean;
  disabled?: boolean;
  badge?: number;
  onClick: () => void;
};

type DashboardMobileNavProps = {
  items: MobileNavQuickItem[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  menuTitle: string;
  children: ReactNode;
};

/** Пять вкладок помещаются в 360 px рядом с «Меню»; больше — лента листается. */
const QUICK_FIT_MAX = 5;

const quickBtnClass = (active: boolean, fill: boolean, disabled?: boolean) =>
  `${fill ? 'flex-1 min-w-0' : 'shrink-0 w-[4.75rem]'} flex flex-col items-center justify-center gap-1 px-1 py-2 min-h-[3.5rem] text-[11px] leading-tight transition-colors ${
    disabled
      ? 'text-slate-700 cursor-not-allowed'
      : active
        ? 'text-blue-400'
        : 'text-slate-400 hover:text-slate-200'
  }`;

export default function DashboardMobileNav({
  items,
  menuOpen,
  onMenuOpenChange,
  menuTitle,
  children,
}: DashboardMobileNavProps) {
  const fill = items.length <= QUICK_FIT_MAX;
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const activeId = items.find((item) => item.active)?.id;

  // В листаемой ленте (кабинет сотрудника) активная вкладка могла стоять за
  // краем экрана — человек не видел, где он.
  useEffect(() => {
    if (fill) return;
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeId, fill]);

  useTouchScrollLock(menuOpen);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMenuOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, onMenuOpenChange]);

  return (
    <>
      {/* Фон сплошной, без backdrop-blur: размытие под фиксированной панелью
          пересчитывается на каждом кадре прокрутки и тормозит слабые телефоны. */}
      <nav
        aria-label="Разделы"
        className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900 border-t border-white/10 pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
      >
        <div className="flex items-stretch">
          <div className="flex-1 min-w-0 relative">
            <div className={`flex ${fill ? '' : 'overflow-x-auto overscroll-x-contain scrollbar-none'}`}>
              {items.map((item) => (
                <button
                  key={item.id}
                  ref={item.active ? activeRef : undefined}
                  type="button"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={quickBtnClass(item.active, fill, item.disabled)}
                  aria-label={item.label}
                  aria-current={item.active ? 'page' : undefined}
                >
                  <span className="relative shrink-0">
                    <item.icon className="w-5 h-5" />
                    {item.badge != null && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[1rem] h-4 px-0.5 rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center tabular-nums">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate text-center">{item.shortLabel ?? item.label}</span>
                </button>
              ))}
            </div>
            {!fill && (
              // Подсказка, что лента листается: край вкладок уходит в тень.
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-900 to-transparent"
                aria-hidden
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => onMenuOpenChange(true)}
            className="shrink-0 w-14 flex flex-col items-center justify-center gap-1 border-l border-white/10 text-slate-400 hover:text-white transition-colors"
            aria-label="Открыть меню"
            aria-expanded={menuOpen}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[11px] leading-tight">Меню</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          {/* touch-none: свайп по затемнению не прокручивает страницу под меню. */}
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 touch-none"
            aria-label="Закрыть меню"
            onClick={() => onMenuOpenChange(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={menuTitle}
            className="absolute inset-y-0 right-0 w-[min(100vw,20rem)] bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col pr-[env(safe-area-inset-right,0px)]"
          >
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/5 shrink-0">
              <p className="text-sm font-semibold text-white">{menuTitle}</p>
              <button
                type="button"
                onClick={() => onMenuOpenChange(false)}
                className="w-11 h-11 -mr-1.5 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-400"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-site p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-1">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function mobileMenuBtn(active: boolean) {
  return `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
    active
      ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
  }`;
}

export function mobileMenuSubBtn(active: boolean) {
  return `w-full flex items-center gap-2 px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-blue-600/25 text-blue-200 border border-blue-500/25 shadow-sm shadow-blue-500/10'
      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
  }`;
}

type MobileMenuCollapsibleSectionProps = {
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
};

export function MobileMenuCollapsibleSection({
  active,
  expanded,
  onToggle,
  icon: Icon,
  label,
  disabled,
  trailing,
  children,
}: MobileMenuCollapsibleSectionProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`${mobileMenuBtn(active)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className="flex-1 min-w-0 text-left">{label}</span>
        {trailing}
        {!disabled && (
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {!disabled && (
        <div
          className={`grid transition-all duration-200 ${
            expanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-1">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}

type MobileSubNavItem = {
  id: string;
  label: string;
  /** Подпись для узкой полосы; без неё — label. */
  shortLabel?: string;
  icon: LucideIcon;
};

/** До трёх подразделов делят полосу поровну, больше — лента листается. */
const SUB_NAV_FIT_MAX = 3;

/**
 * Подразделы на телефоне — одна полоса над содержимым. Раньше это был
 * столбик кнопок на всю ширину, прилипший под шапкой: вместе с ней он
 * съедал до трети экрана, и первая лекция начиналась ниже середины.
 */
export function MobileSubNavBar({
  items,
  activeId,
  onSelect,
}: {
  items: MobileSubNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const fit = items.length <= SUB_NAV_FIT_MAX;
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // В листаемой полосе выбранный подраздел может стоять за краем экрана.
  useEffect(() => {
    if (fit) return;
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeId, fit]);

  // Один пункт переключать не на что — у зачисленного ученика в «Отборе»
  // остаются только «Результаты», и заголовок шапки уже это говорит.
  if (items.length < 2) return null;

  return (
    <div className="lg:hidden border-b border-white/5 py-2">
      <div className={`flex gap-1 px-4 ${fit ? '' : 'overflow-x-auto overscroll-x-contain scrollbar-none'}`}>
        {items.map((sub) => {
          const active = activeId === sub.id;
          return (
            <button
              key={sub.id}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(sub.id)}
              aria-pressed={active}
              className={`${fit ? 'flex-1 min-w-0' : 'shrink-0'} flex items-center justify-center gap-1.5 min-h-11 px-2 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600/25 text-blue-100 border border-blue-500/30'
                  : 'text-slate-400 border border-white/5 hover:text-white hover:bg-white/5'
              }`}
            >
              {/* Значок только там, где он не отнимает места у подписи. */}
              <sub.icon className={`w-4 h-4 shrink-0 ${fit ? 'hidden min-[420px]:block' : ''}`} />
              <span className="truncate">{sub.shortLabel ?? sub.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
