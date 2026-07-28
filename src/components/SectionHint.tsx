type SectionHintProps = {
  text?: string | null;
  className?: string;
};

/** Одна строка под заголовком раздела — без рамки и списков. */
export default function SectionHint({ text, className = '' }: SectionHintProps) {
  if (!text?.trim()) return null;

  return (
    <p className={`text-xs text-slate-500 leading-relaxed ${className}`}>
      {text}
    </p>
  );
}
