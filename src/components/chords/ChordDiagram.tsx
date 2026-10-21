import type { Voicing } from "@/lib/music/chordShapes";

const STRING_GAP = 16;
const FRET_GAP = 22;
const LEFT = 24;
const TOP = 30;
const ROWS = 5;

interface ChordDiagramProps {
  voicing: Voicing;
  label: string;
  className?: string;
}

/** Vertical chord box: strings low→high from left to right, nut at the top. */
export function ChordDiagram({ voicing, label, className }: ChordDiagramProps) {
  const { frets, fingers, barre, baseFret } = voicing;
  const count = frets.length;
  const width = LEFT * 2 + STRING_GAP * (count - 1);
  const height = TOP + FRET_GAP * ROWS + 12;
  const right = LEFT + STRING_GAP * (count - 1);
  const x = (i: number) => LEFT + i * STRING_GAP;
  const y = (fret: number) => TOP + (fret - baseFret + 0.5) * FRET_GAP;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {baseFret === 1 ? (
        <rect
          x={LEFT - 1}
          y={TOP - 4}
          width={right - LEFT + 2}
          height={5}
          rx={1.5}
          fill="currentColor"
        />
      ) : (
        <text
          x={LEFT - 9}
          y={TOP + FRET_GAP / 2 + 4}
          textAnchor="end"
          fontSize="11"
          fontWeight={600}
          fill="currentColor"
        >
          {baseFret}
        </text>
      )}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line
          key={`f${r}`}
          x1={LEFT}
          x2={right}
          y1={TOP + r * FRET_GAP}
          y2={TOP + r * FRET_GAP}
          stroke="currentColor"
          strokeOpacity={0.45}
        />
      ))}
      {frets.map((_, i) => (
        <line
          key={`s${i}`}
          x1={x(i)}
          x2={x(i)}
          y1={TOP}
          y2={TOP + ROWS * FRET_GAP}
          stroke="currentColor"
          strokeOpacity={0.7}
          strokeWidth={1.2}
        />
      ))}

      {frets.map((f, i) =>
        f === null ? (
          <path
            key={`m${i}`}
            d={`M${x(i) - 4},${TOP - 17} l8,8 m0,-8 l-8,8`}
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        ) : f === 0 ? (
          <circle
            key={`o${i}`}
            cx={x(i)}
            cy={TOP - 13}
            r={4.2}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          />
        ) : null,
      )}

      {barre && (
        <rect
          x={x(barre.from) - 7}
          y={y(barre.fret) - 7}
          width={x(barre.to) - x(barre.from) + 14}
          height={14}
          rx={7}
          className="fill-primary"
        />
      )}
      {frets.map((f, i) =>
        f !== null && f > 0 ? (
          <g key={`d${i}`}>
            <circle cx={x(i)} cy={y(f)} r={7} className="fill-primary" />
            {fingers[i] !== null && (
              <text
                x={x(i)}
                y={y(f) + 3.6}
                textAnchor="middle"
                fontSize="10"
                fontWeight={700}
                className="fill-primary-content"
              >
                {fingers[i]}
              </text>
            )}
          </g>
        ) : null,
      )}
    </svg>
  );
}
