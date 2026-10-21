/**
 * Unbranded headstock models traced from the reference photos in `headstock_references/`
 * (outline, tuner posts and buttons). Points are recorded in photo pixels and mapped into a
 * shared space where the nut is 88 units wide, centred on x = CX, at y = NUT_Y, so every
 * model keeps its real proportions (head length vs nut width) without brand marks.
 */

export type HeadstockId = "jazz" | "openbook" | "inline" | "square";

export const HEADSTOCK_IDS: HeadstockId[] = ["jazz", "openbook", "inline", "square"];

export const CX = 110;
export const NUT_Y = 400;
export const NUT_WIDTH = 88;

export interface Point {
  x: number;
  y: number;
}

export interface HeadstockModel {
  id: HeadstockId;
  /** Smooth closed outline (SVG path). */
  outline: string;
  /** Cream edge binding around the headstock and fingerboard. */
  bound: boolean;
  /** Face finish gradient, edge → centre. */
  face: [string, string];
  hardware: "chrome" | "gold" | "nickel";
  keyStyle: "keystone" | "tulip" | "vintage" | "ebony";
  /** Button size in SVG units. */
  keySize: { w: number; h: number };
  /** Tuner post for string `index` (0 = lowest) out of `count`. */
  post: (index: number, count: number) => Point;
  /** Tuner button for that string. */
  key: (index: number, count: number) => Point;
  /** Bell-shaped truss-rod cover: top point and bottom width. */
  truss?: { top: Point; bottom: number; width: number };
  /** Round string tree pressing the two highest strings (6-in-line). */
  stringTree?: Point;
  /** Centre and size (units) of the pearl headstock inlay, if any. */
  ornament?: { at: Point; size: number };
  /** Visible bounds: headstock, buttons and the first fret. */
  bounds: { minX: number; maxX: number; minY: number };
}

/** A traced point in photo pixels; `c` marks a sharp corner. */
type Traced = [x: number, y: number, c?: "c"];

interface Trace {
  /** Photo x of the nut centre, y of the nut, and the nut width in pixels. */
  nut: { x: number; y: number; width: number };
  outline: Traced[];
  /** Posts and buttons per side, from the headstock tip towards the nut. */
  left: { posts: Traced[]; keys: Traced[] };
  right: { posts: Traced[]; keys: Traced[] };
  truss?: { top: Traced; bottomY: number; bottomWidth: number };
  stringTree?: Traced;
  /** Inlay centre and height in photo pixels. */
  ornament?: { at: Traced; height: number };
}

function mapper(nut: Trace["nut"]) {
  const s = NUT_WIDTH / nut.width;
  return {
    scale: s,
    point: ([x, y]: Traced): Point => ({ x: CX + (x - nut.x) * s, y: NUT_Y - (nut.y - y) * s }),
  };
}

/** Closed Catmull-Rom spline through the points, as cubic Béziers; corners stay sharp. */
function smoothPath(points: Point[], corners: boolean[]): string {
  const n = points.length;
  const tangent = (i: number) => {
    if (corners[i]) return { x: 0, y: 0 };
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    return { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 };
  };
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(points[0].x)},${f(points[0].y)}`;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const ta = tangent(i);
    const tb = tangent((i + 1) % n);
    d += ` C${f(a.x + ta.x)},${f(a.y + ta.y)} ${f(b.x - tb.x)},${f(b.y - tb.y)} ${f(b.x)},${f(b.y)}`;
  }
  return `${d} Z`;
}

/** `count` points spread evenly along a polyline (for 7/8-string tunings). */
function spread(line: Point[], count: number): Point[] {
  if (count === line.length) return line;
  if (count === 1) return [line[0]];
  const lengths = line.slice(1).map((p, i) => Math.hypot(p.x - line[i].x, p.y - line[i].y));
  const total = lengths.reduce((a, b) => a + b, 0);
  return Array.from({ length: count }, (_, k) => {
    let d = (total * k) / (count - 1);
    let i = 0;
    while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
    const t = lengths[i] ? d / lengths[i] : 0;
    return {
      x: line[i].x + (line[i + 1].x - line[i].x) * t,
      y: line[i].y + (line[i + 1].y - line[i].y) * t,
    };
  });
}

function build(
  id: HeadstockId,
  trace: Trace,
  style: Pick<HeadstockModel, "bound" | "face" | "hardware" | "keyStyle"> & {
    keySize: { w: number; h: number };
  },
  layout: "3+3" | "inline",
): HeadstockModel {
  const map = mapper(trace.nut);
  const outline = trace.outline.map(map.point);
  const L = { posts: trace.left.posts.map(map.point), keys: trace.left.keys.map(map.point) };
  const R = { posts: trace.right.posts.map(map.point), keys: trace.right.keys.map(map.point) };

  // 3+3: low strings on the left from the tip; high strings mirrored on the right.
  // In line: every tuner on the left, the lowest string nearest the nut.
  const place = (which: "posts" | "keys") => (index: number, count: number) => {
    if (layout === "inline") {
      const line = spread([...L[which]].reverse(), count);
      return line[index];
    }
    const perSide = Math.ceil(count / 2);
    if (index < perSide) return spread(L[which], perSide)[index];
    const right = spread(R[which], count - perSide);
    return right[count - 1 - index];
  };

  const keys = [...L.keys, ...R.keys];
  const { w, h } = style.keySize;
  const xs = [
    ...outline.map((p) => p.x),
    ...keys.map((k) => k.x - w / 2 - 2),
    ...keys.map((k) => k.x + w / 2 + 2),
  ];
  const ys = [...outline.map((p) => p.y), ...keys.map((k) => k.y - h / 2)];

  return {
    id,
    outline: smoothPath(
      outline,
      trace.outline.map((p) => p[2] === "c"),
    ),
    post: place("posts"),
    key: place("keys"),
    truss: trace.truss && {
      top: map.point(trace.truss.top),
      bottom: NUT_Y - (trace.nut.y - trace.truss.bottomY) * map.scale,
      width: trace.truss.bottomWidth * map.scale,
    },
    stringTree: trace.stringTree && map.point(trace.stringTree),
    ornament: trace.ornament && {
      at: map.point(trace.ornament.at),
      size: trace.ornament.height * map.scale,
    },
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys) },
    ...style,
  };
}

// ── Traces (photo pixels) ───────────────────────────────────────────────────────────

/** Hollow-body jazz head: flat top with a small central V notch, flanks flaring out
 *  just above the nut, multi-ply binding. Reference: ibanez.jpg (602×900). */
const JAZZ: Trace = {
  nut: { x: 300, y: 705, width: 156 },
  outline: [
    [222, 705, "c"],
    [196, 672],
    [168, 636],
    [152, 602, "c"],
    [161, 520],
    [170, 420],
    [175, 300],
    [177, 200],
    [178, 98, "c"],
    [232, 100],
    [283, 100, "c"],
    [300, 124, "c"],
    [317, 100, "c"],
    [368, 100],
    [414, 96, "c"],
    [417, 200],
    [421, 300],
    [427, 420],
    [437, 520],
    [448, 602, "c"],
    [431, 636],
    [404, 672],
    [378, 705, "c"],
  ],
  left: {
    posts: [
      [228, 240],
      [225, 385],
      [205, 540],
    ],
    keys: [
      [130, 225],
      [128, 368],
      [108, 512],
    ],
  },
  right: {
    posts: [
      [370, 240],
      [375, 390],
      [392, 540],
    ],
    keys: [
      [470, 225],
      [480, 368],
      [493, 512],
    ],
  },
  truss: { top: [300, 520], bottomY: 695, bottomWidth: 100 },
  ornament: { at: [300, 362], height: 160 },
};

/** Open-book head: straight flanks flaring towards the tip, two raised "pages" meeting
 *  in a small central notch. Reference: gibson.png (500×500). */
const OPEN_BOOK: Trace = {
  nut: { x: 245, y: 492, width: 112 },
  outline: [
    [189, 492, "c"],
    [172, 458],
    [160, 422],
    [152, 380],
    [146, 300],
    [139, 200],
    [132, 110],
    [126, 46, "c"],
    [162, 38],
    [200, 27],
    [228, 18, "c"],
    [245, 31, "c"],
    [262, 18, "c"],
    [290, 27],
    [328, 38],
    [364, 46, "c"],
    [358, 110],
    [351, 200],
    [344, 300],
    [338, 380],
    [330, 422],
    [318, 458],
    [301, 492, "c"],
  ],
  left: {
    posts: [
      [178, 118],
      [180, 210],
      [178, 300],
    ],
    keys: [
      [100, 140],
      [108, 225],
      [105, 315],
    ],
  },
  right: {
    posts: [
      [318, 118],
      [312, 210],
      [315, 300],
    ],
    keys: [
      [392, 140],
      [385, 225],
      [390, 315],
    ],
  },
  truss: { top: [245, 318], bottomY: 470, bottomWidth: 70 },
  ornament: { at: [245, 212], height: 70 },
};

/** Six-in-line head: big rounded lobe at the tip, a waist on the treble side, tuners on a
 *  straight diagonal along the bass side. Reference: fender.jpg (316×632). */
const INLINE: Trace = {
  nut: { x: 144, y: 515, width: 112 },
  outline: [
    [200, 515, "c"],
    [212, 470],
    [240, 410],
    [266, 350],
    [271, 300],
    [262, 250],
    [270, 195],
    [296, 145],
    [313, 92],
    [310, 42],
    [285, 10],
    [245, 0],
    [206, 8],
    [182, 26],
    [162, 60],
    [140, 130],
    [120, 200],
    [101, 268],
    [84, 330],
    [62, 395],
    [47, 440],
    [52, 482],
    [88, 515, "c"],
  ],
  // Single row (listed from the tip, i.e. highest string first).
  left: {
    posts: [
      [185, 75],
      [165, 140],
      [147, 208],
      [127, 268],
      [110, 330],
      [88, 400],
    ],
    keys: [
      [127, 40],
      [107, 103],
      [87, 168],
      [67, 232],
      [46, 295],
      [26, 357],
    ],
  },
  right: { posts: [], keys: [] },
  stringTree: [180, 333],
};

/** Acoustic slab head: gently tapered rectangle, square top with rounded corners.
 *  Reference: martins.png (500×500). */
const SQUARE: Trace = {
  nut: { x: 250, y: 440, width: 110 },
  outline: [
    [195, 440, "c"],
    [183, 428],
    [176, 408],
    [171, 300],
    [165, 180],
    [159, 88],
    [160, 74],
    [172, 67],
    [250, 67],
    [328, 67],
    [340, 74],
    [341, 88],
    [335, 180],
    [329, 300],
    [324, 408],
    [317, 428],
    [305, 440, "c"],
  ],
  left: {
    posts: [
      [192, 145],
      [197, 237],
      [197, 330],
    ],
    keys: [
      [130, 160],
      [135, 250],
      [135, 350],
    ],
  },
  right: {
    posts: [
      [303, 145],
      [300, 237],
      [303, 330],
    ],
    keys: [
      [370, 160],
      [365, 250],
      [365, 350],
    ],
  },
};

export const HEADSTOCKS: Record<HeadstockId, HeadstockModel> = {
  jazz: build(
    "jazz",
    JAZZ,
    {
      bound: true,
      face: ["#0d0b0c", "#2b2224"],
      hardware: "gold",
      keyStyle: "tulip",
      keySize: { w: 34, h: 25 },
    },
    "3+3",
  ),
  openbook: build(
    "openbook",
    OPEN_BOOK,
    {
      bound: false,
      face: ["#100d0e", "#2e2526"],
      hardware: "chrome",
      keyStyle: "keystone",
      keySize: { w: 36, h: 28 },
    },
    "3+3",
  ),
  inline: build(
    "inline",
    INLINE,
    {
      bound: false,
      face: ["#c39a52", "#e3c789"],
      hardware: "nickel",
      keyStyle: "vintage",
      keySize: { w: 22, h: 17 },
    },
    "inline",
  ),
  square: build(
    "square",
    SQUARE,
    {
      bound: false,
      face: ["#3d2216", "#6e4730"],
      hardware: "gold",
      keyStyle: "ebony",
      keySize: { w: 22, h: 22 },
    },
    "3+3",
  ),
};
