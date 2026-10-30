import type { Metadata } from "next";

/**
 * Ícone oficial do ChadScore: rosto, círculo azul e fundo preto.
 * Arquivos gerados por `npm run prepare:icons` a partir de `assets/chadscore-icon.png`.
 */
export const siteIcons = {
  icon: [
    { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
    { url: "/icons/icon-16.png", type: "image/png", sizes: "16x16" },
    { url: "/icons/icon-32.png", type: "image/png", sizes: "32x32" },
    { url: "/icons/icon-48.png", type: "image/png", sizes: "48x48" },
    { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
  ],
  shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
  apple: [{ url: "/icons/icon-180.png", type: "image/png", sizes: "180x180" }],
} satisfies NonNullable<Metadata["icons"]>;
