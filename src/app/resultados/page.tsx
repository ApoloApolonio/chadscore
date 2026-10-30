import type { Metadata } from "next";
import { AnalysisResults } from "@/components/analysis-results";

export const metadata: Metadata = {
  title: "Seu relatório | ChadScore",
  robots: { index: false, follow: false },
};

export default function ResultsPage() {
  return <AnalysisResults />;
}
