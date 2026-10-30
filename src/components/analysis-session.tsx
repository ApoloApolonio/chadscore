"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { FaceReport } from "@/lib/analysis-schema";

type Session = { report: FaceReport; photoUrl: string };
const AnalysisContext = createContext<{
  report: FaceReport | null;
  photoUrl: string | null;
  completeAnalysis: (report: FaceReport, photo: File) => void;
  clearAnalysis: () => void;
} | null>(null);

/** Miniatura e relatório somente em memória, sem Web Storage, upload ou persistência. */
export function AnalysisSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const photoRef = useRef<string | null>(null);

  const clearAnalysis = useCallback(() => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    photoRef.current = null;
    setSession(null);
  }, []);

  const completeAnalysis = useCallback((report: FaceReport, photo: File) => {
    const photoUrl = URL.createObjectURL(photo);
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    photoRef.current = photoUrl;
    setSession({ report, photoUrl });
  }, []);

  useEffect(() => () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
  }, []);

  return (
    <AnalysisContext.Provider value={{
      report: session?.report ?? null,
      photoUrl: session?.photoUrl ?? null,
      completeAnalysis,
      clearAnalysis,
    }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisSession() {
  const context = useContext(AnalysisContext);
  if (!context) throw new Error("AnalysisSessionProvider não encontrado");
  return context;
}
