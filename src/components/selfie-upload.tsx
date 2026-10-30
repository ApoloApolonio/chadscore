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
  const { setReport } = useAnalysisSession();
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
    setReport(null);
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
    setReport(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await faceAnalysisProvider.analyze(selection.file, consent, controller.signal);
      if (currentOperation === operation.current) {
        setReport(result.report);
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
    <form onSubmit={handleAnalyze} className="mt-10 w-full max-w-md">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <label htmlFor="selfie" className="block text-sm font-medium text-zinc-100">
          {selection ? "Trocar selfie" : "Escolher selfie"}
        </label>
        <p id="selfie-help" className="mt-2 text-xs leading-relaxed text-zinc-400">
          JPG, PNG ou WebP · Até 5 MB.
          <br />
          Prefira uma foto de frente, com boa iluminação e apenas você.
        </p>
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
          className="mt-5 block w-full min-w-0 rounded-lg border border-zinc-700 p-2 text-xs text-zinc-400 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-zinc-100 hover:file:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300 disabled:opacity-50"
        />

        {selection && (
          <div className="mt-5">
            {/* URL local e temporária; não passa pelo otimizador de imagens do servidor. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selection.url}
              alt="Pré-visualização da selfie selecionada"
              className="mx-auto h-64 w-full rounded-xl bg-zinc-950 object-contain"
            />
            <p className="mt-3 break-all text-xs text-zinc-400">
              {selection.file.name}
            </p>
            <button
              type="button"
              onClick={removeSelfie}
              className="mt-3 rounded px-2 py-1 text-xs text-zinc-300 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300"
            >
              Remover foto
            </button>
          </div>
        )}

        <p id="selfie-error" role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
        <p className="mt-3 text-left text-xs leading-relaxed text-zinc-400">
          {ESTIMATE_NOTICE}
        </p>
        <label className="mt-5 flex items-start gap-3 text-left text-xs leading-relaxed text-zinc-300">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            disabled={!selection || isAnalyzing}
            required
            aria-describedby="selfie-privacy"
            className="mt-0.5 size-4 shrink-0 accent-lime-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300"
          />
          <span>
            Tenho 18 anos ou mais, esta selfie é minha e concordo com o
            processamento somente neste navegador. Entendo que os indicadores e a
            nota são limitados e não medem beleza científica.
          </span>
        </label>
        <button
          type="submit"
          disabled={!selection || !consent || isValidating || isAnalyzing}
          aria-describedby="analysis-status"
          className="mt-3 w-full rounded-xl bg-lime-300 px-7 py-4 text-sm font-semibold text-zinc-950 transition-colors enabled:cursor-pointer enabled:hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="mt-4 text-xs leading-relaxed text-zinc-400"
        >
          {isValidating
            ? "Verificando se a imagem pode ser aberta…"
            : isAnalyzing
              ? "Carregando o modelo local e detectando pontos faciais. Isso pode levar alguns segundos…"
              : "Grátis e local: nenhuma foto é enviada. Clique para iniciar o MediaPipe."}
        </p>
      </div>
      <p id="selfie-privacy" className="mt-4 text-xs leading-relaxed text-zinc-500">
        Sua foto e os pontos faciais ficam somente na memória deste navegador,
        sem envio a servidores ou armazenamento. O navegador baixa apenas os
        arquivos estáticos do modelo na mesma origem do site. Remover a foto
        interrompe o processamento. O relatório também fica apenas na memória
        desta aba e é descartado ao atualizar ou fechar a página.
      </p>
    </form>
  );
}
