"use client";

import Link from "next/link";
import { FaceVisualizationPanel } from "./face-visualization";
import { ScoreRing } from "./score-ring";
import { useRouter } from "next/navigation";
import { classifyPotential, classifyPSL, formatScore } from "@/lib/score-classification";
import { useAnalysisSession } from "./analysis-session";

const regions = [
  ["eyes", "Olhos"], ["eyebrows", "Sobrancelhas"], ["nose", "Nariz"],
  ["lips", "Lábios"], ["jawline", "Mandíbula"], ["chin", "Queixo"],
  ["cheekbones", "Maçãs do rosto"], ["skin", "Pele"], ["hair", "Cabelo"],
  ["harmony", "Harmonia facial"],
] as const;

export function AnalysisResults() {
  const { report, photoUrl, visualization, clearAnalysis } = useAnalysisSession();
  const router = useRouter();

  function startAgain() {
    clearAnalysis();
    router.replace("/");
  }

  return (
    <main className="app-surface min-h-svh px-5 pb-10 sm:px-8">
      <header className="brand-header">
        <Link href="/" onClick={clearAnalysis} className="brand blue-focus">ChadScore<span>.</span></Link>
      </header>
      {!report ? (
        <section className="mx-auto max-w-md py-24 text-center">
          <h1 className="text-2xl font-medium tracking-tight">Nenhum relatório nesta sessão</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">Foto, pontos e resultados são descartados ao atualizar ou fechar a página.</p>
          <Link href="/" className="primary-button blue-focus mt-7 inline-block rounded-full px-6 py-3 text-sm font-medium">Escolher uma selfie</Link>
        </section>
      ) : (
        <div className="results-layout mx-auto max-w-xl">
          <h1 className="sr-only">Seu resultado</h1>
          {photoUrl && visualization && <FaceVisualizationPanel photoUrl={photoUrl} data={visualization} />}

          <section aria-label="Indicadores da análise" className="result-bubble score-block">
            <div className="score-pair">
              <ScoreRing value={report.score} label="ATUAL" testId="overall-score" />
              <ScoreRing value={report.potential} label="POTENCIAL" testId="potential-score" descriptionId="potential-note" />
            </div>
          </section>
          <p className="result-bubble psl-line"><span>SEU PSL</span><strong data-testid="psl-classification">{classifyPSL(report.score)}</strong><span data-testid="potential-label" className="sr-only">{classifyPotential(report.potential)}</span></p>

          <section aria-labelledby="regions-heading" className="result-bubble regions-section">
            <h2 id="regions-heading" className="sr-only">Notas por região facial</h2>
            <div className="region-grid">
              {regions.map(([key, name]) => {
                const value = report.regions[key];
                return <article key={key} aria-label={name} className="region-item">
                  <div className="region-label"><h3>{name}</h3><span aria-label={`${name}: ${value === null ? "não avaliado" : formatScore(value)}`}>{formatScore(value)}</span></div>
                  <div className={`region-scale ${value === null ? "region-scale--unavailable" : ""}`} role={value === null ? undefined : "meter"} aria-label={value === null ? `${name}: não avaliado` : name} aria-valuemin={value === null ? undefined : 0} aria-valuemax={value === null ? undefined : 10} aria-valuenow={value ?? undefined}>
                    {value !== null && <div className="region-progress" style={{ width: `${value * 10}%` }}><span className="region-marker" /></div>}
                  </div>
                </article>;
              })}
            </div>
          </section>

          <div className="results-actions">
            <button type="button" onClick={startAgain} className="result-bubble new-analysis-button blue-focus w-full px-7 py-4 text-sm font-semibold">Nova análise</button>
            <p id="potential-note" className="sr-only">{report.potentialRange
                ? `Potencial: cenário superior de captura (variação ${formatScore(report.potentialRange.lower)}–${formatScore(report.potentialRange.upper)}). A nota pode subir ou cair; não garante melhoria nem prevê beleza futura.`
                : "Potencial não estimado: faltam dados confiáveis de luz ou pose. Não é uma previsão de beleza futura."}</p>
          </div>
        </div>
      )}
    </main>
  );
}
