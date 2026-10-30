"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateSelfieFile } from "@/lib/selfie";

export type BattlePhoto = { file: File; url: string };

/** Owns one temporary URL and guards against late decode/unmount races. */
export function useBattlePhoto(onChange: (previous?: File) => void) {
  const [photo, setPhoto] = useState<BattlePhoto | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<BattlePhoto | null>(null);
  const operation = useRef(0);
  const dispose = useCallback(() => {
    if (current.current) URL.revokeObjectURL(current.current.url);
    current.current = null;
  }, []);
  useEffect(() => () => { operation.current++; dispose(); }, [dispose]);

  function remove() {
    operation.current++;
    onChange(current.current?.file);
    dispose(); setPhoto(null); setValidating(false); setError("");
  }
  async function select(file: File) {
    const id = ++operation.current;
    onChange(current.current?.file);
    dispose(); setPhoto(null); setError(""); setValidating(true);
    try {
      await validateSelfieFile(file);
      if (id !== operation.current) return;
      const next = { file, url: URL.createObjectURL(file) };
      current.current = next; setPhoto(next);
    } catch (cause) {
      if (id === operation.current) setError(cause instanceof Error ? cause.message : "Não foi possível abrir a foto.");
    } finally { if (id === operation.current) setValidating(false); }
  }
  return { photo, validating, error, select, remove };
}
