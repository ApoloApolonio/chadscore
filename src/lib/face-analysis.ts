export type FaceAnalysisResponse = {
  status: "unavailable";
  message: string;
};

/** Ponto de integração futura. Um provedor real deverá receber o arquivo validado. */
export interface FaceAnalysisProvider {
  analyze(file: File): Promise<FaceAnalysisResponse>;
}

/** Sem backend: não envia, persiste ou analisa a foto e não fabrica resultados. */
export const faceAnalysisProvider: FaceAnalysisProvider = {
  async analyze() {
    return {
      status: "unavailable",
      message:
        "A IA ainda não está conectada. Nenhuma análise foi realizada e sua foto não foi enviada.",
    };
  },
};
