import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useDismissOnOutside, usePopoverPosition } from '../hooks/usePopover';

export { FormDate, FormDatetime, FormDuration, FormTime } from './DateTimeControls';

export const formFieldClass =
  'w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-colors';

type FieldProps = {
  className?: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export function FormText({
  className = '',
  ...props
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${formFieldClass} placeholder-slate-500 ${className}`}
    />
  );
}

export function FormTextarea({
  className = '',
  ...props
}: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${formFieldClass} placeholder-slate-500 resize-none ${className}`}
    />
  );
}

export function FormSelect({
  value,
  onChange,
  options,
  placeholder = 'Выберите…',
  className = '',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [btnRef, panelRef], []);
  const close = useCallback(() => setOpen(false), []);

  useDismissOnOutside(open, close, refs);
  const style = usePopoverPosition(open, btnRef, panelRef, { matchWidth: true, maxHeight: 224 });

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${formFieldClass} flex items-center justify-between gap-2 text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className={`truncate ${selected ? 'text-white' : 'text-slate-500'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={style}
          className="fixed z-[200] overflow-y-auto overscroll-contain scrollbar-site rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                opt.value === value
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function FormNumber({
  className = '',
  ...props
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      {...props}
      className={`${formFieldClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  );
}

/** Переключатель «включено/выключено» с подписью и пояснением. */
export function FormSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 group ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 m-0 h-full w-full cursor-[inherit] opacity-0"
        />
        <span
          aria-hidden
          className="h-6 w-11 rounded-full border border-white/15 bg-white/10 transition-colors group-hover:border-white/25 peer-checked:border-blue-500 peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-900"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-sm text-slate-200">{label}</span>
        {description && (
          <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</span>
        )}
      </span>
    </label>
  );
}

export function FormLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm text-slate-400 mb-1.5 ${className}`}>
      {children}
    </label>
  );
}
