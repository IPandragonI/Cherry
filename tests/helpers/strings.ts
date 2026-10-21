/**
 * The pitch an in-tune stiff string should read: what the ear hears, from its 2nd to 4th
 * partials, f_k = k·f0·√(1 + B·k²) — a little sharp of the fundamental partial.
 */
export function perceivedPitch(f0: number, stiffness: number): number {
  const harmonics = [2, 3, 4];
  const log = harmonics.reduce((s, k) => s + Math.log2(Math.sqrt(1 + stiffness * k * k)), 0);
  return f0 * 2 ** (log / harmonics.length);
}
