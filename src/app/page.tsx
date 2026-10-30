import { ScanModes } from "@/components/scan-modes";

export default function Home() {
  return (
    <main className="home-surface flex min-h-svh flex-col px-5 sm:px-8">
      <header className="brand-header">
        <h1 className="brand">ChadScore<span>.</span></h1>
      </header>
      <ScanModes />
    </main>
  );
}
