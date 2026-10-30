import { syntheticAppearance } from "./appearance";

/**
 * Imagens procedurais criadas pelo projeto, exclusivamente em memória.
 * Sem retratos de terceiros, dados pessoais, downloads ou direitos de imagem alheios.
 * Não são fotografias humanas nem evidência de calibração estética/populacional.
 */
export const CALIBRATION_IMAGE_SOURCE = "Procedural test generator; no real person; in-memory only";

export function calibrationImage({ exposure = 1, lightingGradient = 0, texture = 0, blur = 0 } = {}) {
  const fixture = syntheticAppearance(90);
  const { width, height, data } = fixture.image;
  const centers = [
    [113, 160], [124, 173], [118, 181], [132, 166], [140, 170],
    [207, 160], [196, 173], [202, 181], [188, 166], [180, 170],
  ];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    let pattern = 0;
    if (texture) for (const [cx, cy] of centers) {
      pattern += texture * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 16);
    }
    const factor = exposure * (1 + lightingGradient * (x / (width - 1) - 0.5));
    const value = Math.max(0, Math.min(255, data[i] * (1 - pattern) * factor));
    data[i] = data[i + 1] = data[i + 2] = Math.round(value);
  }
  if (blur) {
    const original = data.slice();
    for (let y = blur; y < height - blur; y += 1) for (let x = blur; x < width - blur; x += 1) {
      let sum = 0;
      for (let dy = -blur; dy <= blur; dy += 1) for (let dx = -blur; dx <= blur; dx += 1) {
        sum += original[((y + dy) * width + x + dx) * 4];
      }
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(sum / (2 * blur + 1) ** 2);
    }
  }
  return fixture;
}
