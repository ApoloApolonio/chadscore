import type { FaceReport } from "./analysis-schema";
import { roundScore } from "./score-classification";

export type BattleOutcome = { winner: 0 | 1 | null; status: "winner" | "tie" | "unavailable"; difference: number | null };

/** Compare exactly the same rounded tenths displayed by FaceScan, never raw floats. */
export function compareBattleScores(first: number | null, second: number | null): BattleOutcome {
  if ([first, second].some((value) => value === null || !Number.isFinite(value) || value! < 0 || value! > 10)) {
    return { winner: null, status: "unavailable", difference: null };
  }
  const a = Math.round(roundScore(first!) * 10), b = Math.round(roundScore(second!) * 10);
  return { winner: a === b ? null : a > b ? 0 : 1, status: a === b ? "tie" : "winner", difference: Math.abs(a - b) / 10 };
}

export const BATTLE_REGIONS = [
  ["eyes", "Olhos"], ["eyebrows", "Sobrancelhas"], ["nose", "Nariz"], ["lips", "Lábios"],
  ["jawline", "Mandíbula"], ["chin", "Queixo"], ["cheekbones", "Maçãs do rosto"],
  ["skin", "Pele"], ["hair", "Cabelo"], ["harmony", "Harmonia facial"],
] as const;

export type BattleComparisonRow = {
  key: string; label: string; values: [number | null, number | null];
  kind: "score" | "geometry"; unit: string; outcome: BattleOutcome;
};

export function battleComparisonRows(first: FaceReport, second: FaceReport): BattleComparisonRow[] {
  const scores = [["overall", "Nota geral", first.score, second.score],
    ...BATTLE_REGIONS.map(([key, label]) => [key, label, first.regions[key], second.regions[key]] as const)] as const;
  const rows: BattleComparisonRow[] = scores.map(([key, label, a, b]) => ({
    key, label, values: [a, b], kind: "score", unit: "/ 10", outcome: compareBattleScores(a, b),
  }));
  const seen = new Set<string>();
  for (const measurement of [...first.measurements, ...second.measurements]) {
    const key = `${measurement.label}|${measurement.unit}|${measurement.method}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const find = (report: FaceReport) => {
      const value = report.measurements.find((item) => `${item.label}|${item.unit}|${item.method}` === key)?.value;
      // A report with abstaining geometry does not offer reliable raw comparisons either.
      return report.score !== null && value !== undefined && Number.isFinite(value) ? value : null;
    };
    const a = find(first), b = find(second);
    rows.push({ key, label: measurement.label === "Erro RMS de reflexão" ? "Simetria · erro RMS de reflexão" : measurement.label,
      values: [a, b], kind: "geometry", unit: measurement.unit,
      // Ratios and geometric errors are descriptive, not aesthetic winners.
      outcome: { winner: null, difference: null, status: a !== null && b !== null && a === b ? "tie" : "unavailable" },
    });
  }
  return rows;
}
