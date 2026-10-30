import { SelfieUpload } from "@/components/selfie-upload";

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col bg-zinc-950 px-6">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-8">
        <span className="text-lg font-bold tracking-tight">
          Chad<span className="text-lime-300">Score</span>
        </span>
        <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
          Em desenvolvimento
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center py-20 text-center">
        <span className="mb-8 rounded-full border border-lime-300/20 bg-lime-300/5 px-4 py-2 text-xs font-medium tracking-widest text-lime-300 uppercase">
          Uma nova perspectiva sobre você
        </span>
        <h1 className="text-6xl font-bold tracking-tighter sm:text-8xl">
          Chad<span className="text-lime-300">Score</span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-zinc-400 sm:text-lg">
          Descubra um novo olhar sobre o seu rosto.
          <br />
          Escolha uma selfie para preparar sua análise.
        </p>
        <SelfieUpload />
      </section>

      <footer className="mx-auto w-full max-w-6xl border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-500">
        ChadScore · Apenas o começo.
      </footer>
    </main>
  );
}
