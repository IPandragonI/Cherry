"use client";

import { useId } from "react";
import type { NeckSkin } from "@/store/settings";
import {
  CX,
  HEADSTOCKS,
  NUT_WIDTH,
  NUT_Y,
  type HeadstockId,
  type HeadstockModel,
} from "./headstocks";

const NUT_H = 7;
const BOARD_TOP = NUT_Y + NUT_H;
/** Nut → first fret, in proportion to the nut width (≈ 36 mm for a 43 mm nut). */
const FIRST_FRET = 74;
const FRET_Y = BOARD_TOP + FIRST_FRET;
/** Zoomed view: the whole headstock, the nut and a single fret below it. */
const BOTTOM = FRET_Y + 18;
const NUT_HALF = NUT_WIDTH / 2;

const halfWidthAt = (y: number) => NUT_HALF + (y - BOARD_TOP) * 0.03;

function stringX(index: number, count: number, y: number) {
  const half = halfWidthAt(y) - 7;
  return CX - half + (index * 2 * half) / Math.max(1, count - 1);
}

const HARDWARE = {
  chrome: ["#f6f4f0", "#a9a49c", "#e8e5df"],
  nickel: ["#ece8e0", "#a8a294", "#dcd6ca"],
  gold: ["#f6e2a4", "#b48a35", "#e9cd7f"],
} as const;

/** viewBox framing a model: its headstock and buttons, the nut and the first fret. */
export function neckViewBox(model: HeadstockModel): string {
  const minX = Math.min(model.bounds.minX, CX - NUT_HALF - 10) - 4;
  const maxX = Math.max(model.bounds.maxX, CX + NUT_HALF + 10) + 4;
  const minY = model.bounds.minY - 6;
  return `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(BOTTOM - minY).toFixed(1)}`;
}

interface NeckProps {
  skin: NeckSkin;
  model: HeadstockId;
  strings: number;
  /** Highlighted string (0 = lowest), or null. */
  target: number | null;
  inTune: boolean;
  className?: string;
}

export function Neck({ skin, model: modelId, strings, target, inTune, className }: NeckProps) {
  const id = useId().replace(/:/g, "");
  const model = HEADSTOCKS[modelId];
  const ref = (name: string) => `${name}-${id}`;
  const accent = inTune ? "var(--tuner-ok)" : "var(--tuner-accent)";
  const thickness = (i: number) => 2.8 - (1.8 * i) / Math.max(1, strings - 1);
  const indexes = Array.from({ length: strings }, (_, i) => i);
  const metal = HARDWARE[model.hardware];
  const boardBottom = halfWidthAt(BOTTOM);

  return (
    <svg
      viewBox={neckViewBox(model)}
      className={className ?? "neck mx-auto block h-full w-auto max-w-full"}
      data-skin={skin}
      data-model={modelId}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ref("wood")} x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "var(--wood-2)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--wood-1)" }} />
          <stop offset="1" style={{ stopColor: "var(--wood-2)" }} />
        </linearGradient>
        <linearGradient id={ref("face")} x1="0" x2="1" y1="0" y2="0.25">
          <stop offset="0" stopColor={model.face[0]} />
          <stop offset="0.5" stopColor={model.face[1]} />
          <stop offset="1" stopColor={model.face[0]} />
        </linearGradient>
        <linearGradient id={ref("pearl")} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f3fbf6" />
          <stop offset="0.3" stopColor="#bfe3dc" />
          <stop offset="0.55" stopColor="#efe4f6" />
          <stop offset="0.8" stopColor="#9fd0d6" />
          <stop offset="1" stopColor="#f6efe2" />
        </linearGradient>
        <linearGradient id={ref("metal")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={metal[0]} />
          <stop offset="0.5" stopColor={metal[1]} />
          <stop offset="1" stopColor={metal[2]} />
        </linearGradient>
        <radialGradient id={ref("button")} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#fbf6ec" />
          <stop offset="0.7" stopColor="#e8dcc6" />
          <stop offset="1" stopColor="#cdbd9f" />
        </radialGradient>
        <filter id={ref("glow")} x="-200%" y="-20%" width="500%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tuner shafts and buttons, behind the headstock */}
      {indexes.map((i) => {
        const p = model.post(i, strings);
        const k = model.key(i, strings);
        const angle = (Math.atan2(k.y - p.y, k.x - p.x) * 180) / Math.PI;
        const length = Math.hypot(k.x - p.x, k.y - p.y);
        return (
          <g key={`key-${i}`}>
            <rect
              x={0}
              y={-2.6}
              width={length}
              height={5.2}
              rx={2.6}
              fill={`url(#${ref("metal")})`}
              transform={`translate(${p.x} ${p.y}) rotate(${angle})`}
            />
            <TunerKey model={model} x={k.x} y={k.y} angle={angle} fill={ref("button")} />
          </g>
        );
      })}

      {/* Headstock */}
      <path
        d={model.outline}
        fill={`url(#${ref("face")})`}
        stroke={model.bound ? "var(--nut)" : "rgb(0 0 0 / 0.35)"}
        strokeWidth={model.bound ? 4.5 : 1.2}
        strokeLinejoin="round"
      />
      {model.bound && (
        // Multi-ply binding: a thin dark line inside the cream edge.
        <path
          d={model.outline}
          fill="none"
          stroke="rgb(0 0 0 / 0.55)"
          strokeWidth={0.8}
          transform={`translate(${CX} ${NUT_Y}) scale(0.975) translate(${-CX} ${-NUT_Y})`}
        />
      )}
      {model.ornament && (
        <Ornament
          model={modelId}
          at={model.ornament.at}
          size={model.ornament.size}
          pearl={`url(#${ref("pearl")})`}
        />
      )}
      {model.truss && <TrussCover {...model.truss} />}

      {/* Fingerboard down to the first fret */}
      <path
        d={`M${CX - NUT_HALF},${BOARD_TOP} L${CX + NUT_HALF},${BOARD_TOP} L${CX + boardBottom},${BOTTOM} L${CX - boardBottom},${BOTTOM} Z`}
        fill={`url(#${ref("wood")})`}
        stroke={model.bound ? "var(--nut)" : "none"}
        strokeWidth={model.bound ? 3 : 0}
      />
      <line
        x1={CX - halfWidthAt(FRET_Y)}
        x2={CX + halfWidthAt(FRET_Y)}
        y1={FRET_Y}
        y2={FRET_Y}
        strokeWidth={3}
        style={{ stroke: "var(--fret)" }}
      />

      {/* Nut */}
      <rect
        x={CX - NUT_HALF - 1}
        y={NUT_Y}
        width={NUT_WIDTH + 2}
        height={NUT_H}
        rx={1.5}
        style={{ fill: "var(--nut)" }}
      />

      {/* Strings: tuner post → nut → down the neck */}
      {indexes.map((i) => {
        const p = model.post(i, strings);
        const d = `M${p.x},${p.y} L${stringX(i, strings, BOARD_TOP)},${NUT_Y} L${stringX(i, strings, BOTTOM)},${BOTTOM}`;
        const active = i === target;
        return (
          <g key={`s-${i}`}>
            <path
              d={d}
              fill="none"
              stroke="rgb(0 0 0 / 0.28)"
              strokeWidth={thickness(i) + 1}
              transform="translate(1.2,1.2)"
            />
            <path
              d={d}
              fill="none"
              stroke={active ? accent : "var(--tuner-string)"}
              strokeWidth={active ? thickness(i) + 1.2 : thickness(i)}
              filter={active ? `url(#${ref("glow")})` : undefined}
              strokeLinejoin="round"
              className="transition-[stroke] duration-200"
            />
          </g>
        );
      })}

      {model.stringTree && (
        <g>
          <circle
            cx={model.stringTree.x}
            cy={model.stringTree.y}
            r={6}
            fill={`url(#${ref("metal")})`}
            stroke="rgb(0 0 0 / 0.3)"
          />
          <circle cx={model.stringTree.x} cy={model.stringTree.y} r={1.6} fill="#6f695f" />
        </g>
      )}

      {/* Tuner posts with bushings (over the strings) */}
      {indexes.map((i) => {
        const p = model.post(i, strings);
        const active = i === target;
        return (
          <g key={`post-${i}`}>
            {model.keyStyle === "ebony" && (
              // Hex nut around the bushing.
              <path
                d={hexagon(p.x, p.y, 9)}
                fill={`url(#${ref("metal")})`}
                stroke="rgb(0 0 0 / 0.3)"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={7.5}
              fill={`url(#${ref("metal")})`}
              stroke="rgb(0 0 0 / 0.35)"
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={3.8}
              fill={metal[2]}
              stroke={active ? accent : "rgb(0 0 0 / 0.4)"}
              strokeWidth={active ? 2.4 : 1}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Bell-shaped truss-rod cover: rounded narrow top, concave flanks, wide base. */
function TrussCover({ top, bottom, width }: NonNullable<HeadstockModel["truss"]>) {
  const { x, y } = top;
  const half = width / 2;
  const neck = width * 0.16;
  const h = bottom - y;
  const d = [
    `M${x - neck},${y + neck}`,
    `A${neck},${neck} 0 0 1 ${x + neck},${y + neck}`,
    `C${x + neck},${y + h * 0.55} ${x + half * 0.55},${bottom - h * 0.12} ${x + half},${bottom}`,
    `L${x - half},${bottom}`,
    `C${x - half * 0.55},${bottom - h * 0.12} ${x - neck},${y + h * 0.55} ${x - neck},${y + neck}`,
    "Z",
  ].join(" ");
  return (
    <g>
      <path d={d} fill="#121011" stroke="var(--nut)" strokeWidth={1.4} />
      <circle cx={x} cy={y + neck} r={1.4} fill="var(--nut)" opacity={0.8} />
      <circle cx={x} cy={bottom - 5} r={1.4} fill="var(--nut)" opacity={0.8} />
    </g>
  );
}

function hexagon(cx: number, cy: number, r: number) {
  return (
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ") + " Z"
  );
}

function TunerKey({
  model,
  x,
  y,
  angle,
  fill,
}: {
  model: HeadstockModel;
  x: number;
  y: number;
  angle: number;
  fill: string;
}) {
  const { w, h } = model.keySize;
  const transform = `translate(${x} ${y}) rotate(${angle})`;
  if (model.keyStyle === "ebony") {
    return (
      <g transform={transform}>
        <ellipse cx={0} cy={0} rx={w / 2} ry={h / 2} fill="#141112" />
        <ellipse cx={-w * 0.15} cy={-h * 0.18} rx={w * 0.18} ry={h * 0.12} fill="#4a4446" />
      </g>
    );
  }
  if (model.keyStyle === "vintage") {
    return (
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={h * 0.45}
        fill="#cbc4b6"
        stroke="rgb(0 0 0 / 0.3)"
        transform={transform}
      />
    );
  }
  // Keystone / tulip buttons: narrow at the shaft, wide and rounded at the end.
  const tip = model.keyStyle === "tulip" ? 0.5 : 0.42;
  return (
    <path
      d={`M${-w / 2},${-h * 0.28} L${w / 2 - h * 0.2},${-h / 2} Q${w / 2 + h * tip * 0.4},0 ${w / 2 - h * 0.2},${h / 2} L${-w / 2},${h * 0.28} Z`}
      fill={`url(#${fill})`}
      stroke="rgb(0 0 0 / 0.22)"
      transform={transform}
    />
  );
}

/** Decorative inlays: generic shapes, no brand marks. */
function Ornament({
  model,
  at,
  size,
  pearl,
}: {
  model: HeadstockId;
  at: { x: number; y: number };
  size: number;
  pearl: string;
}) {
  const k = size / 100;
  const transform = `translate(${at.x} ${at.y}) scale(${k})`;
  if (model === "jazz") {
    // Symmetric scrolling motif: central spear, two curling wings, a small base.
    return (
      <g fill={pearl} transform={transform} opacity={0.95}>
        <path d="M0,-48 C7,-34 7,-14 0,4 C-7,-14 -7,-34 0,-48 Z" />
        <path d="M-6,-6 C-20,-10 -34,-26 -30,-46 C-24,-36 -14,-28 -4,-26 C-12,-18 -12,-12 -6,-6 Z" />
        <path d="M6,-6 C20,-10 34,-26 30,-46 C24,-36 14,-28 4,-26 C12,-18 12,-12 6,-6 Z" />
        <path d="M-22,14 C-12,6 12,6 22,14 C12,12 4,16 0,26 C-4,16 -12,12 -22,14 Z" />
        <path d="M-4,28 L4,28 L8,46 L0,40 L-8,46 Z" />
      </g>
    );
  }
  // Open book: a simple three-petal pearl inlay.
  return (
    <g fill={pearl} transform={transform} opacity={0.95}>
      <path d="M0,-46 C10,-28 10,-10 0,10 C-10,-10 -10,-28 0,-46 Z" />
      <path d="M-4,8 C-18,0 -32,-12 -34,-30 C-20,-22 -10,-12 -4,8 Z" />
      <path d="M4,8 C18,0 32,-12 34,-30 C20,-22 10,-12 4,8 Z" />
      <path d="M-16,14 L16,14 L10,36 L-10,36 Z" />
    </g>
  );
}
