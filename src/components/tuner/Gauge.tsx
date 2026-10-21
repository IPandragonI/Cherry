"use client";

import { useEffect, useRef } from "react";
import { FlatIcon, SharpIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/useT";
import { IN_TUNE_CENTS } from "@/lib/audio/useTuner";
import { clampCents } from "@/lib/music/notes";

const WIDTH = 342;
const PAD = 11;
const BUBBLE = 52;
const SPAN = WIDTH - 2 * PAD;
/** Bubble easing time constant (ms): on top of the tracker's own smoothing. */
const EASE_MS = 140;

const xFor = (cents: number, width = WIDTH) => {
  const pad = (PAD / WIDTH) * width;
  return pad + ((clampCents(cents) + 50) / 100) * (width - 2 * pad);
};

const TICKS = Array.from({ length: 21 }, (_, i) => -50 + i * 5);

function formatCents(cents: number | null): string {
  if (cents === null) return "–";
  const rounded = Math.round(clampCents(cents));
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}

interface GaugeProps {
  cents: number | null;
  inTune: boolean;
}

/**
 * Ruler-style gauge: a bubble glides along a −50…+50 cent ruler over a dot-matrix field
 * that scrolls downwards while a pitch is heard. The bubble position is animated outside
 * React (rAF + exponential easing on `transform`) so it stays fluid at 60 fps.
 */
export function Gauge({ cents, inTune }: GaugeProps) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(0);

  useEffect(() => {
    targetRef.current = cents === null ? 0 : clampCents(cents);
  }, [cents]);

  useEffect(() => {
    const track = trackRef.current;
    const bubble = bubbleRef.current;
    if (!track || !bubble) return;
    let width = track.clientWidth || WIDTH;
    const observer = new ResizeObserver(([entry]) => (width = entry.contentRect.width));
    observer.observe(track);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let position = targetRef.current;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const dt = Math.min(64, now - last);
      last = now;
      const target = targetRef.current;
      position = reduced.matches
        ? target
        : position + (target - position) * (1 - Math.exp(-dt / EASE_MS));
      bubble.style.transform = `translate3d(${xFor(position, width) - BUBBLE / 2}px,0,0)`;
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const active = cents !== null;
  const value = formatCents(cents);
  const from = inTune ? "var(--bubble-ok-from)" : "var(--bubble-accent-from)";
  const deep = inTune ? "var(--bubble-ok-to)" : "var(--bubble-accent-to)";

  return (
    <div
      className="relative mx-auto w-full max-w-[342px] select-none"
      role="meter"
      aria-valuemin={-50}
      aria-valuemax={50}
      aria-valuenow={active ? Math.round(clampCents(cents)) : 0}
      aria-valuetext={active ? t("tuner.gauge.label", { cents: value }) : t("tuner.noSignal")}
    >
      <div ref={trackRef} className="relative h-[96px]">
        <div className="dot-field" data-active={active} data-in-tune={inTune} aria-hidden="true">
          <div className="dot-field-dots" />
        </div>
        <div
          className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full transition-colors duration-300"
          style={{
            background: `linear-gradient(to bottom, transparent, ${
              inTune ? "var(--tuner-ok)" : "var(--tuner-ink)"
            } 70%)`,
          }}
          aria-hidden="true"
        />
        <div
          ref={bubbleRef}
          className="absolute bottom-0 left-0 will-change-transform"
          style={{ width: BUBBLE, transform: `translate3d(${xFor(0) - BUBBLE / 2}px,0,0)` }}
          aria-hidden="true"
        >
          <div
            className="flex size-[52px] items-center justify-center rounded-full text-lg font-bold tabular-nums shadow-md transition-opacity duration-300"
            style={{
              opacity: active ? 1 : 0.45,
              color: active ? "var(--bubble-fg)" : "#ffffff",
              background: active
                ? `radial-gradient(circle at 35% 30%, ${from}, ${deep})`
                : "radial-gradient(circle at 35% 30%, #a19b96, #6f6a66)",
            }}
          >
            {value}
          </div>
          <div
            className="mx-auto -mt-[7px] size-3 rotate-45 rounded-[2px]"
            style={{ background: active ? deep : "#6f6a66", opacity: active ? 1 : 0.45 }}
          />
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} 32`} className="block w-full" aria-hidden="true">
        <rect
          x={xFor(-IN_TUNE_CENTS - 2)}
          width={xFor(IN_TUNE_CENTS + 2) - xFor(-IN_TUNE_CENTS - 2)}
          y={0}
          height={30}
          rx={4}
          fill="var(--tuner-band)"
        />
        <line x1={PAD} x2={PAD + SPAN} y1={1} y2={1} stroke="var(--tuner-ink)" strokeWidth={1} />
        {TICKS.map((c) => {
          const center = c === 0;
          const major = c % 10 === 0;
          return (
            <line
              key={c}
              x1={xFor(c)}
              x2={xFor(c)}
              y1={1}
              y2={center ? 30 : major ? 18 : 11}
              stroke={
                center ? "var(--tuner-ok)" : major ? "var(--tuner-ink-strong)" : "var(--tuner-ink)"
              }
              strokeWidth={center ? 3 : major ? 1.6 : 1}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <div className="mt-0.5 flex items-center justify-between">
        <span className="text-base-content/75" title={t("tuner.gauge.low")}>
          <FlatIcon width={20} height={20} aria-hidden="true" />
          <span className="sr-only">{t("tuner.gauge.low")}</span>
        </span>
        <span className="text-xs font-semibold text-success" aria-hidden="true">
          {t("tuner.gauge.center")}
        </span>
        <span className="text-base-content/75" title={t("tuner.gauge.high")}>
          <SharpIcon width={20} height={20} aria-hidden="true" />
          <span className="sr-only">{t("tuner.gauge.high")}</span>
        </span>
      </div>
    </div>
  );
}
