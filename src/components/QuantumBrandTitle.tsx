import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { useLayoutEffect, useRef, useState } from 'react';

gsap.registerPlugin(DrawSVGPlugin);

const BRAND_LINE_1 = 'Квантовый';
const BRAND_LINE_2 = 'кружок';

const GRADIENT = 'linear-gradient(90deg, #60a5fa, #a855f7, #7c3aed)';

const CYAN = '#67e8f9';
const VIOLET = '#a78bfa';

/* Only properties the timeline animates — never 'all', otherwise the
   React-applied inline gradient styles on the chars get wiped too. */
const ANIMATED_PROPS = 'transform,opacity,filter,visibility,strokeDasharray,strokeDashoffset';

/* All scene geometry is computed in REAL PIXELS from the rendered DOM:
   the viewBox equals the box size (1:1 mapping), so circles stay round
   and gate boxes stay square on every viewport — no stretched viewBox. */
type Geom = {
  W: number; /* svg width  = title block + side margins */
  H: number; /* svg height = title block height */
  inset: number; /* side margin in px */
  yA: number; /* center of line 1 */
  yB: number; /* center of line 2 */
  l1L: number; /* left edge of line 1 text, svg coords */
  l1R: number;
  l2L: number;
  l2R: number;
  u: number; /* detail size unit, scales with block height */
};

function GradientChars({ text }: { text: string }) {
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

function StrokePath({ d, color, width = 1.2, className }: { d: string; color: string; width?: number; className?: string }) {
  return (
    <path
      className={className}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export default function QuantumBrandTitle() {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [geom, setGeom] = useState<Geom | null>(null);

  /* Measure the rendered title and derive pixel geometry.
     Glyph edges are only trustworthy once the brand font (Unbounded 900) is
     actually applied to the layout, so we (1) explicitly wait for it to load,
     (2) measure after a double rAF so the browser has re-laid-out with it,
     and (3) keep a ResizeObserver to self-correct on a late font swap or a
     viewport change. This kills the "wrong for the first reloads" race that
     came from measuring against fallback-font metrics. */
  useLayoutEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    const title = titleRef.current;
    if (!root || !glow || !title) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      glow.classList.add('quantum-brand-glow-alive');
      return;
    }

    let cancelled = false;
    let raf = 0;

    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      const c1 = title.querySelectorAll('.qb-l1 .quantum-brand-char');
      const c2 = title.querySelectorAll('.qb-l2 .quantum-brand-char');
      if (!c1.length || !c2.length || rootRect.height < 10 || rootRect.width < 10) return;

      const x = (px: number) => px - rootRect.left;
      const f1 = c1[0].getBoundingClientRect();
      const e1 = c1[c1.length - 1].getBoundingClientRect();
      const f2 = c2[0].getBoundingClientRect();
      const e2 = c2[c2.length - 1].getBoundingClientRect();

      /* Vertical rail centers come from the LINE boxes, not the glyph boxes:
         Unbounded 900's per-glyph rect is the full em (~144px) and would push
         the computed center to the block edge, collapsing the size unit. The
         line span carries the real (tight) line height. */
      const lr1 = title.querySelector('.qb-l1')?.getBoundingClientRect();
      const lr2 = title.querySelector('.qb-l2')?.getBoundingClientRect();
      if (!lr1 || !lr2) return;

      const inset = window.innerWidth >= 640 ? 132 : 66;
      const W = rootRect.width + inset * 2;
      const H = rootRect.height;
      const yA = lr1.top + lr1.height / 2 - rootRect.top;
      const yB = lr2.top + lr2.height / 2 - rootRect.top;

      /* Unit for gates/stubs; clamped so nothing pokes out of the block. */
      let u = 16 * Math.max(H / 240, 0.5);
      u = Math.min(u, (yA - 6) / 1.9, (H - yB - 6) / 1.9);
      u = Math.max(u, 5);

      const next: Geom = {
        W,
        H,
        inset,
        yA,
        yB,
        l1L: inset + x(f1.left),
        l1R: inset + x(e1.right),
        l2L: inset + x(f2.left),
        l2R: inset + x(e2.right),
        u,
      };

      /* Reveal the (now correctly-metricised) title and commit — but only if
         the numbers actually moved, so ResizeObserver jitter can't restart
         the reveal on every sub-pixel change. */
      gsap.set(title, { clearProps: 'opacity' });
      const near = (a: number, b: number) => Math.abs(a - b) < 0.75;
      setGeom((prev) =>
        prev &&
        near(prev.W, next.W) &&
        near(prev.H, next.H) &&
        near(prev.yA, next.yA) &&
        near(prev.yB, next.yB) &&
        near(prev.l1L, next.l1L) &&
        near(prev.l1R, next.l1R) &&
        near(prev.l2L, next.l2L) &&
        near(prev.l2R, next.l2R) &&
        near(prev.u, next.u)
          ? prev
          : next,
      );
    };

    /* two frames so freshly-applied font metrics are flushed before we read */
    const scheduleMeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) measure();
        }),
      );
    };

    let ro: ResizeObserver | null = null;
    const onResize = () => scheduleMeasure();

    /* Keep the title hidden until the brand font is in, then measure and
       start watching for any later layout change. */
    gsap.set(title, { opacity: 0 });
    Promise.all([
      document.fonts.load('900 1rem Unbounded').catch(() => undefined),
      document.fonts.ready,
    ])
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        scheduleMeasure();
        ro = new ResizeObserver(scheduleMeasure);
        ro.observe(title);
        window.addEventListener('resize', onResize);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onResize);
      gsap.set(title, { clearProps: 'opacity' });
    };
  }, []);

  /* Run the reveal once geometry is known (still pre-paint). */
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const glow = glowRef.current;
    const flash = flashRef.current;
    const title = titleRef.current;
    if (!geom || !svg || !glow || !flash || !title) return;

    const outersL = Array.from(svg.querySelectorAll<SVGPathElement>('.qb-wire-l'));
    const outersR = Array.from(svg.querySelectorAll<SVGPathElement>('.qb-wire-r'));
    const inners = Array.from(svg.querySelectorAll<SVGPathElement>('.qb-inner'));
    const mpaths = Array.from(svg.querySelectorAll<SVGPathElement>('.qb-mpath'));
    const details = Array.from(svg.querySelectorAll<SVGPathElement>('.qb-detail'));
    const gates = Array.from(svg.querySelectorAll<SVGGElement>('.qb-gate'));
    const vias = Array.from(svg.querySelectorAll<SVGCircleElement>('.qb-via'));
    const nodes = Array.from(svg.querySelectorAll<SVGCircleElement>('.qb-node'));
    const pulses = Array.from(svg.querySelectorAll<SVGGElement>('.qb-pulse'));
    const sideL = svg.querySelector<SVGGElement>('.qb-side-l');
    const sideR = svg.querySelector<SVGGElement>('.qb-side-r');
    const line1Chars = title.querySelectorAll('.qb-l1 .quantum-brand-char');
    const line2Chars = title.querySelectorAll('.qb-l2 .quantum-brand-char');
    const allChars = [...Array.from(line1Chars), ...Array.from(line2Chars)];
    const outers = [...outersL, ...outersR];
    const everything = [
      ...allChars,
      ...outers,
      ...inners,
      ...details,
      ...gates,
      ...vias,
      ...nodes,
      ...pulses,
      sideL,
      sideR,
      glow,
      flash,
      title,
    ].filter(Boolean) as (Element | HTMLElement)[];

    gsap.set([sideL, sideR], { x: 0, opacity: 1 });
    gsap.set([...outers, ...details], { drawSVG: '0%', opacity: 0.9 });
    gsap.set(inners, { drawSVG: '0%', opacity: 0.3 });
    gsap.set([...gates, ...nodes, ...vias], { scale: 0, opacity: 0, transformOrigin: '50% 50%' });
    gsap.set(pulses, { opacity: 0 });
    gsap.set(allChars, { opacity: 0, scale: 1.9, y: 26, filter: 'blur(18px)' });
    gsap.set(glow, { opacity: 0, scale: 0.85 });
    gsap.set(flash, { opacity: 0, scale: 0.5 });

    const tl = gsap.timeline({
      onComplete: () => glow.classList.add('quantum-brand-glow-alive'),
    });

    /* 1 — side circuits assemble */
    tl.to(glow, { opacity: 0.45, scale: 1, duration: 1.4, ease: 'power2.out' }, 0);
    tl.to(outers, { drawSVG: '100%', duration: 0.5, ease: 'power2.inOut', stagger: 0.07 }, 0.05);
    tl.to(details, { drawSVG: '100%', duration: 0.4, ease: 'power2.out', stagger: 0.04 }, 0.35);
    tl.to(gates, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)', stagger: 0.09 }, 0.55);
    tl.to(vias, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2.5)', stagger: 0.05 }, 0.7);
    tl.to(nodes, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2.5)', stagger: 0.05 }, 0.8);

    /* 2 — pulses cross the full width; faint rails extend in their wake */
    const pulseStarts = [0.95, 1.15];
    mpaths.forEach((mpath, i) => {
      const pulse = pulses[i];
      const len = mpath.getTotalLength();
      const start = mpath.getPointAtLength(0);
      gsap.set(pulse, { x: start.x, y: start.y });
      const prog = { t: 0 };
      const at = pulseStarts[i];

      tl.to(pulse, { opacity: 1, duration: 0.1 }, at);
      tl.to(
        prog,
        {
          t: 1,
          duration: 1.4,
          ease: 'power1.inOut',
          onUpdate: () => {
            const p = mpath.getPointAtLength(prog.t * len);
            gsap.set(pulse, { x: p.x, y: p.y });
          },
        },
        at,
      );
      tl.to(pulse, { opacity: 0, duration: 0.2 }, at + 1.35);
      tl.to(inners[i], { drawSVG: '100%', duration: 0.95, ease: 'power1.inOut' }, at + 0.25);
    });

    /* junction nodes flare as the current passes them */
    tl.to(nodes, { scale: 1.9, duration: 0.15, ease: 'power2.out', stagger: 0.08 }, 1.2);
    tl.to(nodes, { scale: 1, duration: 0.3, ease: 'power2.in', stagger: 0.08 }, 1.36);

    /* 3 — letters ignite in the pulse's wake */
    tl.to(
      line1Chars,
      {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.8,
        ease: 'back.out(1.6)',
        stagger: { each: 0.06, from: 'start' },
      },
      1.3,
    );
    tl.to(
      line2Chars,
      {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.8,
        ease: 'back.out(1.6)',
        stagger: { each: 0.07, from: 'end' },
      },
      1.5,
    );
    tl.fromTo(
      title,
      { filter: 'brightness(2)' },
      { filter: 'brightness(1)', duration: 1, ease: 'power2.out', clearProps: 'filter' },
      1.7,
    );

    /* 4 — the two pulses cross in the middle: flash */
    tl.to(flash, { opacity: 0.9, scale: 1.4, duration: 0.22, ease: 'power2.out' }, 1.78);
    tl.to(flash, { opacity: 0, scale: 2, duration: 0.55, ease: 'power2.in' }, 2.0);

    /* 5 — scaffolding disconnects */
    tl.to(inners, { drawSVG: '50% 50%', opacity: 0, duration: 0.6, ease: 'power2.in' }, 3.15);
    tl.to(outersL, { drawSVG: '0%', opacity: 0, duration: 0.5, ease: 'power2.in', stagger: 0.05 }, 3.2);
    tl.to(outersR, { drawSVG: '100% 100%', opacity: 0, duration: 0.5, ease: 'power2.in', stagger: 0.05 }, 3.2);
    tl.to(details, { opacity: 0, duration: 0.4, ease: 'power2.in', stagger: 0.02 }, 3.25);
    tl.to([...gates, ...vias, ...nodes], { scale: 0, opacity: 0, duration: 0.35, ease: 'power2.in', stagger: 0.02 }, 3.25);
    tl.to(sideL, { x: -20, opacity: 0, duration: 0.55, ease: 'power2.in' }, 3.25);
    tl.to(sideR, { x: 20, opacity: 0, duration: 0.55, ease: 'power2.in' }, 3.25);
    tl.to(glow, { opacity: 0.32, duration: 0.6, ease: 'power1.inOut' }, 3.45);

    return () => {
      tl.kill();
      glow.classList.remove('quantum-brand-glow-alive');
      gsap.killTweensOf(everything);
      gsap.set(everything, { clearProps: ANIMATED_PROPS });
    };
  }, [geom]);

  let scene: React.ReactNode = null;
  if (geom) {
    const { W, H, yA, yB, l1L, l1R, l2L, l2R, u } = geom;
    /* node positions: hugging each word's real edges */
    const nAL = l1L - 8;
    const nAR = l1R + 8;
    const nBL = l2L - 8;
    const nBR = l2R + 8;

    /* Gate size — noticeably larger boxes; every inner mark is expressed as
       a fraction of `box` so the glyphs scale together with it. */
    const box = 0.98 * u;
    const hVx = 0.34 * box; /* H uprights offset   */
    const hVy = 0.5 * box; /* H uprights half-height */
    const xD = 0.53 * box; /* X diagonal reach    */
    const mR = 0.62 * box; /* measurement arc radius */
    const mBase = 0.46 * box; /* arc baseline below center */
    const mTipX = 0.52 * box; /* needle tip dx */
    const mTipY = 0.44 * box; /* needle tip dy (up) */

    /* Asymmetric layout: the top word is wide (rails run tight to the edges),
       the bottom word is short (roomy) — so detail is spread differently on
       every side instead of mirroring. */
    /* left-top cluster */
    const cnotX = nAL - 2.1 * u;
    const hX = nAL - 4.3 * u;
    const stubAX = nAL - 6 * u;
    /* left-bottom cluster */
    const stubBLX = cnotX - 2.6 * u;
    /* right-top cluster (tight) */
    const xX = nAR + 3.5 * u;
    const stubRAX = nAR + 5.3 * u;
    /* right-bottom cluster (roomy — carries the extra detail) */
    const mX = nBR + 4.9 * u;
    const ctrlRX = nBR + 2.3 * u;
    const stubRBX = nBR + 7.3 * u;

    scene = (
      <div
        className="quantum-brand-fx-fade absolute inset-y-0 pointer-events-none"
        style={{ left: -geom.inset, right: -geom.inset }}
        aria-hidden
      >
        <svg ref={svgRef} className="block w-full h-full" viewBox={`0 0 ${W} ${H}`}>
          {/* faint rails running under the two words */}
          <StrokePath className="qb-inner" d={`M ${nAL} ${yA} H ${nAR}`} color={CYAN} />
          <StrokePath className="qb-inner" d={`M ${nBR} ${yB} H ${nBL}`} color={VIOLET} />

          {/* invisible motion paths: full edge-to-edge journeys */}
          <path className="qb-mpath" d={`M 0 ${yA} H ${W}`} fill="none" stroke="none" />
          <path className="qb-mpath" d={`M ${W} ${yB} H 0`} fill="none" stroke="none" />

          <g className="qb-side-l">
            {/* top rail broken around the H box so no line crosses the glyph */}
            <StrokePath className="qb-wire-l" d={`M 0 ${yA} H ${hX - box}`} color={CYAN} width={1.5} />
            <StrokePath className="qb-wire-l" d={`M ${hX + box} ${yA} H ${nAL}`} color={CYAN} width={1.5} />
            <StrokePath className="qb-wire-l" d={`M 0 ${yB} H ${nBL}`} color={VIOLET} width={1.5} />

            {/* CNOT: control on the top rail, target ⊕ down on the bottom rail */}
            <StrokePath className="qb-detail" d={`M ${cnotX} ${yA} V ${yB - 0.55 * u}`} color={CYAN} />
            <circle className="qb-detail" cx={cnotX} cy={yB} r={0.7 * u} fill="none" stroke={CYAN} strokeWidth="1.2" />
            <StrokePath className="qb-detail" d={`M ${cnotX - 0.55 * u} ${yB} H ${cnotX + 0.55 * u}`} color={CYAN} />
            <StrokePath className="qb-detail" d={`M ${cnotX} ${yB - 0.55 * u} V ${yB + 0.55 * u}`} color={CYAN} />
            {/* branch stubs — different lengths per side */}
            <StrokePath className="qb-detail" d={`M ${stubAX} ${yA} V ${yA - 1.7 * u}`} color={CYAN} />
            <StrokePath className="qb-detail" d={`M ${stubBLX} ${yB} V ${yB + 1.3 * u}`} color={VIOLET} />

            {/* H gate */}
            <g className="qb-gate">
              <rect x={hX - box} y={yA - box} width={box * 2} height={box * 2} rx={box * 0.24} fill="none" stroke={CYAN} strokeWidth="1.5" />
              <StrokePath d={`M ${hX - hVx} ${yA - hVy} V ${yA + hVy}`} color={CYAN} width={1.7} />
              <StrokePath d={`M ${hX + hVx} ${yA - hVy} V ${yA + hVy}`} color={CYAN} width={1.7} />
              <StrokePath d={`M ${hX - hVx} ${yA} H ${hX + hVx}`} color={CYAN} width={1.7} />
            </g>
            <circle className="qb-gate" cx={cnotX} cy={yA} r={0.22 * u + 1} fill={CYAN} />

            <circle className="qb-via" cx={stubAX} cy={yA - 1.7 * u - 0.2 * u} r={0.15 * u + 1} fill="none" stroke={CYAN} strokeWidth="1.2" />
            <circle className="qb-via" cx={stubBLX} cy={yB + 1.3 * u + 0.2 * u} r={0.15 * u + 1} fill="none" stroke={VIOLET} strokeWidth="1.2" />
            <circle className="qb-node" cx={nAL} cy={yA} r="2.8" fill={CYAN} />
            <circle className="qb-node" cx={nBL} cy={yB} r="2.8" fill={VIOLET} />
          </g>

          <g className="qb-side-r">
            {/* top & bottom rails broken around the X and measurement boxes */}
            <StrokePath className="qb-wire-r" d={`M ${nAR} ${yA} H ${xX - box}`} color={CYAN} width={1.5} />
            <StrokePath className="qb-wire-r" d={`M ${xX + box} ${yA} H ${W}`} color={CYAN} width={1.5} />
            <StrokePath className="qb-wire-r" d={`M ${nBR} ${yB} H ${mX - box}`} color={VIOLET} width={1.5} />
            <StrokePath className="qb-wire-r" d={`M ${mX + box} ${yB} H ${W}`} color={VIOLET} width={1.5} />

            {/* top rail: single up-stub next to the X gate */}
            <StrokePath className="qb-detail" d={`M ${stubRAX} ${yA} V ${yA - 1.9 * u}`} color={CYAN} />
            {/* bottom rail carries the extra detail: control tick + long stub */}
            <StrokePath className="qb-detail" d={`M ${ctrlRX} ${yB} V ${yB - 1.15 * u}`} color={VIOLET} />
            <StrokePath className="qb-detail" d={`M ${stubRBX} ${yB} V ${yB + 1.55 * u}`} color={VIOLET} />

            {/* X gate on the top rail */}
            <g className="qb-gate">
              <rect x={xX - box} y={yA - box} width={box * 2} height={box * 2} rx={box * 0.24} fill="none" stroke={VIOLET} strokeWidth="1.5" />
              <StrokePath d={`M ${xX - xD} ${yA - xD} L ${xX + xD} ${yA + xD}`} color={VIOLET} width={1.7} />
              <StrokePath d={`M ${xX + xD} ${yA - xD} L ${xX - xD} ${yA + xD}`} color={VIOLET} width={1.7} />
            </g>
            {/* measurement gate on the bottom rail */}
            <g className="qb-gate">
              <rect x={mX - box} y={yB - box} width={box * 2} height={box * 2} rx={box * 0.24} fill="none" stroke={CYAN} strokeWidth="1.5" />
              <StrokePath d={`M ${mX - mR} ${yB + mBase} A ${mR} ${mR} 0 0 1 ${mX + mR} ${yB + mBase}`} color={CYAN} width={1.4} />
              <StrokePath d={`M ${mX} ${yB + mBase} L ${mX + mTipX} ${yB - mTipY}`} color={CYAN} width={1.4} />
            </g>

            <circle className="qb-gate" cx={ctrlRX} cy={yB} r={0.2 * u + 1} fill={VIOLET} />
            <circle className="qb-via" cx={ctrlRX} cy={yB - 1.15 * u - 0.2 * u} r={0.15 * u + 1} fill="none" stroke={VIOLET} strokeWidth="1.2" />
            <circle className="qb-via" cx={stubRAX} cy={yA - 1.9 * u - 0.2 * u} r={0.15 * u + 1} fill="none" stroke={CYAN} strokeWidth="1.2" />
            <circle className="qb-via" cx={stubRBX} cy={yB + 1.55 * u + 0.2 * u} r={0.15 * u + 1} fill="none" stroke={VIOLET} strokeWidth="1.2" />
            <circle className="qb-node" cx={nAR} cy={yA} r="2.8" fill={CYAN} />
            <circle className="qb-node" cx={nBR} cy={yB} r="2.8" fill={VIOLET} />
          </g>

          {/* pulses on top of everything */}
          <g className="qb-pulse">
            <circle r="7" fill={CYAN} opacity="0.35" />
            <circle r="3" fill="#e0f2fe" />
          </g>
          <g className="qb-pulse">
            <circle r="7" fill={VIOLET} opacity="0.35" />
            <circle r="3" fill="#e0f2fe" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="quantum-brand relative w-full max-w-[min(100%,36rem)] mx-auto">
      <div
        ref={glowRef}
        className="quantum-brand-glow absolute -inset-x-6 -inset-y-3 sm:-inset-x-8 sm:-inset-y-4 opacity-30 -z-10"
        aria-hidden
      />

      {scene}

      <div
        ref={flashRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full pointer-events-none blur-2xl opacity-0"
        style={{
          background:
            'radial-gradient(circle, rgb(224 242 254 / 0.95) 0%, rgb(103 232 249 / 0.55) 40%, rgb(167 139 250 / 0.3) 65%, transparent 80%)',
        }}
        aria-hidden
      />

      <h1 ref={titleRef} className="relative font-brand text-center" aria-label={`${BRAND_LINE_1} ${BRAND_LINE_2}`}>
        <span className="qb-l1 quantum-brand-charline quantum-brand-line-size" aria-hidden>
          <GradientChars text={BRAND_LINE_1} />
        </span>
        <span className="qb-l2 quantum-brand-charline quantum-brand-line-size quantum-brand-line-size-tight" aria-hidden>
          <GradientChars text={BRAND_LINE_2} />
        </span>
      </h1>
    </div>
  );
}
