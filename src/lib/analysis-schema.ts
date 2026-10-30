import { z } from "zod";

export const ESTIMATE_NOTICE =
  "A pontuação é um índice subjetivo de equilíbrio bilateral 2D, com pesos escolhidos pelo ChadScore. Não mede beleza, saúde ou valor pessoal e não tem validação científica. Luz, ângulo, expressão e erros dos pontos detectados influenciam o resultado.";

const description = z.string().min(1).max(1200);

export const ReportSchema = z.strictObject({
  score: z.number().int().min(0).max(100),
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
    unit: z.enum(["%", "razão"]),
    method: z.string(),
  })),
  scoreComponents: z.array(z.strictObject({
    label: z.string(),
    weight: z.number().min(0).max(1),
    error: z.number().min(0),
    tolerance: z.number().positive(),
    score: z.number().min(0).max(100),
  })).length(3),
});

export const LandmarkResultSchema = z.object({
  faces: z.array(z.array(z.object({ x: z.number(), y: z.number() })).min(468).max(478)).max(2),
  width: z.number().int().positive().max(1280),
  height: z.number().int().positive().max(1280),
});

export const SuccessResponseSchema = z.strictObject({
  status: z.literal("completed"),
  report: ReportSchema,
});

export type FaceReport = z.infer<typeof ReportSchema>;
export type FaceAnalysisResponse = z.infer<typeof SuccessResponseSchema>;
