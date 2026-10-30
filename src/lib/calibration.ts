/** V3: critérios estéticos subjetivos explícitos; nunca uma norma biológica/populacional. */
export const CALIBRATION_VERSION = "3";

export const SCORE_WEIGHTS = { structure: 0.70, harmony: 0.30, presentation: 0 } as const;
export const STRUCTURE_REGION_WEIGHTS = { jawline: .30, chin: .20, cheekbones: .20, eyes: .20, eyebrows: .10 } as const;
export const REGION_SCORE_WEIGHTS = { shape: .75, balance: .25 } as const;
export const CAPTURE_LIMITS = { tiltDegrees: 12, minimumFacePixels: 160, minimumDetail: .015, maximumClipping: .20, maximumLightingImbalance: .35, maximumExpression: .45, maximumMouthOpening: .10 } as const;

// Targets are app preferences, not estimates from celebrities or universal ideals.
// HalfResponse: deviation at which the individual response reaches 5/10.
export const STRUCTURE_CRITERIA = [
  { key: "jawWidth", region: "jawline", label: "Largura mandibular relativa", target: .78, halfResponse: .16, weight: .55, unit: "razão" },
  { key: "jawAngle", region: "jawline", label: "Ângulo do contorno mandibular 2D", target: 125, halfResponse: 25, weight: .45, unit: "°" },
  { key: "chinWidth", region: "chin", label: "Largura do queixo/mandíbula", target: .38, halfResponse: .15, weight: .35, unit: "razão" },
  { key: "chinHeight", region: "chin", label: "Altura aparente do queixo/terço inferior", target: .60, halfResponse: .18, weight: .35, unit: "razão" },
  { key: "chinAngle", region: "chin", label: "Ângulo do contorno do queixo 2D", target: 135, halfResponse: 25, weight: .30, unit: "°" },
  { key: "cheekJaw", region: "cheekbones", label: "Largura malar/mandíbula", target: 1.25, halfResponse: .25, weight: .5, unit: "razão" },
  { key: "cheekContour", region: "cheekbones", label: "Contorno malar/largura facial", target: .94, halfResponse: .12, weight: .5, unit: "razão" },
  { key: "eyeOpening", region: "eyes", label: "Abertura/largura média dos olhos", target: .26, halfResponse: .16, weight: .30, unit: "razão" },
  { key: "eyeTilt", region: "eyes", label: "Inclinação cantal aparente média", target: 4, halfResponse: 8, weight: .30, unit: "°" },
  { key: "browEyeGap", region: "eyes", label: "Distância sobrancelha–olho/largura ocular", target: .55, halfResponse: .35, weight: .40, unit: "razão" },
  { key: "browSlope", region: "eyebrows", label: "Inclinação aparente das sobrancelhas", target: 0, halfResponse: 12, weight: .35, unit: "°" },
  { key: "browArch", region: "eyebrows", label: "Arco relativo das sobrancelhas", target: .06, halfResponse: .12, weight: .35, unit: "razão" },
  { key: "browWidth", region: "eyebrows", label: "Largura sobrancelha/largura ocular", target: 1.10, halfResponse: .35, weight: .30, unit: "razão" },
] as const;

export function weightedHarmonic(items: readonly { value: number | null; weight: number }[]): number | null {
  if (!items.length || items.some(({ value, weight }) => value === null || !Number.isFinite(value) || value! < 0 || !Number.isFinite(weight) || weight <= 0)) return null;
  if (items.some(({ value }) => value === 0)) return 0;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return total / items.reduce((sum, item) => sum + item.weight / item.value!, 0);
}

export function aggregateFaceScore(structure: number | null, harmony: number | null) {
  return weightedHarmonic([{ value: structure, weight: SCORE_WEIGHTS.structure }, { value: harmony, weight: SCORE_WEIGHTS.harmony }]);
}

/** Escala de resposta técnica (não um padrão populacional ou um ideal de proporções). */
export function geometricResponse(error: number, halfResponse: number) {
  if (!Number.isFinite(error) || error < 0 || !Number.isFinite(halfResponse) || halfResponse <= 0) {
    throw new Error("Erro geométrico inválido.");
  }
  return 100 / (1 + (error / halfResponse) ** 2);
}

export function rms(values: readonly number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}
