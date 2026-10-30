import type { Metadata } from "next";
import { AnalysisSessionProvider } from "@/components/analysis-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChadScore",
  description: "ChadScore — indicadores faciais 2D gratuitos com MediaPipe, processados apenas no seu navegador.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <AnalysisSessionProvider>{children}</AnalysisSessionProvider>
      </body>
    </html>
  );
}
