import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AnalysisSessionProvider } from "@/components/analysis-session";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "ChadScore",
  description: "ChadScore — indicadores faciais 2D gratuitos com MediaPipe, processados apenas no seu navegador.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={manrope.variable} data-build={process.env.NEXT_PUBLIC_BUILD_SHA} data-calibration="2">
      <body className="antialiased">
        <AnalysisSessionProvider>{children}</AnalysisSessionProvider>
      </body>
    </html>
  );
}
