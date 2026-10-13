/**
 * Надпись «Квантовый кружок» по буквам — общая для анимированного заголовка
 * и его заглушки: размеры обеих должны совпадать до пикселя, иначе первый
 * экран прыгал бы, когда догрузится анимация.
 */
export const BRAND_LINE_1 = 'Квантовый';
export const BRAND_LINE_2 = 'кружок';

const GRADIENT = 'linear-gradient(90deg, #60a5fa, #a855f7, #7c3aed)';

export function GradientChars({ text }: { text: string }) {
  const n = text.length;
  return (
    <>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          className="quantum-brand-char"
          style={{
            backgroundImage: GRADIENT,
            backgroundSize: `${n * 100}% 100%`,
            backgroundPosition: n > 1 ? `${(i / (n - 1)) * 100}% 0` : '0 0',
          }}
        >
          {ch}
        </span>
      ))}
    </>
  );
}

/** Строки заголовка; className — для h1 (позиционирование, видимость). */
export function BrandHeadingLines() {
  return (
    <>
      <span className="qb-l1 quantum-brand-charline quantum-brand-line-size" aria-hidden>
        <GradientChars text={BRAND_LINE_1} />
      </span>
      <span className="qb-l2 quantum-brand-charline quantum-brand-line-size quantum-brand-line-size-tight" aria-hidden>
        <GradientChars text={BRAND_LINE_2} />
      </span>
    </>
  );
}

/**
 * Пока догружается анимация (GSAP живёт в отдельном чанке, чтобы его не
 * качали те, кто сразу открывает кабинет), на месте заголовка — он же без
 * анимации. Скрыт, как и анимированный до старта; если чанк не придёт,
 * проявится сам (см. .quantum-brand-fallback в index.css).
 */
export function QuantumBrandTitleFallback() {
  return (
    <div className="quantum-brand relative w-full max-w-[min(100%,36rem)] mx-auto">
      <h1
        className="quantum-brand-fallback relative font-brand text-center"
        aria-label={`${BRAND_LINE_1} ${BRAND_LINE_2}`}
      >
        <BrandHeadingLines />
      </h1>
    </div>
  );
}
