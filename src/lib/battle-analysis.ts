import type { FaceAnalysisResponse } from "./analysis-schema";
import { faceAnalysisProvider, type FaceAnalysisProvider } from "./face-analysis";

export type BattleAnalysisCache = WeakMap<File, FaceAnalysisResponse>;

export class BattleAnalysisError extends Error {
  constructor(public readonly failures: { participant: 0 | 1; message: string }[]) {
    super(failures.map(({ participant, message }) => `Participante ${participant + 1}: ${message}`).join(" "));
    this.name = "BattleAnalysisError";
  }
}

/** Local orchestration boundary; no transport, accounts or Live services. */
export async function analyzeBattlePhotos(files: readonly [File, File], options: {
  signal: AbortSignal;
  cache: BattleAnalysisCache;
  provider?: FaceAnalysisProvider;
  onProgress?: (participant: 0 | 1) => void;
}): Promise<[FaceAnalysisResponse, FaceAnalysisResponse]> {
  const provider = options.provider ?? faceAnalysisProvider;
  const responses: FaceAnalysisResponse[] = [];
  const failures: { participant: 0 | 1; message: string }[] = [];
  // Sequential WASM execution bounds mobile memory and avoids two simultaneous runtimes.
  for (const index of [0, 1] as const) {
    options.signal.throwIfAborted();
    const file = files[index];
    options.onProgress?.(index);
    try {
      let response = options.cache.get(file);
      if (!response) {
        response = await provider.analyze(file, options.signal);
        options.signal.throwIfAborted();
        if (response.report.score === null || !response.report.captureConfidence.reliable) {
          throw new Error(response.report.captureConfidence.reasons.join(" ") || "Nota geral sem confiança suficiente. Selecione outra captura frontal.");
        }
        options.cache.set(file, response);
      }
      responses[index] = response;
    } catch (cause) {
      options.signal.throwIfAborted();
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      failures.push({ participant: index, message: cause instanceof Error ? cause.message : "Não foi possível analisar esta foto." });
    }
  }
  options.signal.throwIfAborted();
  if (failures.length) throw new BattleAnalysisError(failures);
  return [responses[0], responses[1]];
}
