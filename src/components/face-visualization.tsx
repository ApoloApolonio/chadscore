"use client";

import { useState } from "react";
import type { FaceVisualization } from "@/lib/analysis-schema";
import { FACE_REGIONS } from "@/lib/face-overlay";
import { FaceLandmarkPortrait } from "./face-landmark-portrait";

export function FaceVisualizationPanel({ photoUrl, data }: { photoUrl: string; data: FaceVisualization }) {
  const [visible, setVisible] = useState(true);
  const [region, setRegion] = useState("all");
  const [expanded, setExpanded] = useState(false);

  return (
    <section id="facial-visualization" aria-labelledby="visualization-heading" className="result-bubble facial-panel text-center">
      <h2 id="visualization-heading" className="sr-only">Geometria do seu rosto</h2>
      <div className="portrait-frame">
        <FaceLandmarkPortrait photoUrl={photoUrl} data={data} visible={visible} region={region} />
      </div>
      <div className="portrait-controls">
        <button type="button" aria-pressed={visible} onClick={() => setVisible(!visible)} className="blue-focus subtle-control">{visible ? "Desativar pontos" : "Ativar pontos"}</button>
        <button type="button" aria-expanded={expanded} aria-controls="region-controls" onClick={() => setExpanded(!expanded)} className="blue-focus subtle-control">Visualizar análise facial</button>
      </div>
      <fieldset id="region-controls" hidden={!expanded} className="mt-4 flex flex-wrap justify-center gap-2">
        <legend className="mb-2 text-[11px] text-slate-400">Destacar região</legend>
        {[{ key: "all", label: "Todas" }, ...FACE_REGIONS].map(({ key, label }) => (
          <button key={key} type="button" aria-pressed={region === key} onClick={() => setRegion(key)} className={`blue-focus cursor-pointer rounded-full border px-3 py-2 text-[11px] transition-colors ${region === key ? "border-blue-300/40 bg-blue-300/15 text-blue-100" : "border-blue-200/10 text-slate-400 hover:text-blue-200"}`}>
            {label}
          </button>
        ))}
      </fieldset>
    </section>
  );
}
