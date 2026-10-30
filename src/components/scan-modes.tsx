"use client";

import { useState } from "react";
import { SelfieUpload } from "./selfie-upload";
import { MogBattle } from "./mogbattle";
import { useAnalysisSession } from "./analysis-session";

export function ScanModes() {
  const [mode, setMode] = useState<"FaceScan" | "MogBattle">("FaceScan");
  const { clearAnalysis } = useAnalysisSession();
  return <>
    <div className="mode-selector" role="group" aria-label="Modo de análise">
      {(["FaceScan", "MogBattle"] as const).map((item) => <button key={item} type="button" aria-pressed={mode === item} aria-controls="scan-mode-panel" className="blue-focus" onClick={() => { if (mode !== item) { clearAnalysis(); setMode(item); } }}>{item}</button>)}
    </div>
    <section id="scan-mode-panel" aria-label={mode === "FaceScan" ? "Sua análise facial" : "MogBattle"} className={`home-layout mx-auto w-full pb-10 sm:pb-14 ${mode === "FaceScan" ? "max-w-xl" : "max-w-4xl"}`}>
      {mode === "FaceScan" ? <SelfieUpload /> : <MogBattle />}
    </section>
  </>;
}
