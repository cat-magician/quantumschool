import type { Group } from '../lib/types';

const CHIP = 'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors';
const CHIP_ON = 'bg-blue-600/20 text-blue-200 border-blue-500/40';
const CHIP_OFF = 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:border-white/20';

/** Выбор групп-адресатов. Ничего не выбрано — для всех зачисленных. */
export default function GroupMultiSelect({
  groups,
  value,
  onChange,
}: {
  groups: Pick<Group, 'id' | 'name'>[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  if (groups.length === 0) {
    return <p className="text-xs text-slate-500">Групп пока нет — увидят все зачисленные</p>;
  }

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Группы">
      <button
        type="button"
        aria-pressed={value.length === 0}
        onClick={() => onChange([])}
        className={`${CHIP} ${value.length === 0 ? CHIP_ON : CHIP_OFF}`}
      >
        Все зачисленные
      </button>
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          aria-pressed={value.includes(g.id)}
          onClick={() => toggle(g.id)}
          className={`${CHIP} ${value.includes(g.id) ? CHIP_ON : CHIP_OFF}`}
        >
          {g.name}
        </button>
      ))}
    </div>
  );
}
