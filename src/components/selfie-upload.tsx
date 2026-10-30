"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAnalysisSession } from "./analysis-session";
import { faceAnalysisProvider } from "@/lib/face-analysis";
import { SELFIE_ACCEPT, validateSelfieFile } from "@/lib/selfie";
import { FaceIllustration } from "./face-illustration";
import { CameraCapture } from "./camera-capture";

type Selection = { file: File; url: string };

export function SelfieUpload() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const cameraButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { completeAnalysis, clearAnalysis } = useAnalysisSession();
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const operation = useRef(0);

  useEffect(() => () => {
    operation.current += 1;
    abortRef.current?.abort();
  }, []);

  useEffect(() => () => {
    if (selection) URL.revokeObjectURL(selection.url);
  }, [selection]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await selectFile(file);
  }

  async function selectFile(file: File) {
    const currentOperation = ++operation.current;
    abortRef.current?.abort();
    setSelection(null);
    setError("");
    clearAnalysis();
    setIsValidating(true);
    setIsAnalyzing(false);
    try {
      await validateSelfieFile(file);
      if (currentOperation !== operation.current) return;
      setSelection({ file, url: URL.createObjectURL(file) });
    } catch (cause) {
      if (currentOperation !== operation.current) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir a imagem.");
    } finally {
      if (currentOperation === operation.current) setIsValidating(false);
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || isValidating || isAnalyzing || showCamera) return;
    const currentOperation = ++operation.current;
    setIsAnalyzing(true);
    setError("");
    clearAnalysis();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Clicking Analyze is the explicit action that starts local inference.
      const result = await faceAnalysisProvider.analyze(selection.file, controller.signal);
      if (currentOperation === operation.current) {
        completeAnalysis(result.report, selection.file, result.visualization);
        setSelection(null);
        router.push("/resultados");
      }
    } catch (cause) {
      if (currentOperation === operation.current) {
        setError(cause instanceof Error && cause.name === "TimeoutError"
          ? "A análise demorou demais. Tente novamente."
          : cause instanceof Error && cause.name !== "AbortError" ? cause.message : "A análise foi cancelada.");
      }
    } finally {
      if (currentOperation === operation.current) setIsAnalyzing(false);
    }
  }

  return (
    <form id="selfie-panel" onSubmit={handleAnalyze} className="w-full text-center" aria-label="Preparar selfie para análise" aria-busy={isAnalyzing || isValidating}>
      <input ref={inputRef} id="selfie" name="selfie" type="file" accept={SELFIE_ACCEPT} onChange={handleFileChange} disabled={isAnalyzing || isValidating} aria-label={selection ? "Trocar selfie" : "Escolher selfie"} hidden />
      <div className="result-bubble home-card home-face-card">
        <div className="face-trigger relative mx-auto aspect-square w-full max-w-[320px]">
          {selection ? (
            // URL local, sem otimização no servidor ou envio da foto.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selection.url} alt="Pré-visualização da selfie selecionada" className="h-full w-full rounded-full border border-white/10 object-cover" />
          ) : <FaceIllustration />}
        </div>
      </div>
      <div className="result-bubble home-card home-actions-card">
        <div id="photo-choices" className="grid grid-cols-2 gap-3">
          <button ref={cameraButton} type="button" disabled={isAnalyzing || isValidating} onClick={() => setShowCamera(true)} className="blue-focus photo-choice rounded-full px-4 py-3.5 text-xs text-blue-100 disabled:opacity-40">Tirar foto</button>
          <button type="button" disabled={isAnalyzing || isValidating} onClick={() => inputRef.current?.click()} className="blue-focus photo-choice rounded-full px-4 py-3.5 text-xs text-blue-100 disabled:opacity-40">Selecionar foto</button>
        </div>
        <button type="submit" disabled={!selection || isValidating || isAnalyzing || showCamera} aria-describedby="analysis-status" className="primary-button blue-focus mt-3 w-full rounded-full px-7 py-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30">
          {isValidating ? "Validando imagem…" : isAnalyzing ? "Analisando…" : "Analisar rosto"}
        </button>
        <p id="analysis-status" role="status" className="sr-only">{isValidating ? "Validando imagem" : isAnalyzing ? "Análise em andamento" : selection ? "Foto válida, pronta para analisar" : ""}</p>
        {error && <p id="selfie-error" role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      </div>
      {showCamera && <CameraCapture onCapture={(file) => { void selectFile(file); }} onClose={() => { setShowCamera(false); cameraButton.current?.focus(); }} onSelect={() => { setShowCamera(false); inputRef.current?.click(); }} />}
    </form>
  );
}
