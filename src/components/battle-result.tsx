"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceAnalysisResponse } from "@/lib/analysis-schema";
import { battleComparisonRows, type BattleOutcome } from "@/lib/mogbattle";
import { classifyPSL, formatScore } from "@/lib/score-classification";
import { FaceLandmarkPortrait } from "./face-landmark-portrait";

export type BattleResultData = {
  entries: [
    { name: string; photoUrl: string; analysis: FaceAnalysisResponse },
    { name: string; photoUrl: string; analysis: FaceAnalysisResponse },
  ];
  outcome: BattleOutcome;
};

export function BattleResult({ data, onAgain }: { data: BattleResultData; onAgain: () => void }) {
  const [points, setPoints] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const { entries, outcome } = data;
  const winner = outcome.winner;
  const rows = battleComparisonRows(entries[0].analysis.report, entries[1].analysis.report);
  const title = winner === null ? "EMPATE" : `${entries[winner].name} MOGGA ${entries[winner === 0 ? 1 : 0].name}`;

  return <div className="battle-result">
    <h1 ref={heading} tabIndex={-1} className="battle-result-heading" data-testid="battle-outcome">{winner === null ? "EMPATE" : `${entries[winner].name} venceu`}</h1>
    <div className="battle-result-grid">
      {entries.map((entry, index) => {
        const loser = winner !== null && winner !== index;
        return <article key={index} className="result-bubble battle-result-person" aria-label={`Resultado do participante ${index + 1}`}>
          <div className={`portrait-frame battle-portrait ${winner === index ? "battle-winner" : ""}`}>
            <FaceLandmarkPortrait photoUrl={entry.photoUrl} data={entry.analysis.visualization} visible={points} monochrome={loser} label={`Selfie de ${entry.name} com landmarks reais`} testId={`battle-face-${index + 1}`} />
            {loser && <span className="battle-stamp" aria-hidden="true">MOGGADO</span>}
          </div>
          <h2 className="battle-person-name">{entry.name}</h2>
          <p className="battle-person-score" data-testid={`battle-score-${index + 1}`}>{formatScore(entry.analysis.report.score)}<span> / 10,0</span></p>
          <p className="battle-person-psl" data-testid={`battle-psl-${index + 1}`}>{classifyPSL(entry.analysis.report.score)}</p>
        </article>;
      })}
    </div>
    <div className="battle-result-controls">
      <button type="button" className="photo-choice blue-focus" aria-pressed={points} onClick={() => setPoints(!points)}>{points ? "Desativar pontos" : "Ativar pontos"}</button>
      <button type="button" onClick={onAgain} className="primary-button blue-focus">Batalhar novamente</button>
    </div>
    <section className="result-bubble battle-details" aria-labelledby="battle-detail-heading">
      <h2 id="battle-detail-heading">{title}</h2>
      <p data-testid="battle-difference">{winner === null ? "Diferença: 0,0 pontos. Notas iguais após arredondamento." : `Diferença exata entre as notas exibidas: ${formatScore(outcome.difference)} pontos.`}</p>
      <div className="battle-table-scroll blue-focus" tabIndex={0} role="region" aria-label="Tabela de comparação facial">
        <table className="battle-table">
          <caption className="sr-only">Comparação entre {entries[0].name} e {entries[1].name}</caption>
          <thead><tr><th scope="col">Região ou indicador</th><th scope="col">{entries[0].name}</th><th scope="col">{entries[1].name}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.key} data-comparison={row.kind}>
            <th scope="row">{row.label}<small>{row.unit}{row.outcome.status === "tie" ? " · Empate" : row.kind === "geometry" ? " · Descritivo" : ""}</small></th>
            {row.values.map((value, index) => <td key={index} className={row.kind === "score" && row.outcome.winner === index ? "battle-cell-higher" : undefined}>
              {value === null ? "—" : row.kind === "score" ? formatScore(value) : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
              {row.kind === "score" && row.outcome.winner === index && <span className="sr-only"> · Maior nota neste indicador</span>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="battle-fineprint">Pontuação estética subjetiva, não medição científica de beleza ou valor pessoal. Medidas geométricas são descritivas: maior não significa melhor. Luz, pose e erros de detecção afetam os resultados.</p>
    </section>
  </div>;
}
