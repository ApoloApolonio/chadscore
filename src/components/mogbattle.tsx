"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeBattlePhotos, type BattleAnalysisCache } from "@/lib/battle-analysis";
import { compareBattleScores } from "@/lib/mogbattle";
import { BattleParticipant } from "./battle-participant";
import { BattleResult, type BattleResultData } from "./battle-result";
import { useBattlePhoto } from "./use-battle-photo";

export function MogBattle() {
  const [names, setNames] = useState<[string, string]>(["", ""]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<0 | 1>(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BattleResultData | null>(null);
  const cache = useRef<BattleAnalysisCache>(new WeakMap());
  const controller = useRef<AbortController | null>(null);
  const run = useRef(0);
  const firstField = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);
  const invalidate = useCallback((previous?: File) => {
    run.current++;
    controller.current?.abort();
    if (previous) cache.current.delete(previous);
    setResult(null); setError(""); setAnalyzing(false);
  }, []);
  const first = useBattlePhoto(invalidate), second = useBattlePhoto(invalidate);
  useEffect(() => () => { run.current++; controller.current?.abort(); cache.current = new WeakMap(); }, []);
  useEffect(() => {
    if (!result && returning.current) { returning.current = false; firstField.current?.focus(); }
  }, [result]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (!first.photo || !second.photo || analyzing || first.validating || second.validating) return;
    const id = ++run.current;
    const photos = [first.photo, second.photo] as const;
    const labels = names.map((name, index) => name.trim().slice(0, 40) || `Participante ${index + 1}`);
    const abort = new AbortController();
    controller.current = abort;
    setAnalyzing(true); setError("");
    try {
      const responses = await analyzeBattlePhotos([photos[0].file, photos[1].file], { signal: abort.signal, cache: cache.current, onProgress: setProgress });
      if (id !== run.current) return;
      const outcome = compareBattleScores(responses[0].report.score, responses[1].report.score);
      if (outcome.status === "unavailable") {
        const missing = responses[0].report.score === null ? 0 : 1;
        throw new Error(`${labels[missing]}: nota geral sem confiança suficiente. Troque essa foto por uma captura frontal. Nenhum vencedor foi declarado.`);
      }
      setResult({ outcome, entries: [
        { name: labels[0], photoUrl: photos[0].url, analysis: responses[0] },
        { name: labels[1], photoUrl: photos[1].url, analysis: responses[1] },
      ] });
    } catch (cause) {
      if (id === run.current && !abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível concluir as duas análises. Nenhum vencedor foi declarado.");
    } finally { if (id === run.current) setAnalyzing(false); }
  }

  function again() {
    returning.current = true;
    first.remove(); second.remove();
    cache.current = new WeakMap(); setNames(["", ""]);
  }

  if (result) return <BattleResult data={result} onAgain={again} />;
  return <form onSubmit={start} aria-label="Preparar MogBattle" className="battle-setup" aria-busy={analyzing}>
    <h1 className="sr-only" ref={firstField} tabIndex={-1}>Preparar MogBattle</h1>
    <div className="battle-setup-grid">
      {([first, second] as const).map((draft, index) => <BattleParticipant key={index} index={index as 0 | 1} name={names[index]} onName={(name) => setNames((current) => index === 0 ? [name, current[1]] : [current[0], name])} draft={draft} disabled={analyzing} />)}
    </div>
    <div className="result-bubble battle-start">
      <button type="submit" className="primary-button blue-focus" disabled={analyzing || !first.photo || !second.photo || first.validating || second.validating}>{analyzing ? "Analisando…" : "Iniciar batalha"}</button>
      <p role="status" className="battle-progress">{analyzing ? `Analisando participante ${progress + 1} de 2…` : ""}</p>
      {error && <p role="alert" className="battle-error">{error}</p>}
      <p className="battle-fineprint">Fotos e nomes apenas na memória desta aba. Sem upload. Comparação estética subjetiva, não científica.</p>
      {analyzing && <button type="button" className="blue-focus subtle-control" onClick={() => { run.current++; controller.current?.abort(); setAnalyzing(false); setError(""); }}>Cancelar análise</button>}
    </div>
  </form>;
}
