import { z } from "zod";
import { CAPTURE_LIMITS, EXPRESSION_LIMITS } from "./calibration";
import { faceTiltDegrees } from "./capture-potential";
import type { Point } from "./face-geometry";

const fraction = z.number().finite().min(0).max(1);
const QualitySchema = z.object({
  sampleCount: z.number().int().min(256), sourceFaceWidth: z.number().finite().positive(),
  canonicalFaceWidth: z.number().finite().min(120).max(193),
  detail: z.number().finite().nonnegative(), clippedFraction: fraction, lightingImbalance: fraction,
});
const ExpressionSchema = z.array(z.array(z.object({ categoryName: z.string(), score: fraction }))).length(1);
const expressionNames = ["jawOpen", "mouthSmileLeft", "mouthSmileRight", "eyeBlinkLeft", "eyeBlinkRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight"];

export function measureExpressionGeometry(align: (index: number) => Point | null) {
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  function eye(outer: number, inner: number, top: number, bottom: number, browOuter: number, browInner: number) {
    const [a, b, c, d, e, f] = [outer, inner, top, bottom, browOuter, browInner].map(align);
    if (!a || !b || !c || !d || !e || !f || distance(a, b) < 1e-6) return { opening: null, browGap: null };
    return { opening: distance(c, d) / distance(a, b), browGap: ((a.y + b.y - e.y - f.y) / 2) / distance(a, b) };
  }
  const rightEye = eye(33, 133, 159, 145, 70, 105), leftEye = eye(263, 362, 386, 374, 300, 334);
  const [a, b, top, bottom] = [61, 291, 13, 14].map(align);
  const width = a && b ? distance(a, b) : 0;
  return {
    mouthOpening: a && b && top && bottom && width > 1e-6 ? distance(top, bottom) / width : null,
    mouthCornerLift: [a, b].map((corner) => corner && top && bottom && width > 1e-6 ? ((top.y + bottom.y) / 2 - corner.y) / width : null),
    eyeOpening: [rightEye.opening, leftEye.opening], browEyeGap: [rightEye.browGap, leftEye.browGap],
  };
}

export function assessCapture(input: { quality: unknown; matrices: unknown; expressions: unknown; facePixels: number; geometry: ReturnType<typeof measureExpressionGeometry> }) {
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
  const g = input.geometry, limits = EXPRESSION_LIMITS;
  const valid = (value: number | null): value is number => value !== null && Number.isFinite(value);
  if (!valid(g.mouthOpening) || g.mouthOpening < 0 ||
      [...g.eyeOpening, ...g.browEyeGap, ...g.mouthCornerLift].some((value) => !valid(value))) {
    reasons.push("Os pontos dos olhos, lábios ou sobrancelhas estão incompletos. Use outra foto sem cobrir essas regiões.");
  } else {
    if (g.mouthOpening > limits.mouth.maximumOpening ||
        (scores && scores.get("jawOpen")! >= limits.mouth.strongJaw && g.mouthOpening > limits.mouth.corroboratingOpening)) {
      reasons.push("A boca está muito aberta nesta captura. Relaxe os lábios e selecione outra foto.");
    }
    for (const index of [0, 1]) {
      const opening = g.eyeOpening[index]!, other = g.eyeOpening[1 - index]!;
      // MediaPipe 33/133/159/145 = right eye; 263/362/386/374 = left eye.
      const blink = scores?.get(index === 0 ? "eyeBlinkRight" : "eyeBlinkLeft") ?? 0;
      if (opening < limits.eyes.minimumOpening ||
          (blink >= limits.eyes.strongBlink && opening <= limits.eyes.closedOpening) ||
          (blink >= limits.eyes.winkActivation && opening <= limits.eyes.winkOpening && opening < other * limits.eyes.winkRatio)) {
        reasons.push(`O olho ${index === 0 ? "direito" : "esquerdo"} parece fechado ou encoberto nesta captura. Selecione outra foto com os dois olhos visíveis.`);
      }
    }
    if (scores) {
      const smile = [scores.get("mouthSmileRight")!, scores.get("mouthSmileLeft")!];
      if ((smile.every((value) => value >= limits.smile.bilateralActivation) && g.mouthCornerLift.every((value) => value! >= limits.smile.bilateralLift)) ||
          smile.some((value, index) => value >= limits.smile.unilateralActivation && g.mouthCornerLift[index]! >= limits.smile.unilateralLift)) {
        reasons.push("Há um sorriso acentuado alterando o contorno da boca. Selecione outra foto com o rosto relaxado.");
      }
      if (scores.get("browInnerUp")! >= limits.brows.innerActivation &&
          ["browOuterUpLeft", "browOuterUpRight"].every((name) => scores.get(name)! >= limits.brows.outerActivation) &&
          g.browEyeGap.every((gap) => gap! >= limits.brows.minimumGap)) {
        reasons.push("Há elevação acentuada das sobrancelhas em conjunto nesta captura. Relaxe a testa e tente outra foto.");
      }
    }
  }
  return { reliable: reasons.length === 0, reasons };
}
