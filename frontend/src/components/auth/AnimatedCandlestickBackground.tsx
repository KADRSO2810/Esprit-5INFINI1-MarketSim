import React, { useEffect, useRef } from 'react';

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  hue: 'cyan' | 'emerald' | 'violet';
}

interface AnimatedCandlestickBackgroundProps {
  variant?: 'ambient' | 'centerpiece';
  className?: string;
}

function generateInitialCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 148.5;
  let trendBias = 0.12;

  for (let i = 0; i < count; i++) {
    if (i % 7 === 0) {
      trendBias = (Math.random() - 0.45) * 0.55;
    }
    const delta = trendBias + (Math.random() - 0.48) * 2.1;
    const open = price;
    const close = Math.max(122, Math.min(182, open + delta));
    const wickUp = Math.random() * 1.45 + 0.25;
    const wickDown = Math.random() * 1.45 + 0.25;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    const volume = 25 + Math.abs(close - open) * 24 + Math.random() * 30;
    candles.push({ open, high, low, close, volume });
    price = close;
  }

  return candles;
}

export const AnimatedCandlestickBackground: React.FC<AnimatedCandlestickBackgroundProps> = ({
  variant = 'ambient',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = canvas.clientWidth || 1200;
    let height = canvas.clientHeight || 700;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      if (!canvas) return;
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const candleCount = variant === 'centerpiece' ? 46 : 54;
    const candles = generateInitialCandles(candleCount);

    let formingTarget = candles[candles.length - 1].close + (Math.random() - 0.46) * 2.2;
    let panProgress = 0;
    let tickAccum = 0;
    let lastTime = performance.now();
    let animFrame = 0;

    const particles: Particle[] = Array.from(
      { length: variant === 'centerpiece' ? 28 : 22 },
      () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -0.12 - Math.random() * 0.24,
        radius: 1 + Math.random() * 1.4,
        alpha: 0.16 + Math.random() * 0.34,
        hue: Math.random() > 0.65 ? 'violet' : Math.random() > 0.35 ? 'cyan' : 'emerald',
      })
    );

    const drawFrame = (dtSec: number) => {
      // Advance simulation slightly
      if (!prefersReducedMotion) {
        tickAccum += dtSec;
        const speedMult = variant === 'centerpiece' ? 1.45 : 0.72;
        panProgress += dtSec * speedMult * 0.55;

        const active = candles[candles.length - 1];
        const drift = Math.sin(tickAccum * 3.1) * 0.12 + (formingTarget - active.close) * 0.06;
        active.close = Math.max(120, Math.min(186, active.close + drift * dtSec * 12));
        active.high = Math.max(active.high, active.open, active.close);
        active.low = Math.min(active.low, active.open, active.close);
        active.volume = Math.min(120, active.volume + Math.abs(drift) * 14);

        if (panProgress >= 1) {
          panProgress -= 1;
          candles.shift();
          const prev = candles[candles.length - 1];
          const nextOpen = prev.close;
          const step = (Math.random() - 0.47) * 2.4;
          const nextClose = Math.max(122, Math.min(184, nextOpen + step));
          candles.push({
            open: nextOpen,
            high: Math.max(nextOpen, nextClose) + Math.random() * 0.8 + 0.15,
            low: Math.min(nextOpen, nextClose) - Math.random() * 0.8 - 0.15,
            close: nextClose,
            volume: 24 + Math.random() * 35,
          });
          formingTarget = Math.max(122, Math.min(184, nextClose + (Math.random() - 0.45) * 3.2));
        }
      }

      ctx.clearRect(0, 0, width, height);

      const padTop = variant === 'centerpiece' ? height * 0.12 : height * 0.16;
      const padBottom = variant === 'centerpiece' ? height * 0.2 : height * 0.14;
      const plotH = Math.max(120, height - padTop - padBottom);
      const volBaseY = height - (variant === 'centerpiece' ? 14 : 18);
      const maxVolH = variant === 'centerpiece' ? height * 0.16 : height * 0.13;

      let minP = Infinity;
      let maxP = -Infinity;
      let maxVol = 1;
      for (const c of candles) {
        if (c.low < minP) minP = c.low;
        if (c.high > maxP) maxP = c.high;
        if (c.volume > maxVol) maxVol = c.volume;
      }
      const pPad = (maxP - minP) * 0.14 || 2;
      minP -= pPad;
      maxP += pPad;
      const pRange = maxP - minP || 1;
      const toY = (p: number) => padTop + plotH - ((p - minP) / pRange) * plotH;

      // Subtle horizontal gridlines
      ctx.save();
      ctx.strokeStyle =
        variant === 'centerpiece' ? 'rgba(148, 163, 184, 0.09)' : 'rgba(148, 163, 184, 0.05)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      const gridRows = variant === 'centerpiece' ? 5 : 4;
      for (let g = 0; g <= gridRows; g++) {
        const y = Math.round(padTop + (plotH * g) / gridRows) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      const slotW = width / (candles.length - 1.5);
      const candleW = Math.max(3, Math.min(13, slotW * 0.54));
      const xOffset = prefersReducedMotion ? 0 : -panProgress * slotW;
      const opacityMult = variant === 'centerpiece' ? 0.92 : 0.34;

      // Volume Histogram
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const x = (i + 0.4) * slotW + xOffset;
        if (x < -slotW || x > width + slotW) continue;
        const isUp = c.close >= c.open;
        const vh = Math.max(4, (c.volume / maxVol) * maxVolH);
        ctx.fillStyle = isUp
          ? `rgba(34, 197, 94, ${variant === 'centerpiece' ? 0.22 : 0.11})`
          : `rgba(239, 68, 68, ${variant === 'centerpiece' ? 0.22 : 0.11})`;
        ctx.fillRect(x - candleW * 0.45, volBaseY - vh, candleW * 0.9, vh);
      }

      // Compute fast EMA curve
      const emaPoints: Array<{ x: number; y: number }> = [];
      const slowEmaPoints: Array<{ x: number; y: number }> = [];
      let fastEma = candles[0].close;
      let slowEma = candles[0].close;

      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        fastEma = fastEma * 0.78 + c.close * 0.22;
        slowEma = slowEma * 0.9 + c.close * 0.1;
        const x = (i + 0.4) * slotW + xOffset;
        emaPoints.push({ x, y: toY(fastEma) });
        slowEmaPoints.push({ x, y: toY(slowEma) });
      }

      // Slow EMA glow line (Violet)
      if (slowEmaPoints.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(slowEmaPoints[0].x, slowEmaPoints[0].y);
        for (let i = 1; i < slowEmaPoints.length; i++) {
          ctx.lineTo(slowEmaPoints[i].x, slowEmaPoints[i].y);
        }
        ctx.strokeStyle =
          variant === 'centerpiece'
            ? 'rgba(167, 139, 250, 0.55)'
            : 'rgba(139, 92, 246, 0.24)';
        ctx.lineWidth = variant === 'centerpiece' ? 1.8 : 1.3;
        ctx.shadowColor = 'rgba(139, 92, 246, 0.45)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      }

      // Fast EMA glow line (Cyan) + soft area
      if (emaPoints.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(emaPoints[0].x, emaPoints[0].y);
        for (let i = 1; i < emaPoints.length; i++) {
          ctx.lineTo(emaPoints[i].x, emaPoints[i].y);
        }
        ctx.strokeStyle =
          variant === 'centerpiece'
            ? 'rgba(56, 189, 248, 0.85)'
            : 'rgba(56, 189, 248, 0.32)';
        ctx.lineWidth = variant === 'centerpiece' ? 2.1 : 1.5;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }

      // Candlesticks
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const x = (i + 0.4) * slotW + xOffset;
        if (x < -slotW || x > width + slotW) continue;

        const isUp = c.close >= c.open;
        const yHigh = toY(c.high);
        const yLow = toY(c.low);
        const yOpen = toY(c.open);
        const yClose = toY(c.close);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(2, Math.abs(yClose - yOpen));

        // Subtle fade at far left/right edges
        const edgeFade = Math.min(
          1,
          Math.max(0.15, Math.min(x / 90, (width - x) / 90))
        );
        const a = opacityMult * edgeFade;

        const strokeCol = isUp
          ? `rgba(34, 197, 94, ${a})`
          : `rgba(244, 63, 94, ${a})`;
        const fillCol = isUp
          ? `rgba(16, 185, 129, ${a * 0.92})`
          : `rgba(239, 68, 68, ${a * 0.92})`;

        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = variant === 'centerpiece' ? 1.4 : 1.1;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        ctx.fillStyle = fillCol;
        ctx.beginPath();
        ctx.roundRect?.(x - candleW / 2, bodyTop, candleW, bodyH, 1.5);
        if (!ctx.roundRect) {
          ctx.rect(x - candleW / 2, bodyTop, candleW, bodyH);
        }
        ctx.fill();
      }

      // Live active price guide line on centerpiece
      const lastCandle = candles[candles.length - 1];
      const lastX = (candles.length - 0.6) * slotW + xOffset;
      const lastY = toY(lastCandle.close);
      const lastUp = lastCandle.close >= lastCandle.open;

      if (variant === 'centerpiece') {
        ctx.save();
        ctx.strokeStyle = lastUp ? 'rgba(34, 197, 94, 0.55)' : 'rgba(244, 63, 94, 0.55)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, lastY);
        ctx.lineTo(width, lastY);
        ctx.stroke();
        ctx.restore();

        // Glowing terminal point
        ctx.save();
        ctx.fillStyle = lastUp ? 'rgba(34, 197, 94, 0.22)' : 'rgba(244, 63, 94, 0.22)';
        ctx.beginPath();
        ctx.arc(Math.min(width - 14, lastX), lastY, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = lastUp ? '#22C55E' : '#F43F5E';
        ctx.beginPath();
        ctx.arc(Math.min(width - 14, lastX), lastY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Floating luminous market particles
      for (const p of particles) {
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
        }
        ctx.fillStyle =
          p.hue === 'cyan'
            ? `rgba(56, 189, 248, ${p.alpha})`
            : p.hue === 'emerald'
            ? `rgba(52, 211, 153, ${p.alpha})`
            : `rgba(167, 139, 250, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      if (document.visibilityState === 'hidden') {
        animFrame = 0;
        return;
      }
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      drawFrame(dtSec);
      if (!prefersReducedMotion) {
        animFrame = requestAnimationFrame(loop);
      }
    };

    const handleVisibility = () => {
      if (prefersReducedMotion) return;
      if (document.visibilityState === 'visible' && !animFrame) {
        lastTime = performance.now();
        animFrame = requestAnimationFrame(loop);
      } else if (document.visibilityState === 'hidden' && animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = 0;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    if (prefersReducedMotion) {
      drawFrame(0);
    } else if (document.visibilityState !== 'hidden') {
      animFrame = requestAnimationFrame(loop);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      ro.disconnect();
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`w-full h-full block pointer-events-none select-none ${className}`}
    />
  );
};
