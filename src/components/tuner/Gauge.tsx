"use client";

import { useEffect, useRef } from "react";
import { FlatIcon, SharpIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/useT";
import { clampCents } from "@/lib/music/notes";

const BUBBLE = 56;
/** Inset of the ±50 cent positions from the field edges, leaving room for ♭ / ♯. */
const EDGE = 34;
/** Bubble easing time constant (ms), on top of the tracker's own smoothing. */
const EASE_MS = 140;

const xFor = (cents: number, width: number) =>
  EDGE + ((clampCents(cents) + 50) / 100) * (width - 2 * EDGE);

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
 * The bubble glides left (flat) / right (sharp) over a dot-matrix field that scrolls
 * downwards continuously, with a centre line marking "in tune". The position is animated
 * outside React (rAF + exponential easing on `transform`) so it stays fluid at 60 fps.
 */
export function Gauge({ cents, inTune }: GaugeProps) {
  const t = useT();
  const fieldRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(0);

  useEffect(() => {
    targetRef.current = cents === null ? 0 : clampCents(cents);
  }, [cents]);

  useEffect(() => {
    const field = fieldRef.current;
    const bubble = bubbleRef.current;
    if (!field || !bubble) return;
    let width = field.clientWidth || 342;
    const observer = new ResizeObserver(([entry]) => (width = entry.contentRect.width));
    observer.observe(field);
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
      bubble.style.transform = `translate3d(${xFor(position, width) - BUBBLE / 2}px,-50%,0)`;
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
      ref={fieldRef}
      className="relative mx-auto h-full w-full max-w-[342px] select-none"
      role="meter"
      aria-valuemin={-50}
      aria-valuemax={50}
      aria-valuenow={active ? Math.round(clampCents(cents)) : 0}
      aria-valuetext={active ? t("tuner.gauge.label", { cents: value }) : t("tuner.noSignal")}
    >
      <div className="dot-field" data-in-tune={inTune} aria-hidden="true">
        <div className="dot-field-dots" />
      </div>
      <div
        className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full transition-colors duration-300"
        style={{
          background: `linear-gradient(to bottom, transparent, ${
            inTune ? "var(--tuner-ok)" : "var(--tuner-ink)"
          } 35%, ${inTune ? "var(--tuner-ok)" : "var(--tuner-ink)"} 65%, transparent)`,
        }}
        aria-hidden="true"
      />

      <span
        className="absolute top-1/2 left-0 -translate-y-1/2 text-base-content/75"
        title={t("tuner.gauge.low")}
      >
        <FlatIcon width={22} height={22} aria-hidden="true" />
        <span className="sr-only">{t("tuner.gauge.low")}</span>
      </span>
      <span
        className="absolute top-1/2 right-0 -translate-y-1/2 text-base-content/75"
        title={t("tuner.gauge.high")}
      >
        <SharpIcon width={22} height={22} aria-hidden="true" />
        <span className="sr-only">{t("tuner.gauge.high")}</span>
      </span>

      <div
        ref={bubbleRef}
        className="absolute top-1/2 left-0 will-change-transform"
        style={{ width: BUBBLE, transform: `translate3d(${171 - BUBBLE / 2}px,-50%,0)` }}
        aria-hidden="true"
      >
        <div
          className="flex size-[56px] items-center justify-center rounded-full text-lg font-bold tabular-nums shadow-lg transition-opacity duration-300"
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
      </div>
    </div>
  );
}
