import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Menu, X } from 'lucide-react';
import type { ReactNode } from 'react';

export type MobileNavQuickItem = {
  id: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type DashboardMobileNavProps = {
  items: MobileNavQuickItem[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  menuTitle: string;
  children: ReactNode;
};

const quickBtnClass = (active: boolean, disabled?: boolean) =>
  `shrink-0 flex flex-col items-center justify-center gap-1 min-w-[4.75rem] max-w-[6.5rem] px-2 py-2.5 text-[11px] leading-tight transition-colors ${
    disabled
      ? 'text-slate-700 cursor-not-allowed'
      : active
        ? 'text-blue-400'
        : 'text-slate-500 hover:text-slate-300'
  }`;

export default function DashboardMobileNav({
  items,
  menuOpen,
  onMenuOpenChange,
  menuTitle,
  children,
}: DashboardMobileNavProps) {
  return (
    <>
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-white/5 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-stretch">
          <div className="flex-1 min-w-0 relative pr-16">
            <div className="flex overflow-x-auto scrollbar-site">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={quickBtnClass(item.active, item.disabled)}
                  aria-label={item.label}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="text-center line-clamp-2">{item.shortLabel ?? item.label}</span>
                </button>
              ))}
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900/95 to-transparent"
              aria-hidden
            />
          </div>
          <button
            type="button"
            onClick={() => onMenuOpenChange(true)}
            className="shrink-0 w-14 flex flex-col items-center justify-center gap-1 border-l border-white/5 text-slate-400 hover:text-white transition-colors"
            aria-label="Открыть меню"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px]">Меню</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-label="Закрыть меню"
            onClick={() => onMenuOpenChange(false)}
          />
          <div className="absolute inset-y-0 right-0 w-[min(100vw,20rem)] bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/5 shrink-0">
              <p className="text-sm font-semibold text-white">{menuTitle}</p>
              <button
                type="button"
                onClick={() => onMenuOpenChange(false)}
                className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-400"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-site p-4 space-y-1">
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
  return `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
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
  icon: LucideIcon;
};

export function MobileSubNavBar({
  items,
  activeId,
  onSelect,
}: {
  items: MobileSubNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="lg:hidden sticky top-16 z-[9] bg-slate-950/95 backdrop-blur-md border-b border-white/5 px-4 py-2 shrink-0">
      <div className="space-y-1">
        {items.map((sub) => {
          const active = activeId === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelect(sub.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? 'bg-blue-600/25 text-blue-200 border border-blue-500/25'
                  : 'text-slate-400 border border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <sub.icon className="w-3.5 h-3.5 shrink-0" />
              {sub.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
