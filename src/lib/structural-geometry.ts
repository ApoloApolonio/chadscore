import type { Point } from "./face-geometry";
import { geometricResponse, REGION_SCORE_WEIGHTS, STRUCTURE_CRITERIA, STRUCTURE_REGION_WEIGHTS, weightedHarmonic } from "./calibration";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const degrees = (radians: number) => radians * 180 / Math.PI;
function angle(a: Point, b: Point, c: Point) {
  const ab = distance(a, b), cb = distance(c, b);
  if (Math.min(ab, cb) < 1e-6) return NaN;
  return degrees(Math.acos(Math.max(-1, Math.min(1, ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (ab * cb)))));
}

/** Apparent 2D contours only: never brightness, shadow, bone depth or identity. */
export function measureStructure(align: (index: number) => Point | null, balances: Record<string, number | null>) {
  const ids = [10, 152, 2, 33, 133, 263, 362, 159, 145, 386, 374, 70, 63, 105, 300, 293, 334, 234, 454, 93, 323, 132, 361, 172, 397, 176, 400, 148, 377, 61, 291];
  const p: Record<number, Point> = {};
  for (const index of ids) { const point = align(index); if (point) p[index] = point; }
  const compute = (required: number[], fn: () => number): number | null => {
    if (required.some((i) => !p[i])) return null;
    if (required.some((a, index) => required.slice(index + 1).some((b) => distance(p[a], p[b]) < 1e-6))) return null;
    const value = fn(); return Number.isFinite(value) ? value : null;
  };
  const width = () => distance(p[234], p[454]), jaw = () => distance(p[172], p[397]);
  const eye = (a: number, b: number) => distance(p[a], p[b]);
  const arch = (a: number, b: number, c: number) => Math.abs((p[c].x - p[a].x) * (p[b].y - p[a].y) - (p[c].y - p[a].y) * (p[b].x - p[a].x)) / distance(p[a], p[c]) ** 2;
  const values = {
    jawWidth: compute([172, 397, 234, 454], () => jaw() / width()),
    jawAngle: compute([132, 172, 176, 361, 397, 400], () => (angle(p[132], p[172], p[176]) + angle(p[361], p[397], p[400])) / 2),
    chinWidth: compute([148, 377, 172, 397], () => distance(p[148], p[377]) / jaw()),
    chinHeight: compute([152, 61, 291, 2], () => (p[152].y - (p[61].y + p[291].y) / 2) / (p[152].y - p[2].y)),
    chinAngle: compute([148, 152, 377], () => angle(p[148], p[152], p[377])),
    cheekJaw: compute([234, 454, 172, 397], () => width() / jaw()),
    cheekContour: compute([93, 323, 234, 454], () => distance(p[93], p[323]) / width()),
    eyeOpening: compute([159, 145, 386, 374, 33, 133, 263, 362], () => (distance(p[159], p[145]) / eye(33, 133) + distance(p[386], p[374]) / eye(263, 362)) / 2),
    // Inner minus outer corner in BOTH eyes: positive when the outer corner is above.
    eyeTilt: compute([33, 133, 263, 362], () => (degrees(Math.atan2(p[133].y - p[33].y, Math.abs(p[133].x - p[33].x))) + degrees(Math.atan2(p[263].y - p[362].y, Math.abs(p[362].x - p[263].x)))) / 2),
    browEyeGap: compute([70, 105, 300, 334, 33, 133, 263, 362], () => (((p[33].y + p[133].y - p[70].y - p[105].y) / 2) / eye(33, 133) + ((p[263].y + p[362].y - p[300].y - p[334].y) / 2) / eye(263, 362)) / 2),
    browSlope: compute([70, 105, 300, 334], () => (degrees(Math.atan2(Math.abs(p[105].y - p[70].y), Math.abs(p[105].x - p[70].x))) + degrees(Math.atan2(Math.abs(p[334].y - p[300].y), Math.abs(p[334].x - p[300].x)))) / 2),
    browArch: compute([70, 63, 105, 300, 293, 334], () => (arch(70, 63, 105) + arch(300, 293, 334)) / 2),
    browWidth: compute([70, 105, 300, 334, 33, 133, 263, 362], () => (distance(p[70], p[105]) / eye(33, 133) + distance(p[300], p[334]) / eye(263, 362)) / 2),
  };
  const metrics = STRUCTURE_CRITERIA.map((criterion) => ({ ...criterion, value: values[criterion.key],
    score: values[criterion.key] === null ? null : geometricResponse(Math.abs(values[criterion.key]! - criterion.target), criterion.halfResponse) / 10,
  }));
  const regions = Object.fromEntries(Object.keys(STRUCTURE_REGION_WEIGHTS).map((region) => {
    const shape = weightedHarmonic(metrics.filter((metric) => metric.region === region).map((metric) => ({ value: metric.score, weight: metric.weight })));
    return [region, weightedHarmonic([{ value: shape, weight: REGION_SCORE_WEIGHTS.shape }, { value: balances[region] ?? null, weight: REGION_SCORE_WEIGHTS.balance }])];
  })) as Record<keyof typeof STRUCTURE_REGION_WEIGHTS, number | null>;
  return { metrics, regions, score: weightedHarmonic(Object.entries(STRUCTURE_REGION_WEIGHTS).map(([key, weight]) => ({ value: regions[key as keyof typeof regions], weight }))) };
}
