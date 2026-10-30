"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ESTIMATE_NOTICE } from "@/lib/analysis-schema";
import { useAnalysisSession } from "./analysis-session";

const sections = [
  ["symmetry", "Simetria facial aparente"],
  ["jawline", "Mandíbula"],
  ["eyes", "Olhos"],
  ["proportions", "Proporções visuais"],
] as const;

export function AnalysisResults() {
  const { report, setReport } = useAnalysisSession();
  const router = useRouter();

  function startAgain() {
    setReport(null);
    router.replace("/");
  }

  return (
    <main className="min-h-svh bg-zinc-950 px-6 pb-12">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-8">
        <Link href="/" onClick={() => setReport(null)} className="text-lg font-bold tracking-tight">
          Chad<span className="text-lime-300">Score</span>
        </Link>
        <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">MediaPipe · Local</span>
      </header>

      {!report ? (
        <section className="mx-auto max-w-xl py-24 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Nenhum relatório nesta sessão</h1>
          <p className="mt-5 leading-relaxed text-zinc-400">
            Para proteger sua privacidade, o relatório fica apenas na memória desta
            aba. Ao atualizar ou fechar a página, ele é descartado.
          </p>
          <Link href="/" className="mt-8 inline-block rounded-xl bg-lime-300 px-6 py-3 font-semibold text-zinc-950">
            Escolher uma selfie
          </Link>
        </section>
      ) : (
        <div className="mx-auto max-w-3xl py-10">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Um novo olhar, <span className="text-lime-300">não um veredito.</span></h1>
          <p className="mt-5 text-sm leading-relaxed text-zinc-400">{ESTIMATE_NOTICE}</p>

          <section aria-labelledby="score-heading" className="mt-8 rounded-2xl border border-lime-300/20 bg-lime-300/5 p-6 sm:p-8">
            <h2 id="score-heading" className="text-sm font-medium text-lime-300">Índice subjetivo de equilíbrio 2D</h2>
            <p className="mt-4 text-6xl font-bold tracking-tighter text-lime-300">
              {report.score}<span className="text-xl font-normal text-zinc-400"> / 100</span>
            </p>
            <p className="mt-5 leading-relaxed text-zinc-300">{report.summary}</p>
            <p className="mt-4 text-xs text-zinc-400">Não é uma nota de beleza, percentil ou ranking entre pessoas. Um índice de 100 só indica equilíbrio nos critérios escolhidos.</p>
          </section>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {sections.map(([key, title]) => (
              <section key={key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                <h2 className="font-semibold text-lime-300">{title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{report[key]}</p>
              </section>
            ))}
          </div>

          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold">Indicadores calculados</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Coordenadas normalizadas são convertidas em pixels para respeitar a
              proporção da foto. O eixo horizontal é alinhado pelos cantos externos
              dos olhos. Distâncias e larguras são apenas projeções 2D, sem unidades físicas.
            </p>
            <dl className="mt-5 space-y-5">
              {report.measurements.map((measurement) => (
                <div key={measurement.label}>
                  <dt className="text-sm text-zinc-300">{measurement.label}</dt>
                  <dd className="mt-1 font-semibold text-lime-300">
                    {measurement.value.toLocaleString("pt-BR", { maximumFractionDigits: measurement.unit === "%" ? 1 : 2 })}
                    {measurement.unit === "%" ? "%" : " (razão)"}
                  </dd>
                  <dd className="mt-1 text-xs leading-relaxed text-zinc-500">{measurement.method}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-6 rounded-2xl border border-lime-300/20 p-6">
            <h2 className="text-lg font-semibold">Como a pontuação é calculada</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Cada componente = 100 × máximo(0, 1 − erro/tolerância).
              Nota final = soma dos componentes × seus pesos, arredondada.
              Pesos e tolerâncias abaixo são escolhas subjetivas do projeto,
              não limites biológicos ou ideais de beleza. As outras proporções não entram na nota.
            </p>
            <ul className="mt-4 space-y-4 text-sm text-zinc-300">
              {report.scoreComponents.map((component) => (
                <li key={component.label}>
                  <p className="font-medium">{component.label} · peso {Math.round(component.weight * 100)}%</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Erro {(100 * component.error).toFixed(2)}% · tolerância {(100 * component.tolerance).toFixed(0)}% · componente {component.score.toFixed(1)}/100
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Na reflexão, o erro é normalizado pela largura facial. Nos olhos e no
              contorno mandibular, é a diferença absoluta dividida pelo maior dos dois comprimentos.
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold">Looksmaxing: estilo e autocuidado</h2>
            <p className="mt-2 text-xs text-zinc-400">Sugestões opcionais e não invasivas, sem promessas de mudança na nota.</p>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-zinc-300 marker:text-lime-300">
              {report.looksmaxing.map((suggestion, index) => <li key={index}>{suggestion}</li>)}
            </ul>
          </section>

          <section className="mt-6 rounded-2xl border border-zinc-800 p-6">
            <h2 className="font-semibold">Limitações desta análise</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
              {report.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}
            </ul>
          </section>

          <p className="mt-6 text-xs leading-relaxed text-zinc-500">
            Nenhuma foto foi incluída neste relatório. O resultado não é salvo pelo
            ChadScore e desaparecerá ao atualizar ou fechar a página.
          </p>
          <button type="button" onClick={startAgain} className="mt-6 cursor-pointer rounded-xl bg-lime-300 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300">
            Descartar relatório e voltar
          </button>
        </div>
      )}
    </main>
  );
}
