import type { LandmarkDetection, Point } from "../../src/lib/face-geometry";

/** Geometria sintética exclusiva dos testes, nunca usada pela aplicação. */
export function syntheticDetection(): LandmarkDetection {
  const points: Point[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (index: number, x: number, y: number) => { points[index] = { x, y }; };
  set(10, 0.5, 0.15); set(152, 0.5, 0.85);
  set(168, 0.5, 0.36); set(1, 0.5, 0.48); set(2, 0.5, 0.55);
  set(33, 0.34, 0.4); set(263, 0.66, 0.4);
  set(133, 0.44, 0.4); set(362, 0.56, 0.4);
  set(159, 0.39, 0.38); set(145, 0.39, 0.42);
  set(386, 0.61, 0.38); set(374, 0.61, 0.42);
  set(234, 0.25, 0.5); set(454, 0.75, 0.5);
  set(172, 0.32, 0.7); set(397, 0.68, 0.7);
  set(61, 0.4, 0.65); set(291, 0.6, 0.65);
  set(70, 0.33, 0.32); set(300, 0.67, 0.32);
  set(63, 0.38, 0.30); set(293, 0.62, 0.30);
  set(105, 0.43, 0.32); set(334, 0.57, 0.32);
  set(98, 0.46, 0.51); set(327, 0.54, 0.51);
  set(129, 0.45, 0.47); set(358, 0.55, 0.47);
  set(40, 0.46, 0.63); set(270, 0.54, 0.63);
  set(91, 0.46, 0.67); set(321, 0.54, 0.67);
  set(148, 0.45, 0.82); set(377, 0.55, 0.82);
  set(149, 0.46, 0.83); set(378, 0.54, 0.83);
  set(176, 0.43, 0.80); set(400, 0.57, 0.80);
  set(93, 0.27, 0.53); set(323, 0.73, 0.53);
  set(132, 0.29, 0.60); set(361, 0.71, 0.60);
  return { faces: [points], width: 1000, height: 1000, faceMatrices: [syntheticFaceMatrix()],
    captureQuality: syntheticQuality(), faceExpressions: [syntheticExpressions()] };
}

export function syntheticQuality() {
  return { sampleCount: 2000, sourceFaceWidth: 500, canonicalFaceWidth: 192, detail: .10, clippedFraction: 0, lightingImbalance: 0 };
}

export function syntheticExpressions() {
  return ["jawOpen", "mouthSmileLeft", "mouthSmileRight", "eyeBlinkLeft", "eyeBlinkRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight"].map((categoryName) => ({ categoryName, score: 0 }));
}

export function syntheticLight() {
  return {
    sampleCount: 2000, leftCount: 1000, rightCount: 1000,
    coverage: 1, darkFraction: 0, brightFraction: 0, leftMean: 0.5, rightMean: 0.5,
  };
}

/** Rotação sintética em torno de Y; não é uma estimativa real de rosto. */
export function syntheticFaceMatrix(tilt = 0) {
  const angle = tilt * Math.PI / 180;
  return {
    rows: 4 as const, columns: 4 as const,
    data: [Math.cos(angle), 0, Math.sin(angle), 0, 0, 1, 0, 0, -Math.sin(angle), 0, Math.cos(angle), 0, 0, 0, 0, 1],
  };
}
