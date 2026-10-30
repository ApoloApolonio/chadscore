import { SelfieUpload } from "@/components/selfie-upload";

export default function Home() {
  return (
    <main className="app-surface flex min-h-svh flex-col px-5 sm:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-b border-blue-200/8 py-6">
        <span className="text-lg font-semibold tracking-tight">Chad<span className="text-blue-300">Score.</span></span>
        <span className="rounded-full border border-blue-200/10 bg-blue-300/3 px-3 py-1.5 text-[10px] tracking-wide text-slate-400 sm:text-xs">
          MediaPipe · 100% local
        </span>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-20">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.22em] text-blue-300 uppercase sm:text-xs">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-blue-300 shadow-[0_0_12px_#60a5fa66]" />
            Uma nova perspectiva sobre você
          </p>
          <h1 className="mt-6 text-6xl font-semibold leading-[1.1] tracking-[-0.055em] sm:text-7xl xl:text-8xl">Chad<span className="text-blue-300">Score</span></h1>
          <h2 className="mt-6 text-3xl font-medium leading-tight tracking-tight text-slate-200 sm:text-4xl">
            Uma selfie.<br /><span className="text-slate-500">Um novo olhar.</span>
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-400 sm:text-base">
            Explore a apresentação do seu rosto com uma análise gratuita, direto no seu navegador. Sua foto fica com você.
          </p>
          <a href="#selfie-panel" className="primary-button blue-focus mt-7 inline-flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold">
            Escolher minha selfie <span aria-hidden="true">↗</span>
          </a>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-blue-200/8 pt-5 text-[11px] text-slate-400">
            <span>Sem upload</span><span>Sem cadastro</span><span>Sem API paga</span>
          </div>
        </div>

        <div className="min-w-0">
          <SelfieUpload />
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-3 border-t border-blue-200/8 py-6 text-[10px] text-slate-500">
        <span>ChadScore · Mais perspectiva, menos rótulos.</span>
        <span>Índices subjetivos. Não medem beleza científica.</span>
      </footer>
    </main>
  );
}
