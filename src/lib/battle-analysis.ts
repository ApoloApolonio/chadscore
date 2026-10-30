import type { FaceAnalysisResponse } from "./analysis-schema";
import { faceAnalysisProvider, type FaceAnalysisProvider } from "./face-analysis";

export type BattleAnalysisCache = WeakMap<File, FaceAnalysisResponse>;

/** Local orchestration boundary; no transport, accounts or Live services. */
export async function analyzeBattlePhotos(files: readonly [File, File], options: {
  signal: AbortSignal;
  cache: BattleAnalysisCache;
  provider?: FaceAnalysisProvider;
  onProgress?: (participant: 0 | 1) => void;
}): Promise<[FaceAnalysisResponse, FaceAnalysisResponse]> {
  const provider = options.provider ?? faceAnalysisProvider;
  const responses: FaceAnalysisResponse[] = [];
  // Sequential WASM execution bounds mobile memory and avoids two simultaneous runtimes.
  for (const index of [0, 1] as const) {
    options.signal.throwIfAborted();
    const file = files[index];
    options.onProgress?.(index);
    let response = options.cache.get(file);
    if (!response) {
      response = await provider.analyze(file, options.signal);
      options.signal.throwIfAborted();
      options.cache.set(file, response);
    }
    responses.push(response);
  }
  options.signal.throwIfAborted();
  return [responses[0], responses[1]];
}
