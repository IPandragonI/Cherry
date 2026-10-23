"use client";

import { useEffect, useRef } from "react";
import { FlatIcon, SharpIcon } from "@/components/ui/icons";
import { displayDeviation } from "@/lib/audio/useTuner";
import { useT } from "@/lib/i18n/useT";

interface StrobeProps {
  cents: number | null;
  inTune: boolean;
  precise: boolean;
}

/** Stripe period (px) of the fastest band; the other bands are 2× and 4× wider. */
const STRIPE = 12;
/** Drift speed (px per second) per cent of deviation, for the finest band. */
const PX_PER_CENT_S = 3;
const BANDS = 3;

/**
 * Strobe display, as on precision tuners: bands of stripes drift right when the note is
 * sharp and left when it is flat, faster the further off it is, and stand still in tune.
 * The finest band shows the smallest deviations (it moves first), the widest the big ones.
 * Drawn on a canvas outside React; the loop stops while nothing is heard.
 */
export function Strobe({ cents, inTune, precise }: StrobeProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const centsRef = useRef<number | null>(null);
  const inTuneRef = useRef(false);
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    centsRef.current = cents;
    inTuneRef.current = inTune;
    wakeRef.current();
  }, [cents, inTune]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let width = canvas.clientWidth || 342;
    let height = canvas.clientHeight || 104;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const offsets = Array.from({ length: BANDS }, () => 0);
    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      const c = centsRef.current;
      const ink = getComputedStyle(canvas)
        .getPropertyValue(inTuneRef.current ? "--color-success" : "--color-primary")
        .trim();
      ctx.clearRect(0, 0, width, height);
      const bandHeight = height / BANDS;
      for (let b = 0; b < BANDS; b++) {
        const period = STRIPE * 2 ** b;
        // Reduced motion: the stripes stay put; the colour and the number tell the state.
        if (c !== null && !reduced.matches) {
          offsets[b] = (offsets[b] + c * PX_PER_CENT_S * dt * 2 ** b) % period;
        }
        ctx.globalAlpha = c === null ? 0.18 : 0.85 - b * 0.2;
        ctx.fillStyle = ink || "#a8384c";
        const y = b * bandHeight + 3;
        for (let x = offsets[b] - period; x < width; x += period) {
          ctx.fillRect(x, y, period / 2, bandHeight - 6);
        }
      }
      ctx.globalAlpha = 1;
      frame = c === null || reduced.matches ? 0 : requestAnimationFrame(draw);
    };
    const wake = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      resize();
      wake();
    });
    observer.observe(canvas);
    resize();
    wakeRef.current = wake;
    wake();
    return () => {
      cancelAnimationFrame(frame);
      wakeRef.current = () => {};
      observer.disconnect();
    };
  }, []);

  const active = cents !== null;
  const value = active ? displayDeviation(cents, precise) : 0;
  const shown = value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";

  return (
    <div
      className="relative mx-auto flex h-full w-full max-w-[342px] items-center gap-2 select-none"
      role="meter"
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={
        active
          ? inTune
            ? t("tuner.inTune")
            : t(precise ? "tuner.gauge.label" : "tuner.gauge.labelRelaxed", { cents: shown })
          : t("tuner.noSignal")
      }
    >
      <span className="shrink-0 text-base-content/75" title={t("tuner.gauge.low")}>
        <FlatIcon width={22} height={22} aria-hidden="true" />
      </span>
      <div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-2xl bg-base-200">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        <span
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-base-100/90 px-3 py-0.5 font-display text-xl font-semibold tabular-nums ${
            inTune ? "text-success" : "text-primary"
          }`}
          aria-hidden="true"
        >
          {active ? shown : "–"}
        </span>
      </div>
      <span className="shrink-0 text-base-content/75" title={t("tuner.gauge.high")}>
        <SharpIcon width={22} height={22} aria-hidden="true" />
      </span>
    </div>
  );
}
