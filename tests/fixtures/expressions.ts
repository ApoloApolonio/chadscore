import { syntheticDetection, syntheticExpressions, syntheticFaceMatrix } from "./landmarks";

/** Controlled landmarks/activations, not human photos or model accuracy evidence.
 * eyeLeft/eyeRight refer to image-side positions (33/263), not anatomical sides.
 */
export function expressionDetection({ opening = .01, eyeLeft = .4, eyeRight = .4, cornerLift = 0, browGap = .8, tilt = 0,
  activations = {} as Record<string, number> } = {}) {
  const data = syntheticDetection(), p = data.faces[0];
  p[13].y = .65 - opening * .2 / 2; p[14].y = .65 + opening * .2 / 2;
  p[61].y = p[291].y = .65 - cornerLift * .2;
  p[159].y = .4 - eyeLeft * .1 / 2; p[145].y = .4 + eyeLeft * .1 / 2;
  p[386].y = .4 - eyeRight * .1 / 2; p[374].y = .4 + eyeRight * .1 / 2;
  for (const index of [70, 105, 300, 334]) p[index].y = .4 - browGap * .1;
  p[63].y = p[293].y = .38 - browGap * .1;
  data.faceMatrices = [syntheticFaceMatrix(tilt)];
  data.faceExpressions = [syntheticExpressions().map((entry) => ({ ...entry, score: activations[entry.categoryName] ?? 0 }))];
  return data;
}
