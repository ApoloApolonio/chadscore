import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-surface min-h-svh px-5 text-center">
      <header className="brand-header"><Link href="/" className="brand blue-focus">ChadScore<span>.</span></Link></header>
      <section className="mx-auto max-w-sm py-24">
        <p className="text-xs tracking-[.2em] text-slate-400">404</p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight">Página não encontrada</h1>
        <Link href="/" className="primary-button blue-focus mt-8 inline-block rounded-full px-6 py-3 text-sm font-medium">Voltar ao início</Link>
      </section>
    </main>
  );
}
