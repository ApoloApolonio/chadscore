const pslBands = [
  [11, "Sub 3"], [22, "Sub 5"], [33, "LTN"], [44, "MTN"],
  [55, "HTN"], [66, "Chadlite"], [77, "Chad"], [88, "Adam"], [100, "True Adam"],
] as const;

const potentialBands = [
  [29, "Baixo"], [49, "Mediano"], [69, "Bom"], [84, "Alto"], [100, "Muito alto"],
] as const;

/** Arredonda uma única vez, antes de classificar e exibir, sem lacunas entre faixas. */
export function roundScore(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    throw new Error("A nota deve estar entre 0 e 10.");
  }
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function classifyPSL(score: number | null) {
  if (score === null) return "—";
  const tenths = Math.round(roundScore(score) * 10);
  return pslBands.find(([maximum]) => tenths <= maximum)![1];
}

export function classifyPotential(score: number | null) {
  if (score === null) return "Não estimado";
  const tenths = Math.round(roundScore(score) * 10);
  return potentialBands.find(([maximum]) => tenths <= maximum)![1];
}

export function formatScore(score: number | null) {
  if (score === null) return "—";
  return roundScore(score).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
