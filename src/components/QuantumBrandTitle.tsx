import { useEffect, useRef, useState } from 'react';

const PARTICLE_HUES = [235, 250, 265, 280, 295, 310];
const SAMPLE_POOL = 900;
const INTRO_COUNT = 650;
const AMBIENT_COUNT = 110;
const ALPHA_THRESHOLD = 48;

type NormalizedPoint = { nx: number; ny: number; edge: boolean };

type IntroParticle = {
  nx: number;
  ny: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  size: number;
  hue: number;
  delay: number;
  fadeStagger: number;
  settled: boolean;
  fade: number;
};

type AmbientParticle = {
  nx: number;
  ny: number;
  hue: number;
  phase: number;
  speed: number;
  size: number;
  drift: number;
};

type ImageBox = { left: number; top: number; width: number; height: number };

let cachedSampleKey = '';
let cachedSamplePoints: NormalizedPoint[] | null = null;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function samplePointsFromImage(img: HTMLImageElement, maxPoints: number): NormalizedPoint[] {
  const sampleW = Math.min(img.naturalWidth, 480);
  const sampleH = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * sampleW));
  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

  const isOpaque = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= sampleW || y >= sampleH) return false;
    const i = (y * sampleW + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < ALPHA_THRESHOLD) return false;
    if (r < 32 && g < 32 && b < 38) return false;
    return true;
  };

  const edge: NormalizedPoint[] = [];
  const fill: NormalizedPoint[] = [];
  const step = 2;

  for (let y = 0; y < sampleH; y += step) {
    for (let x = 0; x < sampleW; x += step) {
      if (!isOpaque(x, y)) continue;
      const onEdge =
        !isOpaque(x - 1, y) ||
        !isOpaque(x + 1, y) ||
        !isOpaque(x, y - 1) ||
        !isOpaque(x, y + 1);
      const point = { nx: (x + 0.5) / sampleW, ny: (y + 0.5) / sampleH, edge: onEdge };
      if (onEdge) edge.push(point);
      else fill.push(point);
    }
  }

  const edgePick = Math.min(edge.length, Math.floor(maxPoints * 0.72));
  const fillPick = Math.min(fill.length, maxPoints - edgePick);
  return [...shuffle(edge).slice(0, edgePick), ...shuffle(fill).slice(0, fillPick)];
}

function scheduleIdleWork(callback: () => void): number {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: 320 });
  }
  return window.setTimeout(callback, 48);
}

function cancelIdleWork(handle: number) {
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle);
  } else {
    window.clearTimeout(handle);
  }
}

function getSamplePoints(img: HTMLImageElement): NormalizedPoint[] {
  const key = `${img.src}:${img.naturalWidth}x${img.naturalHeight}`;
  if (cachedSampleKey === key && cachedSamplePoints) return cachedSamplePoints;
  cachedSamplePoints = samplePointsFromImage(img, SAMPLE_POOL);
  cachedSampleKey = key;
  return cachedSamplePoints;
}

function imageBox(img: HTMLImageElement, wrap: HTMLElement): ImageBox {
  const imgRect = img.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  return {
    left: imgRect.left - wrapRect.left,
    top: imgRect.top - wrapRect.top,
    width: imgRect.width,
    height: imgRect.height,
  };
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function toScreen(box: ImageBox, nx: number, ny: number, jitter = 0) {
  const j = jitter ? (Math.random() - 0.5) * jitter : 0;
  return {
    x: box.left + nx * box.width + j,
    y: box.top + ny * box.height + j,
  };
}

function createIntroParticles(points: NormalizedPoint[], box: ImageBox, w: number, h: number): IntroParticle[] {
  return points.slice(0, INTRO_COUNT).map((p) => {
    const target = toScreen(box, p.nx, p.ny, 3);
    return {
      nx: p.nx,
      ny: p.ny,
      x: Math.random() * w,
      y: Math.random() * h,
      tx: target.x,
      ty: target.y,
      size: 1.3 + Math.random() * 2,
      hue: PARTICLE_HUES[Math.floor(Math.random() * PARTICLE_HUES.length)],
      delay: Math.random() * 380,
      fadeStagger: Math.random() * 0.62,
      settled: false,
      fade: 1,
    };
  });
}

function createAmbientParticles(points: NormalizedPoint[]): AmbientParticle[] {
  const edgePoints = points.filter((p) => p.edge);
  const pool = edgePoints.length >= AMBIENT_COUNT ? edgePoints : points;
  const pick = shuffle(pool).slice(0, AMBIENT_COUNT);
  return pick.map((p) => ({
    nx: p.nx,
    ny: p.ny,
    hue: PARTICLE_HUES[Math.floor(Math.random() * PARTICLE_HUES.length)],
    phase: Math.random() * Math.PI * 2,
    speed: 0.62 + Math.random() * 1.65,
    size: 1.25 + Math.random() * 1.55,
    drift: 0.42 + Math.random() * 0.62,
  }));
}

function drawAmbientParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  hue: number,
  alpha: number,
) {
  if (alpha <= 0.03) return;

  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = `hsl(${hue}, 92%, 68%)`;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.52;
  ctx.fillStyle = `hsl(${hue}, 90%, 76%)`;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.68;
  ctx.fillStyle = `hsl(${hue}, 88%, 84%)`;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.78;
  ctx.fillStyle = 'rgba(240, 248, 255, 0.88)';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r * 0.34), 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  hue: number,
  alpha: number,
) {
  if (alpha <= 0.02) return;
  ctx.globalAlpha = alpha * 0.28;
  ctx.fillStyle = `hsl(${hue}, 92%, 72%)`;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.fillStyle = `hsl(${hue}, 88%, 82%)`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.95;
  ctx.fillStyle = 'rgba(240, 248, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.45, r * 0.32), 0, Math.PI * 2);
  ctx.fill();
}

export default function QuantumBrandTitle() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const introRef = useRef<IntroParticle[]>([]);
  const ambientRef = useRef<AmbientParticle[]>([]);
  const boxRef = useRef<ImageBox>({ left: 0, top: 0, width: 0, height: 0 });
  const phaseRef = useRef<'intro' | 'transition' | 'ambient'>('intro');
  const [imgReady, setImgReady] = useState(false);

  useEffect(() => {
    if (!imgReady) return;

    const wrap = wrapRef.current;
    const media = mediaRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!wrap || !media || !canvas || !img) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      img.style.opacity = '1';
      return;
    }

    img.style.opacity = '1';

    let cancelled = false;
    let cleanupAnim: (() => void) | undefined;

    const idleHandle = scheduleIdleWork(() => {
      if (cancelled) return;

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const normalized = getSamplePoints(img);
      if (!normalized.length) return;

      img.style.opacity = '0';

      let w = 0;
      let h = 0;
      let dpr = 1;
      let paused = document.hidden;

      const syncLayout = () => {
        const rect = media.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        w = rect.width;
        h = rect.height;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        boxRef.current = imageBox(img, media);
      };

      ambientRef.current = createAmbientParticles(normalized);

      const assembleMs = 2200;
      const dissolveMs = 1500;
      const crossfadeLeadMs = 700;
      const crossfadeMs = 1800;
      const introEndMs = assembleMs + dissolveMs;
      const crossfadeStartMs = introEndMs - crossfadeLeadMs;
      let startTime = 0;
      let rafRefLocal = 0;

      const drawAmbientLayer = (elapsed: number, blend: number) => {
        if (blend <= 0) return;

        const box = boxRef.current;
        const t = Math.max(0, elapsed - crossfadeStartMs) * 0.001;
        const motionBlend = easeInOutCubic(blend);
        const steadyPulse = 0.46;

        for (const p of ambientRef.current) {
          const waveA = 0.5 + 0.5 * Math.sin(t * p.speed + p.phase);
          const waveB = 0.5 + 0.5 * Math.sin(t * p.speed * 1.85 + p.phase * 2.17 + 1.4);
          const activePulse = 0.34 + 0.54 * waveA;
          const pulse = steadyPulse + (activePulse - steadyPulse) * motionBlend;
          const driftScale = motionBlend;
          const driftX = Math.cos(t * 0.72 + p.phase) * p.drift * driftScale;
          const driftY = Math.sin(t * 0.55 + p.phase * 1.1) * p.drift * 0.65 * driftScale;
          const x = box.left + p.nx * box.width + driftX;
          const y = box.top + p.ny * box.height + driftY;
          const activeR = p.size * (0.74 + 0.34 * waveA + 0.14 * waveB);
          const r = p.size * 0.88 + (activeR - p.size * 0.88) * motionBlend;

          drawAmbientParticle(ctx, x, y, r, p.hue, pulse * blend);
        }
      };

      const onVisibility = () => {
        paused = document.hidden;
        if (!paused) {
          rafRefLocal = requestAnimationFrame(tick);
        }
      };

      const tick = (now: number) => {
        if (paused || cancelled) return;

        if (!startTime) startTime = now;

        const elapsed = now - startTime;
        const ambientBlendRaw = Math.min(Math.max((elapsed - crossfadeStartMs) / crossfadeMs, 0), 1);
        const ambientBlend = easeInOutCubic(ambientBlendRaw);
        const inIntro = elapsed < introEndMs;

        if (ambientBlend >= 1) phaseRef.current = 'ambient';
        else if (ambientBlend > 0) phaseRef.current = 'transition';
        else phaseRef.current = 'intro';

        ctx.clearRect(0, 0, w, h);

        if (inIntro) {
          const dissolveRaw = Math.min(Math.max((elapsed - assembleMs) / dissolveMs, 0), 1);
          const dissolveEase = easeInOutCubic(dissolveRaw);
          for (const p of introRef.current) {
            const localT = Math.max(0, elapsed - p.delay);
            const moveT = Math.min(localT / assembleMs, 1);
            const ease = 1 - (1 - moveT) ** 3;
            const lerp = 0.06 + ease * 0.05;

            p.x += (p.tx - p.x) * lerp;
            p.y += (p.ty - p.y) * lerp;

            if (Math.hypot(p.tx - p.x, p.ty - p.y) < 2.5 && moveT > 0.5) p.settled = true;

            if (dissolveEase > 0) {
              const span = Math.max(0.18, 1 - p.fadeStagger);
              const localFade = Math.min(Math.max((dissolveEase - p.fadeStagger) / span, 0), 1);
              const fadeOut = easeOutCubic(1 - localFade);
              p.fade = p.settled ? fadeOut : fadeOut * 0.92;
            }

            const handoffFade = 1 - ambientBlend * 0.92;
            const alpha = p.fade * (0.5 + ease * 0.5) * handoffFade;
            drawParticle(ctx, p.x, p.y, p.size * (0.85 + ease * 0.3), p.hue, alpha);
          }

          const revealStartMs = assembleMs * 0.62;
          const revealEndMs = introEndMs - 280;
          const revealRaw = Math.min(
            Math.max((elapsed - revealStartMs) / (revealEndMs - revealStartMs), 0),
            1,
          );
          img.style.opacity = String(easeOutCubic(revealRaw));
        } else {
          img.style.opacity = '1';
        }

        drawAmbientLayer(elapsed, ambientBlend);
        ctx.globalAlpha = 1;

        rafRefLocal = requestAnimationFrame(tick);
      };

      const onResize = () => {
        syncLayout();
        const box = boxRef.current;
        if (phaseRef.current === 'intro' || phaseRef.current === 'transition') {
          for (const p of introRef.current) {
            const target = toScreen(box, p.nx, p.ny);
            p.tx = target.x;
            p.ty = target.y;
          }
        }
      };

      syncLayout();
      introRef.current = createIntroParticles(normalized, boxRef.current, w, h);
      phaseRef.current = 'intro';

      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('resize', onResize);

      rafRefLocal = requestAnimationFrame(tick);
      rafRef.current = rafRefLocal;

      const fallback = window.setTimeout(() => {
        img.style.opacity = '1';
        phaseRef.current = 'ambient';
      }, introEndMs + crossfadeMs + 400);

      cleanupAnim = () => {
        cancelAnimationFrame(rafRefLocal);
        window.clearTimeout(fallback);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('resize', onResize);
      };
    });

    return () => {
      cancelled = true;
      cancelIdleWork(idleHandle);
      cleanupAnim?.();
      cancelAnimationFrame(rafRef.current);
    };
  }, [imgReady]);

  return (
    <div
      ref={wrapRef}
      className="quantum-brand relative mx-auto my-0.5 md:my-2 min-h-[6rem] sm:min-h-[6.5rem] md:min-h-[7.5rem] max-w-3xl px-4"
    >
      <span className="sr-only">Квантовый кружок</span>

      <div
        className="quantum-brand-glow absolute inset-x-6 top-1/2 -translate-y-1/2 h-28 md:h-36 opacity-35 -z-10"
        aria-hidden
      />

      <div
        ref={mediaRef}
        className="relative isolate z-0 mx-auto w-full max-w-[min(100%,30rem)] md:max-w-[34rem]"
      >
        <img
          ref={imgRef}
          src="/quantum-brand-wordmark.png"
          alt=""
          aria-hidden
          onLoad={() => setImgReady(true)}
          decoding="async"
          fetchPriority="high"
          className="relative z-0 block w-full h-auto select-none opacity-100 will-change-[opacity]"
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-10 pointer-events-none"
          aria-hidden
        />
      </div>
    </div>
  );
}
