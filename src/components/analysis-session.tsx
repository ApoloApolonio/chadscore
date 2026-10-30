"use client";

import { createContext, useContext, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { FaceReport } from "@/lib/analysis-schema";

const AnalysisContext = createContext<{
  report: FaceReport | null;
  setReport: Dispatch<SetStateAction<FaceReport | null>>;
} | null>(null);

/** Somente relatório em memória; nunca guarda a imagem ou usa Web Storage. */
export function AnalysisSessionProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<FaceReport | null>(null);
  return <AnalysisContext.Provider value={{ report, setReport }}>{children}</AnalysisContext.Provider>;
}

export function useAnalysisSession() {
  const context = useContext(AnalysisContext);
  if (!context) throw new Error("AnalysisSessionProvider não encontrado");
  return context;
}
