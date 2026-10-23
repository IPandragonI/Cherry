"use client";

import { useEffect, useRef } from "react";
import { FlatIcon, SharpIcon } from "@/components/ui/icons";
import { MAX_DISPLAY, displayDeviation, gaugePosition } from "@/lib/audio/useTuner";
import { useT } from "@/lib/i18n/useT";
import { clampCents } from "@/lib/music/notes";

/** Marker: a round head with a small pointed tip at the bottom. */
const MARKER_W = 48;
const MARKER_H = 56;
/** Inset of the ±50 cent positions from the field edges, leaving room for ♭ / ♯. */
const EDGE = 34;
/** Marker glide (ms): a critically damped spring, just long enough to smooth the steps
 *  between readings (one every ~21 ms); it trails a moving pitch by about this much. */
const GLIDE_MS = 25;
/** Must match the dot-field scroll in globals.css (one 14 px row every 1.1 s). */
const SCROLL_PX_PER_MS = 14 / 1100;
/** A trail point fades out over this long once it is emitted. */
const TRAIL_FADE_MS = 2600;

const xFor = (cents: number, width: number) =>
  EDGE + ((clampCents(cents) + 50) / 100) * (width - 2 * EDGE);

function formatDeviation(cents: number | null, precise: boolean): string {
  if (cents === null) return "–";
  const rounded = displayDeviation(cents, precise);
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}

interface GaugeProps {
  cents: number | null;
  inTune: boolean;
  /** Real scale, in cents; otherwise a compressed scale (see `gaugePosition`). */
  precise: boolean;
  /** Identifies the note being tuned: when it changes, the marker jumps straight there. */
  noteKey: string | null;
}

interface TrailPoint {
  x: number;
  y: number;
  born: number;
  /** First point after a jump: not joined to the previous one. */
  gap?: boolean;
}

/**
 * The marker glides left (flat) / right (sharp) over a dot-matrix field scrolling
 * downwards. While a note is heard it leaves a trail in the field that flows down with the
 * dots, like a pen on a moving chart; the trail fades once the sound stops. In tune, the
 * trail stops (the field keeps scrolling) and the centre line turns to the primary colour.
 * Everything moving is drawn outside React (rAF + canvas + `transform`).
 */
export function Gauge({ cents, inTune, precise, noteKey }: GaugeProps) {
  const t = useT();
  const fieldRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(0);
  const activeRef = useRef(false);
  const inTuneRef = useRef(false);
  /** Set when the marker must jump to its target instead of gliding (new note heard). */
  const snapRef = useRef(false);
  /** Restarts the animation loop, which stops once everything has come to rest. */
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    targetRef.current = cents === null ? 0 : gaugePosition(cents, precise);
    // A note appearing (nothing was heard before) shows where it is at once.
    if (cents !== null && !activeRef.current) snapRef.current = true;
    activeRef.current = cents !== null;
    inTuneRef.current = inTune;
    wakeRef.current();
  }, [cents, inTune, precise]);

  // Another string: no glide across the gauge from the previous note.
  useEffect(() => {
    snapRef.current = true;
  }, [noteKey]);

  useEffect(() => {
    const field = fieldRef.current;
    const marker = markerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!field || !marker || !canvas || !ctx) return;

    let width = field.clientWidth || 342;
    let height = field.clientHeight || 104;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      resize();
    });
    observer.observe(field);
    resize();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let color = "";
    let frames = 0;
    const trail: TrailPoint[] = [];
    let position = targetRef.current;
    let velocity = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const target = targetRef.current;
      const snapped = snapRef.current && activeRef.current;
      if (snapped) snapRef.current = false;
      if (reduced.matches || snapped) {
        position = target;
        velocity = 0;
      } else {
        // Critically damped spring ("SmoothDamp"): no jump when the target changes and no
        // overshoot, whether the note holds still or moves.
        const omega = 2 / GLIDE_MS;
        const x = omega * dt;
        const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        const change = position - target;
        const temp = (velocity + omega * change) * dt;
        velocity = (velocity - omega * temp) * decay;
        position = target + (change + temp) * decay;
      }
      const x = xFor(position, width);
      marker.style.transform = `translate3d(${x - MARKER_W / 2}px,-50%,0)`;

      // Theme changes are rare: refresh the trail colour now and then, not every frame.
      if (frames++ % 30 === 0) {
        color = getComputedStyle(field).getPropertyValue("--color-primary").trim() || "#a8384c";
      }

      if (!reduced.matches) {
        // The field never stops; the trail rides on it.
        const fall = dt * SCROLL_PX_PER_MS;
        for (const p of trail) p.y += fall;
        // Emitted just under the marker's head while a note is heard, but not once it is in
        // tune: the trail then stops and what is left flows away and fades.
        if (activeRef.current && !inTuneRef.current) {
          trail.push({ x, y: height / 2 + MARKER_W / 2 - 4, born: now, gap: snapped });
        }
      }
      while (trail.length && (trail[0].y > height + 4 || now - trail[0].born > TRAIL_FADE_MS)) {
        trail.shift();
      }

      ctx.clearRect(0, 0, width, height);
      if (!reduced.matches && trail.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1];
          const b = trail[i];
          const life = 1 - (now - b.born) / TRAIL_FADE_MS;
          if (life <= 0 || b.gap) continue;
          ctx.globalAlpha = 0.75 * life;
          ctx.lineWidth = 1.5 + 2.5 * life;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Nothing heard, marker at rest, trail gone: stop drawing (battery) until woken.
      const resting =
        !activeRef.current &&
        trail.length === 0 &&
        Math.abs(position - targetRef.current) < 0.01 &&
        Math.abs(velocity) < 1e-4;
      frame = resting ? 0 : requestAnimationFrame(tick);
    };
    const wake = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;
    wake();
    return () => {
      cancelAnimationFrame(frame);
      wakeRef.current = () => {};
      observer.disconnect();
    };
  }, []);

  const active = cents !== null;
  const value = formatDeviation(cents, precise);
  const range = MAX_DISPLAY;
  const lowest = -range;
  const line = inTune ? "var(--color-primary)" : "var(--tuner-ink)";
  const accent = inTune ? "var(--tuner-ok)" : "var(--color-primary)";

  return (
    <div
      ref={fieldRef}
      className="relative mx-auto h-full w-full max-w-[342px] select-none"
      role="meter"
      aria-valuemin={lowest}
      aria-valuemax={range}
      aria-valuenow={active ? displayDeviation(cents, precise) : 0}
      aria-valuetext={
        active
          ? inTune
            ? t("tuner.inTune")
            : t(precise ? "tuner.gauge.label" : "tuner.gauge.labelRelaxed", { cents: value })
          : t("tuner.noSignal")
      }
    >
      <div className="dot-field" aria-hidden="true">
        <div className="dot-field-dots" />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div
        className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full transition-colors duration-300"
        style={{
          background: `linear-gradient(to bottom, transparent, ${line} 30%, ${line} 70%, transparent)`,
          width: inTune ? 3 : 2,
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
        ref={markerRef}
        className="absolute top-1/2 left-0 will-change-transform"
        style={{ width: MARKER_W, transform: `translate3d(${171 - MARKER_W / 2}px,-50%,0)` }}
        aria-hidden="true"
      >
        {/* Round head with a small tip pointing down; white fill, coloured outline. */}
        <svg
          viewBox={`0 0 ${MARKER_W} ${MARKER_H}`}
          width={MARKER_W}
          height={MARKER_H}
          className="overflow-visible drop-shadow-md transition-opacity duration-300"
          style={{ opacity: active ? 1 : 0.5 }}
        >
          <path
            d="M24 53 L15.6 40.1 A20 20 0 1 1 32.4 40.1 Z"
            fill="#ffffff"
            stroke={accent}
            strokeWidth={3}
            strokeLinejoin="round"
            className="transition-[stroke] duration-300"
          />
          {active && inTune ? (
            <path
              d="M15.5 22.5 l6 6 l11 -12"
              fill="none"
              stroke="var(--tuner-ok)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <text
              x={24}
              y={28}
              textAnchor="middle"
              fontSize={value.length > 3 ? 12 : value.length > 2 ? 15 : 17}
              fontWeight={800}
              fill="var(--color-primary)"
              className="tabular-nums"
            >
              {value}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
