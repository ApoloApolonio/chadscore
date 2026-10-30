import { z } from "zod";
import { roundScore } from "./score-classification";

const fraction = z.number().min(0).max(1);
const SkinMetrics = z.object({
  calibrationVersion: z.literal(2),
  sampleCount: z.number().int().min(400), confidence: fraction, coverage: fraction,
  areaCount: z.number().int().min(2), referenceSamples: z.number().int().min(48),
  clippedFraction: fraction, lightingImbalance: fraction,
  textureResidual: z.number().nonnegative(), textureRms: z.number().nonnegative(),
  midScaleResidual: z.number().nonnegative(), textureVariation: z.number().nonnegative(), detail: z.number().nonnegative(),
});
const HairMetrics = z.object({
  calibrationVersion: z.literal(2),
  sampleCount: z.number().int().min(400), confidence: fraction, coverage: fraction, visibleCoverage: fraction,
  clippedFraction: fraction, detail: z.number().nonnegative(),
  relativeDetailVariation: z.number().nonnegative(), relativeGradientVariation: z.number().nonnegative(),
});

/** Apresentação fotográfica independente: não é estrutura e não altera a nota geral/PSL v3. */
export function calculateAppearanceScores(metrics: unknown): { skin: number | null; hair: number | null } {
  const input = metrics && typeof metrics === "object" ? metrics as { skin?: unknown; hair?: unknown } : {};
  const skin = SkinMetrics.safeParse(input.skin);
  const hair = HairMetrics.safeParse(input.hair);
  let skinScore: number | null = null;
  let hairScore: number | null = null;
  if (skin.success) {
    const m = skin.data;
    if (m.confidence >= 0.72 && m.coverage >= 0.4 && m.clippedFraction <= 0.15 && m.lightingImbalance <= 0.45 && m.detail >= 1.25) {
      // Média + energia das irregularidades + contraste de média escala, sem zona morta.
      // Nitidez é elegibilidade, nunca 30% de bônus por uma câmera melhor.
      const loss = 0.35 * m.textureResidual + 0.35 * m.textureRms + 0.20 * m.midScaleResidual + 0.10 * m.textureVariation;
      skinScore = roundScore(10 / (1 + loss / 0.10));
    }
  }
  if (hair.success) {
    const m = hair.data;
    if (m.confidence >= 0.8 && m.coverage >= 0.65 && m.visibleCoverage >= 0.015 && m.clippedFraction <= 0.25 && m.detail >= 0.5) {
      // Consistência RELATIVA da textura visível, não quantidade de cabelo ou direção ideal de fios.
      const loss = 0.5 * m.relativeDetailVariation + 0.5 * m.relativeGradientVariation;
      hairScore = roundScore(10 / (1 + loss));
    }
  }
  return { skin: skinScore, hair: hairScore };
}
