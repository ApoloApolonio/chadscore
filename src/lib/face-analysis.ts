import { LandmarkResultSchema, SuccessResponseSchema } from "./analysis-schema";
import type { FaceAnalysisResponse } from "./analysis-schema";
import { calculateFaceReport } from "./face-geometry";
import { validateSelfieFile } from "./selfie";

export interface FaceAnalysisProvider {
  analyze(file: File, signal?: AbortSignal): Promise<FaceAnalysisResponse>;
}

export const faceAnalysisProvider: FaceAnalysisProvider = {
  async analyze(file, signal) {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    if (typeof Worker === "undefined" || typeof createImageBitmap === "undefined" || typeof OffscreenCanvas === "undefined") {
      throw new Error("Este navegador não oferece os recursos de análise local. Use uma versão atual do Chrome, Edge, Firefox ou Safari compatível com WebAssembly, Worker e OffscreenCanvas.");
    }
    await validateSelfieFile(file);
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const report = await new Promise<FaceAnalysisResponse>((resolve, reject) => {
      const worker = new Worker("/face-landmarker.worker.js");
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        worker.terminate();
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Cancelado", "AbortError"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("O processamento local demorou demais. Tente uma foto menor ou outro navegador."));
      }, 60_000);
      signal?.addEventListener("abort", abort, { once: true });
      worker.onerror = () => {
        cleanup();
        reject(new Error("Não foi possível carregar a análise local. Execute npm run prepare:models e tente novamente."));
      };
      worker.onmessage = ({ data }: MessageEvent<unknown>) => {
        cleanup();
        try {
          if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
            throw new Error(data.error);
          }
          const detection = LandmarkResultSchema.safeParse(data);
          if (!detection.success) throw new Error("O detector retornou pontos inválidos. Tente outra foto.");
          const calculated = calculateFaceReport(detection.data);
          if (calculated.score === null || !calculated.captureConfidence.reliable) {
            throw new Error(`Captura sem confiança suficiente. ${calculated.captureConfidence.reasons.join(" ")} Selecione outra foto; nenhuma nota ou vencedor foi atribuído.`);
          }
          resolve(SuccessResponseSchema.parse({
            status: "completed",
            report: calculated,
            visualization: {
              landmarks: detection.data.faces[0],
              width: detection.data.width,
              height: detection.data.height,
            },
          }));
        } catch (error) {
          reject(error);
        }
      };
      try {
        // Structured clone para outro contexto do MESMO navegador, nunca HTTP.
        worker.postMessage({ file });
      } catch {
        cleanup();
        reject(new Error("Não foi possível processar este arquivo localmente."));
      }
    });
    return report;
  },
};
