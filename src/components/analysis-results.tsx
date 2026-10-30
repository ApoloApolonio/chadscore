"use client";

import Link from "next/link";
import { useState } from "react";
import { FaceVisualizationPanel } from "./face-visualization";
import { useRouter } from "next/navigation";
import { classifyPotential, classifyPSL, formatScore } from "@/lib/score-classification";
import { useAnalysisSession } from "./analysis-session";

const regions = [
  ["eyes", "Olhos"], ["eyebrows", "Sobrancelhas"], ["nose", "Nariz"],
  ["lips", "Lábios"], ["jawline", "Mandíbula"], ["chin", "Queixo"],
  ["cheekbones", "Maçãs do rosto"], ["skin", "Pele"], ["hair", "Cabelo"],
  ["harmony", "Harmonia facial"],
] as const;

const focus = "blue-focus";

export function AnalysisResults() {
  const { report, photoUrl, visualization, clearAnalysis } = useAnalysisSession();
  const [showVisualization, setShowVisualization] = useState(false);
  const router = useRouter();

  function startAgain() {
    clearAnalysis();
    router.replace("/");
  }

  return (
    <main className="app-surface min-h-svh px-5 pb-10 sm:px-8">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-blue-200/8 py-6">
        <Link href="/" onClick={clearAnalysis} className={`rounded text-sm font-semibold tracking-tight text-slate-200 ${focus}`}>
          Chad<span className="text-blue-300">Score.</span>
        </Link>
        <span className="text-[10px] tracking-widest text-slate-400 uppercase">Local · MediaPipe</span>
      </header>

      {!report ? (
        <section className="mx-auto max-w-md py-24 text-center">
          <h1 className="text-2xl font-medium tracking-tight">Nenhum relatório nesta sessão</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">O resultado e a miniatura são descartados ao atualizar ou fechar a página.</p>
          <Link href="/" className={`primary-button mt-7 inline-block rounded-xl px-5 py-3 text-sm font-medium ${focus}`}>Escolher uma selfie</Link>
        </section>
      ) : (
        <div className="mx-auto max-w-4xl py-10 sm:py-14">
          <div className="flex items-center gap-5">
            {photoUrl && (
              // URL blob local: sem otimização no servidor ou envio da foto.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Miniatura da selfie analisada" width={72} height={88} className="h-22 w-18 shrink-0 rounded-2xl border border-blue-200/15 object-cover shadow-lg shadow-blue-950/20" />
            )}
            <div>
              <p className="text-[10px] tracking-[0.2em] text-blue-300 uppercase">ChadScore</p>
              <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">Seu resultado</h1>
            </div>
          </div>

          {photoUrl && visualization && (
            <div className="mt-7">
              <button type="button" aria-expanded={showVisualization} aria-controls="facial-visualization" onClick={() => setShowVisualization(!showVisualization)} className="primary-button blue-focus cursor-pointer rounded-xl px-5 py-3 text-xs font-medium">
                Visualizar análise facial
              </button>
              {showVisualization && <FaceVisualizationPanel photoUrl={photoUrl} data={visualization} />}
            </div>
          )}

          <dl className="mt-9 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
            <div className="glass-card p-5 sm:p-6">
              <dt className="text-xs text-slate-400">Classificação PSL</dt>
              <dd data-testid="psl-classification" className="mt-4 text-2xl font-medium tracking-tight text-blue-300 sm:text-3xl">{classifyPSL(report.score)}</dd>
            </div>
            <div className="glass-card p-5 sm:p-6">
              <dt className="text-xs text-slate-400">Potencial</dt>
              <dd className="mt-4 flex items-baseline gap-1.5" aria-describedby="potential-note">
                <span data-testid="potential-score" className={`text-3xl font-medium tracking-tight tabular-nums ${report.potential === null ? "text-slate-500" : "text-blue-300"}`}>{formatScore(report.potential)}</span>
                {report.potential !== null && <span className="text-[10px] text-slate-400">/ 10,0</span>}
              </dd>
              <dd data-testid="potential-label" className="mt-1.5 text-xs text-slate-400">{classifyPotential(report.potential)}</dd>
            </div>
            <div className="glass-card glass-card--accent col-span-2 p-5 sm:col-span-1 sm:p-6">
              <dt className="text-xs text-slate-400">Nota geral unificada</dt>
              <dd className="mt-3 flex items-baseline gap-2">
                <span data-testid="overall-score" className="text-5xl font-semibold tracking-[-0.045em] text-blue-300 tabular-nums">{formatScore(report.score)}</span>
                {report.score !== null && <span className="text-xs text-slate-400">/ 10,0</span>}
              </dd>
            </div>
          </dl>
          <p id="potential-note" className="mt-4 max-w-xl text-[11px] leading-relaxed text-slate-400">
            {report.potentialRange
              ? `Potencial: cenário superior de captura (variação ${formatScore(report.potentialRange.lower)}–${formatScore(report.potentialRange.upper)}). A nota pode subir ou cair; não garante melhoria nem prevê beleza futura.`
              : "Potencial não estimado: faltam dados confiáveis de luz ou pose. Não é uma previsão de beleza futura."}
          </p>

          <section aria-labelledby="regions-heading" className="mt-10">
            <h2 id="regions-heading" className="text-sm font-medium text-slate-300">Notas por região facial</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {regions.map(([key, name]) => (
                <article key={key} aria-label={name} className="glass-card flex min-h-28 flex-col justify-between gap-5 p-4 sm:p-5">
                  <h3 className="text-xs leading-relaxed text-slate-400">{name}</h3>
                  <p className={`text-2xl font-medium tracking-tight tabular-nums ${report.regions[key] === null ? "text-slate-500" : "text-blue-200"}`} aria-label={`${name}: ${report.regions[key] === null ? "não avaliado" : formatScore(report.regions[key])}`}>
                    {formatScore(report.regions[key])}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <footer className="mt-6 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <p className="max-w-lg text-[11px] leading-relaxed text-slate-400">
              Notas subjetivas, não uma medida científica de beleza. Pele e cabelo: apresentação na foto, não saúde ou cor natural. PSL usa apenas geometria. — Captura ou região sem confiança suficiente.
            </p>
            <button type="button" onClick={startAgain} className={`primary-button shrink-0 cursor-pointer rounded-xl px-4 py-3 text-xs font-medium transition-colors ${focus}`}>
              Nova análise
            </button>
          </footer>
        </div>
      )}
    </main>
  );
}
