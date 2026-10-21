"use client";

import { useId } from "react";
import type { NeckSkin } from "@/store/settings";

const W = 220;
const H = 340;
const NUT_Y = 112;
const NUT_H = 6;
const BOARD_TOP = NUT_Y + NUT_H;
const TOP_HALF = 42;
const BOTTOM_HALF = 50;
const CX = W / 2;
const SCALE = 560;
const FRETS = Array.from({ length: 8 }, (_, i) => i + 1);
const INLAYS = [3, 5];

const halfWidthAt = (y: number) =>
  TOP_HALF + ((BOTTOM_HALF - TOP_HALF) * (y - BOARD_TOP)) / (H - BOARD_TOP);
const fretY = (n: number) => BOARD_TOP + SCALE * (1 - 2 ** (-n / 12));

function stringX(index: number, count: number, y: number) {
  const half = halfWidthAt(y) - 7;
  return CX - half + (index * 2 * half) / Math.max(1, count - 1);
}

/** Peg posts: low strings on the left, from the top down; high strings mirrored. */
function pegFor(index: number, count: number) {
  const left = Math.ceil(count / 2);
  const ys = [30, 58, 86, 100];
  if (index < left) return { x: CX - 32, y: ys[index] };
  return { x: CX + 32, y: ys[count - 1 - index] };
}

interface NeckProps {
  skin: NeckSkin;
  strings: number;
  /** Highlighted string (0 = lowest), or null. */
  target: number | null;
  inTune: boolean;
}

export function Neck({ skin, strings, target, inTune }: NeckProps) {
  const id = useId().replace(/:/g, "");
  const wood = `wood-${id}`;
  const head = `head-${id}`;
  const glow = `glow-${id}`;
  const accent = inTune ? "var(--tuner-ok)" : "var(--tuner-accent)";
  const leftPegs = Math.ceil(strings / 2);
  const thickness = (i: number) => 2.7 - (1.8 * i) / Math.max(1, strings - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="neck mx-auto block h-full max-h-[340px] w-auto"
      data-skin={skin}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={wood} x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "var(--wood-2)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--wood-1)" }} />
          <stop offset="1" style={{ stopColor: "var(--wood-2)" }} />
        </linearGradient>
        <linearGradient id={head} x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "var(--wood-head-2)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--wood-head-1)" }} />
          <stop offset="1" style={{ stopColor: "var(--wood-head-2)" }} />
        </linearGradient>
        <filter id={glow} x="-200%" y="-5%" width="500%" height="110%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tuner keys outside the headstock */}
      {Array.from({ length: strings }, (_, i) => {
        const p = pegFor(i, strings);
        const outward = i < leftPegs ? -1 : 1;
        return (
          <g key={`key-${i}`}>
            <rect
              x={outward < 0 ? p.x - 50 : p.x + 16}
              y={p.y - 2}
              width={34}
              height={4}
              rx={2}
              style={{ fill: "var(--peg)" }}
            />
            <ellipse
              cx={p.x + outward * 52}
              cy={p.y}
              rx={8}
              ry={10}
              style={{ fill: "var(--peg)" }}
              stroke="rgb(0 0 0 / 0.18)"
            />
          </g>
        );
      })}

      {/* Headstock */}
      <path
        d={`M${CX - TOP_HALF},${NUT_Y} L${CX - 52},44 Q${CX - 56},6 ${CX - 22},6 L${CX + 22},6 Q${CX + 56},6 ${CX + 52},44 L${CX + TOP_HALF},${NUT_Y} Z`}
        fill={`url(#${head})`}
      />

      {/* Fingerboard */}
      <path
        d={`M${CX - TOP_HALF},${BOARD_TOP} L${CX + TOP_HALF},${BOARD_TOP} L${CX + BOTTOM_HALF},${H} L${CX - BOTTOM_HALF},${H} Z`}
        fill={`url(#${wood})`}
      />
      {FRETS.map((n) => {
        const y = fretY(n);
        if (y > H) return null;
        const half = halfWidthAt(y);
        return (
          <line
            key={n}
            x1={CX - half}
            x2={CX + half}
            y1={y}
            y2={y}
            strokeWidth={2.2}
            style={{ stroke: "var(--fret)" }}
          />
        );
      })}
      {INLAYS.map((n) => (
        <circle
          key={n}
          cx={CX}
          cy={(fretY(n - 1) + fretY(n)) / 2}
          r={5}
          style={{ fill: "var(--inlay)" }}
        />
      ))}

      {/* Nut */}
      <rect
        x={CX - TOP_HALF}
        y={NUT_Y}
        width={TOP_HALF * 2}
        height={NUT_H}
        rx={1.5}
        style={{ fill: "var(--nut)" }}
      />

      {/* Strings: from the peg post over the nut, down the neck */}
      {Array.from({ length: strings }, (_, i) => {
        const p = pegFor(i, strings);
        const nutX = stringX(i, strings, BOARD_TOP);
        const d = `M${p.x},${p.y} L${nutX},${NUT_Y} L${stringX(i, strings, H)},${H}`;
        const active = i === target;
        return (
          <g key={`s-${i}`}>
            <path
              d={d}
              fill="none"
              stroke="rgb(0 0 0 / 0.22)"
              strokeWidth={thickness(i) + 1}
              transform="translate(1,1)"
            />
            <path
              d={d}
              fill="none"
              stroke={active ? accent : "var(--tuner-string)"}
              strokeWidth={active ? thickness(i) + 1 : thickness(i)}
              filter={active ? `url(#${glow})` : undefined}
              strokeLinejoin="round"
              className="transition-[stroke] duration-200"
            />
          </g>
        );
      })}

      {/* Peg posts (drawn last, over the strings) */}
      {Array.from({ length: strings }, (_, i) => {
        const p = pegFor(i, strings);
        return (
          <circle
            key={`post-${i}`}
            cx={p.x}
            cy={p.y}
            r={6.5}
            style={{ fill: "var(--peg)" }}
            stroke={i === target ? accent : "rgb(0 0 0 / 0.25)"}
            strokeWidth={i === target ? 2 : 1}
          />
        );
      })}
    </svg>
  );
}
