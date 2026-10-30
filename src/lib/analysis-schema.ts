import { z } from "zod";

export const ESTIMATE_NOTICE =
  "A pontuação aplica preferências estéticas subjetivas do ChadScore a contornos e relações 2D. Não mede beleza científica, estrutura óssea real, saúde ou valor pessoal. Luz, lente, ângulo, expressão e erros dos pontos influenciam o resultado.";

const description = z.string().min(1).max(1200);

export const ReportSchema = z.strictObject({
  calibrationVersion: z.literal("3"),
  captureConfidence: z.object({ reliable: z.boolean(), reasons: z.array(z.string()).max(12) }),
  scoring: z.object({ structure: z.number().min(0).max(10).nullable(), harmony: z.number().min(0).max(10).nullable() }),
  score: z.number().min(0).max(10).nullable(),
  potential: z.number().min(0).max(10).nullable(),
  potentialRange: z.object({
    lower: z.number().min(0).max(10),
    upper: z.number().min(0).max(10),
  }).nullable(),
  regions: z.strictObject({
    eyes: z.number().min(0).max(10).nullable(),
    eyebrows: z.number().min(0).max(10).nullable(),
    nose: z.number().min(0).max(10).nullable(),
    lips: z.number().min(0).max(10).nullable(),
    jawline: z.number().min(0).max(10).nullable(),
    chin: z.number().min(0).max(10).nullable(),
    cheekbones: z.number().min(0).max(10).nullable(),
    skin: z.number().min(0).max(10).nullable(),
    hair: z.number().min(0).max(10).nullable(),
    harmony: z.number().min(0).max(10).nullable(),
  }),
  summary: description,
  symmetry: description,
  jawline: description,
  eyes: description,
  proportions: description,
  looksmaxing: z.array(z.string().min(1).max(500)).min(1).max(6),
  limitations: z.array(z.string().min(1).max(500)).min(1).max(5),
  measurements: z.array(z.strictObject({
    label: z.string(),
    value: z.number().finite(),
    unit: z.enum(["%", "razão", "°"]),
    method: z.string(),
  })),
  scoreComponents: z.array(z.strictObject({
    label: z.string(),
    weight: z.number().min(0).max(1),
    error: z.number().min(0),
    tolerance: z.number().positive(),
    score: z.number().min(0).max(100),
  })).max(7),
});

export const LandmarkResultSchema = z.object({
  faces: z.array(z.array(z.object({ x: z.number(), y: z.number() })).min(468).max(478)).max(2),
  width: z.number().int().positive().max(1280),
  height: z.number().int().positive().max(1280),
  // Dados ausentes/ilegíveis são aceitos no transporte, mas provocam abstenção da nota.
  captureLight: z.unknown().optional(),
  faceMatrices: z.unknown().optional(),
  appearance: z.unknown().optional(),
  captureQuality: z.unknown().optional(),
  faceExpressions: z.unknown().optional(),
});

export const FaceVisualizationSchema = z.strictObject({
  landmarks: z.array(z.object({ x: z.number().finite(), y: z.number().finite() })).min(468).max(478),
  width: z.number().int().positive().max(1280),
  height: z.number().int().positive().max(1280),
});

export type FaceVisualization = z.infer<typeof FaceVisualizationSchema>;

export const SuccessResponseSchema = z.strictObject({
  status: z.literal("completed"),
  report: ReportSchema,
  visualization: FaceVisualizationSchema,
});

export type FaceReport = z.infer<typeof ReportSchema>;
export type FaceAnalysisResponse = z.infer<typeof SuccessResponseSchema>;
