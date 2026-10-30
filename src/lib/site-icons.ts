import type { Metadata } from "next";

/**
 * Ícone oficial do ChadScore: retrato em círculo azul, com transparência fora do círculo.
 * Arquivos gerados por `npm run prepare:icons` a partir de `assets/chadscore-icon.png`.
 * `?v=2` evita que navegadores reutilizem o favicon anterior em cache.
 */
export const siteIcons = {
  icon: [
    { url: "/favicon.ico?v=2", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
    { url: "/icons/icon-16.png?v=2", type: "image/png", sizes: "16x16" },
    { url: "/icons/icon-32.png?v=2", type: "image/png", sizes: "32x32" },
    { url: "/icons/icon-48.png?v=2", type: "image/png", sizes: "48x48" },
    { url: "/icons/icon-512.png?v=2", type: "image/png", sizes: "512x512" },
  ],
  shortcut: [{ url: "/favicon.ico?v=2", type: "image/x-icon" }],
  apple: [{ url: "/icons/icon-180.png?v=2", type: "image/png", sizes: "180x180" }],
} satisfies NonNullable<Metadata["icons"]>;
