"use client";

import { useState } from "react";
import type { FaceVisualization } from "@/lib/analysis-schema";
import { FACE_REGIONS, overlayPoint } from "@/lib/face-overlay";

export function FaceVisualizationPanel({ photoUrl, data }: { photoUrl: string; data: FaceVisualization }) {
  const [visible, setVisible] = useState(true);
  const [region, setRegion] = useState("all");
  const { width, height, landmarks } = data;
  const points = landmarks.map((point) => overlayPoint(point, width, height));
  const selected = FACE_REGIONS.filter(({ key }) => region === "all" || region === key);
  const highlighted = new Set(selected.flatMap(({ edges }) => edges.flatMap(([a, b]) => [a, b])));

  return (
    <section id="facial-visualization" aria-labelledby="visualization-heading" className="glass-card facial-panel mt-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="visualization-heading" className="text-sm font-medium text-blue-100">Geometria do seu rosto</h2>
          <p className="mt-1 text-xs text-slate-400">Os mesmos pontos da análise, sem novo processamento.</p>
        </div>
        <button type="button" aria-pressed={visible} onClick={() => setVisible(!visible)} className="blue-focus cursor-pointer rounded-xl border border-blue-200/20 bg-blue-300/8 px-4 py-2 text-xs text-blue-200">
          {visible ? "Desativar pontos" : "Ativar pontos"}
        </button>
      </div>
      <fieldset className="mt-5 flex flex-wrap gap-2">
        <legend className="mb-2 text-[11px] text-slate-400">Destacar região</legend>
        {[{ key: "all", label: "Todas" }, ...FACE_REGIONS].map(({ key, label }) => (
          <button key={key} type="button" aria-pressed={region === key} onClick={() => setRegion(key)} className={`blue-focus cursor-pointer rounded-full border px-3 py-2 text-[11px] transition-colors ${region === key ? "border-blue-300/40 bg-blue-300/15 text-blue-100" : "border-blue-200/10 text-slate-400 hover:text-blue-200"}`}>
            {label}
          </button>
        ))}
      </fieldset>
      <div className="mt-5 overflow-hidden rounded-2xl border border-blue-200/10 bg-slate-950/50">
        <svg data-testid="face-overlay" role="img" aria-label="Selfie original com geometria facial detectada" aria-describedby="geometry-notice" viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="mx-auto block h-auto max-h-[70svh] w-full" style={{ aspectRatio: `${width} / ${height}` }}>
          <title>Selfie original e pontos faciais do MediaPipe</title>
          {/* Image and coordinates share ONE transform: no crop, mirror, or separate object-fit. */}
          <image href={photoUrl} width={width} height={height} preserveAspectRatio="none" style={{ imageOrientation: "from-image" }} />
          <g data-testid="landmark-layer" aria-hidden="true" className={`facial-landmarks ${visible ? "" : "facial-landmarks--hidden"}`}>
            {selected.map(({ key, edges }) => (
              <g key={key} data-region={key} fill="none" stroke="#80beff" strokeWidth={region === "all" ? 0.8 : 1.2} strokeOpacity={0.85}>
                {edges.map(([a, b]) => points[a] && points[b] ? (
                  <line key={`${a}-${b}`} x1={points[a]!.x} y1={points[a]!.y} x2={points[b]!.x} y2={points[b]!.y} vectorEffect="non-scaling-stroke" />
                ) : null)}
              </g>
            ))}
            {points.map((point, index) => point && (region === "all" || highlighted.has(index)) ? (
              <circle key={index} data-landmark={index} cx={point.x} cy={point.y} r={Math.max(width, height) * (highlighted.has(index) ? 0.0025 : 0.0015)} fill={highlighted.has(index) ? "#b5dcff" : "#60a5fa"} opacity={highlighted.has(index) ? 1 : 0.5} />
            ) : null)}
          </g>
        </svg>
      </div>
      <p id="geometry-notice" className="mt-4 text-[11px] leading-relaxed text-slate-400">Os pontos representam geometria facial nesta foto, não beleza objetiva. Foto e pontos ficam apenas na memória desta aba, sem envio ou armazenamento persistente.</p>
    </section>
  );
}
