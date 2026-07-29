/** Компактный счётчик для пункта меню (1–99, 99+). */
export default function NavCountBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-blue-500 text-[10px] font-bold text-white tabular-nums leading-none ${className}`}
      aria-label={`${count} требует внимания`}
    >
      {label}
    </span>
  );
}
