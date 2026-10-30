"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAnalysisSession } from "./analysis-session";
import { ESTIMATE_NOTICE } from "@/lib/analysis-schema";
import { faceAnalysisProvider } from "@/lib/face-analysis";
import { SELFIE_ACCEPT, validateSelfieFile } from "@/lib/selfie";

type Selection = { file: File; url: string };

export function SelfieUpload() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const router = useRouter();
  const { completeAnalysis, clearAnalysis } = useAnalysisSession();
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const operation = useRef(0);

  useEffect(() => {
    return () => {
      operation.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selection) URL.revokeObjectURL(selection.url);
    };
  }, [selection]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite selecionar novamente o mesmo arquivo, inclusive após um erro.
    event.target.value = "";
    if (!file) return;

    const currentOperation = ++operation.current;
    setSelection(null);
    setError("");
    setConsent(false);
    clearAnalysis();
    setIsValidating(true);
    setIsAnalyzing(false);

    try {
      await validateSelfieFile(file);
      if (currentOperation !== operation.current) return;
      setSelection({ file, url: URL.createObjectURL(file) });
    } catch (cause) {
      if (currentOperation !== operation.current) return;
      setError(
        cause instanceof Error ? cause.message : "Não foi possível abrir a imagem.",
      );
    } finally {
      if (currentOperation === operation.current) setIsValidating(false);
    }
  }

  function removeSelfie() {
    operation.current += 1;
    abortRef.current?.abort();
    setSelection(null);
    setError("");
    setConsent(false);
    setIsValidating(false);
    setIsAnalyzing(false);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || !consent || isValidating || isAnalyzing) return;

    const currentOperation = ++operation.current;
    setIsAnalyzing(true);
    setError("");
    clearAnalysis();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await faceAnalysisProvider.analyze(selection.file, consent, controller.signal);
      if (currentOperation === operation.current) {
        completeAnalysis(result.report, selection.file);
        setSelection(null);
        setConsent(false);
        router.push("/resultados");
      }
    } catch (cause) {
      if (currentOperation === operation.current) {
        setError(cause instanceof Error && cause.name === "TimeoutError"
          ? "A análise demorou demais. Tente novamente."
          : cause instanceof Error && cause.name !== "AbortError"
            ? cause.message
            : "A análise foi cancelada.");
      }
    } finally {
      if (currentOperation === operation.current) setIsAnalyzing(false);
    }
  }

  return (
    <form id="selfie-panel" onSubmit={handleAnalyze} className="w-full scroll-mt-8">
      <div className="glass-card p-5 sm:p-7">
        <p className="text-[10px] tracking-[0.2em] text-blue-300 uppercase">Comece por aqui</p>
        <h2 className="mt-2 text-xl font-medium tracking-tight text-slate-100">Sua selfie, seu controle.</h2>
        <input
          ref={inputRef}
          id="selfie"
          name="selfie"
          type="file"
          accept={SELFIE_ACCEPT}
          onChange={handleFileChange}
          disabled={isAnalyzing}
          aria-describedby="selfie-help selfie-privacy selfie-error"
          aria-invalid={Boolean(error)}
          className="peer sr-only"
        />
        <label htmlFor="selfie" className={`mt-5 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-blue-300/25 bg-blue-300/3 px-4 text-center text-sm font-medium text-blue-200 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-blue-300 ${selection ? "min-h-24" : "min-h-40"} ${isAnalyzing ? "cursor-wait opacity-50" : "cursor-pointer hover:border-blue-300/50 hover:bg-blue-300/6"}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-7 text-blue-300">
            <path d="M12 16V4m-4 4 4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
          </svg>
          {selection ? "Trocar selfie" : "Escolher selfie"}
        </label>
        <p id="selfie-help" className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
          JPG, PNG ou WebP · Até 5 MB.<br />
          De frente, com boa luz e apenas você.
        </p>

        {selection && (
          <div className="mt-5">
            {/* URL local e temporária; não passa pelo otimizador de imagens do servidor. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selection.url}
              alt="Pré-visualização da selfie selecionada"
              className="mx-auto h-56 w-full rounded-2xl border border-blue-200/10 bg-slate-950/60 object-contain"
            />
            <p className="mt-3 break-all text-xs text-slate-400">
              {selection.file.name}
            </p>
            <button
              type="button"
              onClick={removeSelfie}
              className="blue-focus mt-3 rounded px-2 py-1 text-xs text-blue-200 underline underline-offset-4 hover:text-blue-100"
            >
              Remover foto
            </button>
          </div>
        )}

        <p id="selfie-error" role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
        <details className="mt-4 border-t border-blue-200/8 pt-4 text-xs text-slate-400">
          <summary className="blue-focus w-fit cursor-pointer rounded text-blue-200">Como interpretar as notas</summary>
          <p className="mt-3 leading-relaxed">{ESTIMATE_NOTICE}</p>
        </details>
        <label className="mt-5 flex items-start gap-3 text-left text-xs leading-relaxed text-slate-300">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            disabled={!selection || isAnalyzing}
            required
            aria-describedby="selfie-privacy"
            className="blue-focus mt-0.5 size-4 shrink-0 accent-blue-400"
          />
          <span>
            Tenho 18 anos ou mais, esta selfie é minha e autorizo a análise local.
            Entendo que as notas são subjetivas, não científicas.
          </span>
        </label>
        <button
          type="submit"
          disabled={!selection || !consent || isValidating || isAnalyzing}
          aria-describedby="analysis-status"
          className="primary-button blue-focus mt-5 w-full rounded-xl px-7 py-4 text-sm font-semibold transition-colors enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isValidating
            ? "Validando imagem…"
            : isAnalyzing
              ? "Analisando localmente…"
              : "Analisar meu rosto"}
        </button>
        <p
          id="analysis-status"
          role="status"
          className="mt-4 text-center text-[11px] leading-relaxed text-slate-400"
        >
          {isValidating
            ? "Verificando se a imagem pode ser aberta…"
            : isAnalyzing
              ? "Carregando o modelo local e detectando pontos faciais. Isso pode levar alguns segundos…"
              : "Gratuito. Sem envio da selfie. Processado neste navegador."}
        </p>
      </div>
      <p id="selfie-privacy" className="mt-4 px-1 text-[11px] leading-relaxed text-slate-400">
        Foto e resultados ficam só na memória desta aba, sem envio ou armazenamento.
        O navegador baixa apenas os modelos estáticos. Remover a foto cancela a análise;
        atualizar ou fechar a página descarta a sessão.
      </p>
    </form>
  );
}
