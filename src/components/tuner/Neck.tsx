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
/** Pearl block inlays, jazz-box style. */
const BLOCK_INLAYS = [3, 5, 7];

const halfWidthAt = (y: number) =>
  TOP_HALF + ((BOTTOM_HALF - TOP_HALF) * (y - BOARD_TOP)) / (H - BOARD_TOP);
const fretY = (n: number) => BOARD_TOP + SCALE * (1 - 2 ** (-n / 12));

function stringX(index: number, count: number, y: number) {
  const half = halfWidthAt(y) - 7;
  return CX - half + (index * 2 * half) / Math.max(1, count - 1);
}

/**
 * Symmetric 3+3 "vase" headstock in the spirit of hollow-body jazz guitars: narrow at
 * the nut, concave flanks flaring out, rounded upper lobes and a small central crown.
 */
function headstockPath(inset = 0) {
  const i = inset;
  const half = (dx: number) => [CX - dx, CX + dx];
  const [l44, r44] = half(44 - i);
  const [l48, r48] = half(48 - i);
  const [l62, r62] = half(62 - i);
  const [l58, r58] = half(58 - i);
  const [l30, r30] = half(30);
  const [l18, r18] = half(18);
  const [l10, r10] = half(10);
  const [l4, r4] = half(4);
  return [
    `M${l44},${NUT_Y}`,
    `C${l48},90 ${l62},66 ${l62},40`,
    `C${l62},18 ${l58},${6 + i} ${l44},${6 + i}`,
    `C${l30},${6 + i} ${l18},${14 + i} ${l10},${10 + i}`,
    `Q${l4},${6 + i} ${CX},${i}`,
    `Q${r4},${6 + i} ${r10},${10 + i}`,
    `C${r18},${14 + i} ${r30},${6 + i} ${r44},${6 + i}`,
    `C${r58},${6 + i} ${r62},18 ${r62},40`,
    `C${r62},66 ${r48},90 ${r44},${NUT_Y}`,
    "Z",
  ].join(" ");
}

/** Tuner posts sit along the flaring flanks: low strings on the left from the top. */
const POSTS = [
  { y: 30, dx: 47 },
  { y: 57, dx: 45 },
  { y: 84, dx: 40 },
  { y: 101, dx: 36 },
];

function pegFor(index: number, count: number) {
  const left = Math.ceil(count / 2);
  if (index < left) return { x: CX - POSTS[index].dx, y: POSTS[index].y, side: -1 };
  const p = POSTS[count - 1 - index];
  return { x: CX + p.dx, y: p.y, side: 1 };
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
  const pearl = `pearl-${id}`;
  const chrome = `chrome-${id}`;
  const glow = `glow-${id}`;
  const accent = inTune ? "var(--tuner-ok)" : "var(--tuner-accent)";
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
        <linearGradient id={head} x1="0" x2="1" y1="0" y2="0.3">
          <stop offset="0" style={{ stopColor: "var(--wood-head-2)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--wood-head-1)" }} />
          <stop offset="1" style={{ stopColor: "var(--wood-head-2)" }} />
        </linearGradient>
        <linearGradient id={pearl} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fbf7f0" />
          <stop offset="0.45" stopColor="#e9e2f0" />
          <stop offset="0.7" stopColor="#f6efe2" />
          <stop offset="1" stopColor="#dfe9ec" />
        </linearGradient>
        <linearGradient id={chrome} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f4f2ee" />
          <stop offset="0.5" stopColor="#b9b5ae" />
          <stop offset="1" stopColor="#e6e3dd" />
        </linearGradient>
        <filter id={glow} x="-200%" y="-5%" width="500%" height="110%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tuner shafts and keystone buttons, outside the headstock */}
      {Array.from({ length: strings }, (_, i) => {
        const p = pegFor(i, strings);
        const outer = CX + p.side * 84;
        return (
          <g key={`key-${i}`}>
            <rect
              x={Math.min(p.x, outer)}
              y={p.y - 2.5}
              width={Math.abs(outer - p.x)}
              height={5}
              rx={2.5}
              fill={`url(#${chrome})`}
            />
            <rect
              x={outer + (p.side < 0 ? -18 : 0)}
              y={p.y - 8}
              width={18}
              height={16}
              rx={6}
              fill={`url(#${chrome})`}
              stroke="rgb(0 0 0 / 0.2)"
            />
          </g>
        );
      })}

      {/* Headstock with cream binding */}
      <path d={headstockPath()} style={{ fill: "var(--nut)" }} />
      <path d={headstockPath(2.5)} fill={`url(#${head})`} />

      {/* Mother-of-pearl ornament */}
      <g fill={`url(#${pearl})`} opacity={0.95}>
        <path
          d={`M${CX},16 C${CX + 7},24 ${CX + 7},32 ${CX},40 C${CX - 7},32 ${CX - 7},24 ${CX},16 Z`}
        />
        <path
          d={`M${CX - 2},42 C${CX - 10},40 ${CX - 18},44 ${CX - 20},52 C${CX - 12},52 ${CX - 5},48 ${CX - 2},42 Z`}
        />
        <path
          d={`M${CX + 2},42 C${CX + 10},40 ${CX + 18},44 ${CX + 20},52 C${CX + 12},52 ${CX + 5},48 ${CX + 2},42 Z`}
        />
        <path d={`M${CX - 9},56 L${CX + 9},56 L${CX + 5},70 L${CX - 5},70 Z`} />
      </g>

      {/* Bell truss-rod cover */}
      <path
        d={`M${CX},84 C${CX + 7},84 ${CX + 9},96 ${CX + 13},108 L${CX - 13},108 C${CX - 9},96 ${CX - 7},84 ${CX},84 Z`}
        fill="#1a1617"
        stroke="var(--nut)"
        strokeWidth={1.2}
      />

      {/* Bound fingerboard */}
      <path
        d={`M${CX - TOP_HALF - 2},${BOARD_TOP} L${CX + TOP_HALF + 2},${BOARD_TOP} L${CX + BOTTOM_HALF + 2},${H} L${CX - BOTTOM_HALF - 2},${H} Z`}
        style={{ fill: "var(--nut)" }}
      />
      <path
        d={`M${CX - TOP_HALF},${BOARD_TOP} L${CX + TOP_HALF},${BOARD_TOP} L${CX + BOTTOM_HALF},${H} L${CX - BOTTOM_HALF},${H} Z`}
        fill={`url(#${wood})`}
      />
      {BLOCK_INLAYS.map((n) => {
        const top = fretY(n - 1);
        const bottom = fretY(n);
        if (top > H) return null;
        const mid = (top + bottom) / 2;
        const half = halfWidthAt(mid) - 12;
        const h = Math.min(bottom - top - 8, 20);
        return (
          <rect
            key={n}
            x={CX - half}
            y={mid - h / 2}
            width={half * 2}
            height={h}
            rx={1.5}
            fill={`url(#${pearl})`}
            opacity={0.92}
          />
        );
      })}
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

      {/* Nut */}
      <rect
        x={CX - TOP_HALF - 2}
        y={NUT_Y}
        width={(TOP_HALF + 2) * 2}
        height={NUT_H}
        rx={1.5}
        style={{ fill: "var(--nut)" }}
      />

      {/* Strings: from the tuner post over the nut, down the neck */}
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

      {/* Tuner posts with bushings (drawn last, over the strings) */}
      {Array.from({ length: strings }, (_, i) => {
        const p = pegFor(i, strings);
        const active = i === target;
        return (
          <g key={`post-${i}`}>
            <circle cx={p.x} cy={p.y} r={7.5} fill={`url(#${chrome})`} stroke="rgb(0 0 0 / 0.3)" />
            <circle
              cx={p.x}
              cy={p.y}
              r={3.6}
              fill="#d9d5ce"
              stroke={active ? accent : "rgb(0 0 0 / 0.35)"}
              strokeWidth={active ? 2 : 1}
            />
          </g>
        );
      })}
    </svg>
  );
}
