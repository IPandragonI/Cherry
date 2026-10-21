"use client";

import { useT } from "@/lib/i18n/useT";
import { displayNote, noteName } from "@/lib/music/notes";
import type { Fret } from "@/lib/music/recognize";

export const FRET_COUNT = 12;
const NUT_W = 48;
const CELL_W = 58;
const ROW_H = 44;
const LABEL_H = 22;
const INLAYS = [3, 5, 7, 9];

interface FretboardProps {
  strings: number[];
  frets: Fret[];
  onChange: (frets: Fret[]) => void;
}

/**
 * Horizontal fretboard: high string on top, low string at the bottom, as seen when
 * looking down at the guitar. The cells are real buttons laid over the SVG drawing.
 */
export function Fretboard({ strings, frets, onChange }: FretboardProps) {
  const t = useT();
  const count = strings.length;
  const width = NUT_W + CELL_W * FRET_COUNT;
  const height = ROW_H * count;
  // Row 0 is the highest string.
  const rows = Array.from({ length: count }, (_, r) => count - 1 - r);
  const rowY = (row: number) => row * ROW_H + ROW_H / 2;
  const cellX = (fret: number) => NUT_W + (fret - 0.5) * CELL_W;

  const set = (string: number, value: Fret) =>
    onChange(frets.map((f, i) => (i === string ? value : f)));

  return (
    <div className="-mx-4 [scrollbar-width:thin] overflow-x-auto px-4 pb-2">
      <div className="relative" style={{ width, height: height + LABEL_H }}>
        <svg
          width={width}
          height={height + LABEL_H}
          className="absolute inset-0"
          aria-hidden="true"
        >
          <rect
            x={NUT_W}
            y={0}
            width={width - NUT_W}
            height={height}
            rx={6}
            className="fill-base-200"
          />
          {INLAYS.map((n) => (
            <circle key={n} cx={cellX(n)} cy={height / 2} r={6} className="fill-base-300" />
          ))}
          <circle cx={cellX(12)} cy={height / 2 - ROW_H} r={6} className="fill-base-300" />
          <circle cx={cellX(12)} cy={height / 2 + ROW_H} r={6} className="fill-base-300" />
          <rect
            x={NUT_W - 6}
            y={0}
            width={6}
            height={height}
            rx={2}
            className="fill-base-content/75"
          />
          {Array.from({ length: FRET_COUNT }, (_, i) => (
            <line
              key={i}
              x1={NUT_W + (i + 1) * CELL_W}
              x2={NUT_W + (i + 1) * CELL_W}
              y1={0}
              y2={height}
              className="stroke-base-content/35"
              strokeWidth={2}
            />
          ))}
          {rows.map((s, row) => (
            <line
              key={s}
              x1={NUT_W - 6}
              x2={width}
              y1={rowY(row)}
              y2={rowY(row)}
              className="stroke-base-content/60"
              strokeWidth={0.8 + (1.6 * (count - 1 - s)) / Math.max(1, count - 1)}
            />
          ))}
          {Array.from({ length: FRET_COUNT }, (_, i) => (
            <text
              key={i}
              x={cellX(i + 1)}
              y={height + 16}
              textAnchor="middle"
              fontSize={11}
              className="fill-base-content/75"
            >
              {i + 1}
            </text>
          ))}
          {rows.map((s, row) => {
            const f = frets[s];
            if (f === null)
              return (
                <path
                  key={`m${s}`}
                  d={`M${NUT_W / 2 - 10},${rowY(row) - 7} l14,14 m0,-14 l-14,14`}
                  className="stroke-base-content/70"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              );
            if (f === 0)
              return (
                <circle
                  key={`o${s}`}
                  cx={NUT_W / 2 - 3}
                  cy={rowY(row)}
                  r={11}
                  className="fill-base-100 stroke-primary"
                  strokeWidth={2}
                />
              );
            return (
              <circle key={`d${s}`} cx={cellX(f)} cy={rowY(row)} r={14} className="fill-primary" />
            );
          })}
          {rows.map((s, row) => {
            const f = frets[s];
            if (f === null) return null;
            const x = f === 0 ? NUT_W / 2 - 3 : cellX(f);
            return (
              <text
                key={`n${s}`}
                x={x}
                y={rowY(row) + 4}
                textAnchor="middle"
                fontSize={f === 0 ? 10 : 11}
                fontWeight={700}
                className={f === 0 ? "fill-primary" : "fill-primary-content"}
              >
                {displayNote(noteName(strings[s] + f))}
              </text>
            );
          })}
        </svg>

        {rows.map((s, row) => {
          const n = count - s;
          const f = frets[s];
          const state =
            f === null
              ? t("finder.muted")
              : f === 0
                ? t("finder.open")
                : t("finder.fretted", { fret: f });
          return (
            <div
              key={s}
              className="absolute left-0 flex"
              style={{ top: row * ROW_H, height: ROW_H }}
            >
              <button
                type="button"
                style={{ width: NUT_W }}
                className="h-full rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                aria-label={t("finder.nut", { n, state })}
                onClick={() => set(s, f === 0 ? null : 0)}
              />
              {Array.from({ length: FRET_COUNT }, (_, i) => {
                const fret = i + 1;
                const active = f === fret;
                return (
                  <button
                    key={fret}
                    type="button"
                    style={{ width: CELL_W }}
                    className="h-full rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                    aria-label={t("finder.cell", { n, fret })}
                    aria-pressed={active}
                    onClick={() => set(s, active ? null : fret)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
