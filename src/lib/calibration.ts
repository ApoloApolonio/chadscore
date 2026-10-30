/** V2: resposta contínua, sem bônus, deslocamento fixo ou distribuição-alvo de beleza. */
export const CALIBRATION_VERSION = "2";

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
