import { z } from "zod";
import { CAPTURE_LIMITS } from "./calibration";
import { faceTiltDegrees } from "./capture-potential";

const fraction = z.number().finite().min(0).max(1);
const QualitySchema = z.object({
  sampleCount: z.number().int().min(256), sourceFaceWidth: z.number().finite().positive(),
  canonicalFaceWidth: z.number().finite().min(120).max(193),
  detail: z.number().finite().nonnegative(), clippedFraction: fraction, lightingImbalance: fraction,
});
const ExpressionSchema = z.array(z.array(z.object({ categoryName: z.string(), score: fraction }))).length(1);
const expressionNames = ["jawOpen", "mouthSmileLeft", "mouthSmileRight", "eyeBlinkLeft", "eyeBlinkRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight"];

export function assessCapture(input: { quality: unknown; matrices: unknown; expressions: unknown; facePixels: number; mouthOpening: number | null }) {
  const reasons: string[] = [];
  const matrices = Array.isArray(input.matrices) ? input.matrices : [];
  const tilt = matrices.length === 1 ? faceTiltDegrees(matrices[0]) : null;
  if (tilt === null || tilt > CAPTURE_LIMITS.tiltDegrees) reasons.push("Use uma foto frontal, sem rotação lateral ou inclinação da cabeça.");
  const quality = QualitySchema.safeParse(input.quality);
  if (!quality.success) reasons.push("Não foi possível verificar a nitidez e a exposição. Selecione outra captura.");
  else {
    const q = quality.data;
    if (Math.min(input.facePixels, q.sourceFaceWidth) < CAPTURE_LIMITS.minimumFacePixels) reasons.push("O rosto tem poucos pixels. Aproxime a câmera sem usar grande-angular nem cortar o rosto.");
    if (q.detail < CAPTURE_LIMITS.minimumDetail) reasons.push("A foto não tem detalhe suficiente. Evite desfoque, filtros e compressão forte.");
    if (q.clippedFraction > CAPTURE_LIMITS.maximumClipping || q.lightingImbalance > CAPTURE_LIMITS.maximumLightingImbalance) reasons.push("Use luz difusa e uniforme, sem sombras fortes ou áreas saturadas.");
  }
  const expressions = ExpressionSchema.safeParse(input.expressions);
  const scores = expressions.success ? new Map(expressions.data[0].map((item) => [item.categoryName, item.score])) : null;
  if (!scores || expressionNames.some((name) => !scores.has(name))) reasons.push("Não foi possível verificar a expressão. Tente outra foto com expressão neutra.");
  else if (expressionNames.some((name) => scores.get(name)! > CAPTURE_LIMITS.maximumExpression)) reasons.push("Mantenha expressão neutra, boca relaxada e os dois olhos abertos.");
  if (input.mouthOpening === null || !Number.isFinite(input.mouthOpening) || input.mouthOpening < 0 || input.mouthOpening > CAPTURE_LIMITS.maximumMouthOpening) reasons.push("Use uma foto com a boca relaxada, sem abertura pronunciada.");
  return { reliable: reasons.length === 0, reasons };
}
