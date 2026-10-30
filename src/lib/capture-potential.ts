import { z } from "zod";
import { roundScore } from "./score-classification";
import type { Point } from "./face-geometry";

const LightSchema = z.object({
  sampleCount: z.number().int().min(512),
  leftCount: z.number().int().min(128),
  rightCount: z.number().int().min(128),
  coverage: z.number().min(0.95).max(1),
  darkFraction: z.number().min(0).max(1),
  brightFraction: z.number().min(0).max(1),
  leftMean: z.number().min(0).max(1),
  rightMean: z.number().min(0).max(1),
});

const MatrixSchema = z.object({
  rows: z.literal(4), columns: z.literal(4),
  data: z.array(z.number()).length(16),
});

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ramp = (value: number, from: number, to: number) => clamp((value - from) / (to - from));
const degrees = (radians: number) => radians * 180 / Math.PI;

/**
 * Inclinação do eixo frontal pelo Rzz da transformação MediaPipe.
 * Rzz é igual em disposição row-major/column-major; rejeita matrizes não rotacionais.
 */
export function faceTiltDegrees(matrix: unknown): number | null {
  const parsed = MatrixSchema.safeParse(matrix);
  if (!parsed.success) return null;
  const m = parsed.data.data;
  const rows = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]];
  const norms = rows.map((row) => Math.hypot(...row));
  if (norms.some((n) => n < 1e-6)) return null;
  const scale = norms.reduce((a, b) => a + b) / 3;
  if (norms.some((n) => Math.abs(n / scale - 1) > 0.05)) return null;
  const r = rows.map((row, index) => row.map((value) => value / norms[index]));
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
    if (Math.abs(r[a].reduce((sum, value, i) => sum + value * r[b][i], 0)) > 0.05) return null;
  }
  const determinant = r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1])
    - r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0])
    + r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0]);
  if (Math.abs(determinant - 1) > 0.05) return null;
  const tilt = degrees(Math.acos(Math.max(-1, Math.min(1, r[2][2]))));
  return Math.round(tilt * 1e6) / 1e6;
}

type CaptureInput = {
  landmarks: Point[];
  width: number;
  height: number;
  light: unknown;
  matrices: unknown;
};

/** Cenário heurístico de variação de captura, não uma previsão da próxima foto. */
export function estimateCapturePotential(score: number | null, input: CaptureInput) {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 10) return null;
  const lightResult = LightSchema.safeParse(input.light);
  const matricesResult = z.array(MatrixSchema).length(1).safeParse(input.matrices);
  if (!lightResult.success || !matricesResult.success) return null;
  const light = lightResult.data;
  if (light.leftCount + light.rightCount !== light.sampleCount || light.darkFraction + light.brightFraction > 1) return null;
  const tilt = faceTiltDegrees(matricesResult.data[0]);
  const [top, chin, leftEye, rightEye, leftFace, rightFace] = [10, 152, 33, 263, 234, 454].map((i) => input.landmarks[i]);
  if (![input.width, input.height].every((n) => Number.isFinite(n) && n > 0) ||
      [top, chin, leftEye, rightEye, leftFace, rightFace].some((p) => !p ||
        !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99)) return null;
  const dx = (rightEye.x - leftEye.x) * input.width;
  const dy = (rightEye.y - leftEye.y) * input.height;
  if (Math.hypot(dx, dy) < 40) return null;
  const eyeAngle = Math.abs(degrees(Math.atan2(dy, dx)));
  const roll = Math.min(eyeAngle, 180 - eyeAngle);
  const offset = Math.hypot((top.x + chin.x) / 2 - 0.5, (top.y + chin.y) / 2 - 0.5);
  const clipping = light.darkFraction + light.brightFraction;
  const imbalance = Math.abs(light.leftMean - light.rightMean) / Math.max(light.leftMean, light.rightMean, 1 / 255);
  // Em capturas extremas, não há base suficiente para delimitar uma variação útil.
  if (tilt === null || tilt > 30 || roll > 25 || offset > 0.30 || clipping > 0.45 || imbalance > 0.70) return null;

  const lightingRisk = 0.5 * ramp(clipping, 0.02, 0.20) + 0.5 * ramp(imbalance, 0.08, 0.50);
  const angleRisk = ramp(tilt, 3, 25);
  // A fórmula da nota já compensa roll e translação. Eles NÃO geram bônus por si só:
  // aqui só reduzem a confiança no cenário de luz/pose quando a captura está desalinhada.
  const alignmentReliability = 1 - 0.25 * ramp(roll, 2, 20);
  const centeringReliability = 1 - 0.25 * ramp(offset, 0.04, 0.25);
  const uncertainty = (0.4 * lightingRisk + 0.6 * angleRisk) * alignmentReliability * centeringReliability;
  const delta = Math.min(1.5, 10 - score) * uncertainty;
  return {
    lower: roundScore(Math.max(0, score - delta)),
    upper: roundScore(Math.min(10, score + delta)),
  };
}
