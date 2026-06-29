// The score colour scale, shared by the on-screen gauge (score-dial) and the
// PDF report so a given score always reads the same colour everywhere.
// Physics-ish ramp: red → orange → amber → yellow-green → green.

function lerp(t: number, pts: [number, number][]): number {
  if (t <= pts[0][0]) return pts[0][1];
  if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, v0] = pts[i];
    const [t1, v1] = pts[i + 1];
    if (t <= t1) return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0);
  }
  return pts[pts.length - 1][1];
}

/** HSL components for a 0..1 score fraction. */
function arcHsl(f: number): { h: number; s: number; l: number } {
  const h = lerp(f, [
    [0, 4],
    [0.28, 18],
    [0.46, 32],
    [0.6, 50],
    [0.75, 88],
    [1.0, 145],
  ]);
  const s = lerp(f, [[0, 84], [0.46, 92], [0.75, 80], [1, 68]]);
  const l = lerp(f, [[0, 52], [0.46, 54], [0.75, 47], [1, 40]]);
  return { h, s, l };
}

/** CSS hsl() string for a 0..1 score fraction (used by the SVG gauge). */
export function arcColor(f: number): string {
  const { h, s, l } = arcHsl(f);
  return `hsl(${h.toFixed(1)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

/** Same colour as [r, g, b] 0..255 (used by jsPDF, which wants RGB). */
export function arcColorRgb(f: number): [number, number, number] {
  const { h, s, l } = arcHsl(f);
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lN - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}
