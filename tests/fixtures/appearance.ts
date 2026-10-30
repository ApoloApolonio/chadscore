import { syntheticDetection } from "./landmarks";

/** Pixels e máscaras sintéticos para testar fórmulas, não exemplos de pele/cabelo reais. */
export function syntheticAppearance(base = 100) {
  const width = 320, height = 320;
  const data = new Uint8ClampedArray(width * height * 4);
  const categories = new Uint8Array(width * height);
  const skin = new Float32Array(width * height);
  const hair = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = y * width + x;
    let value = base;
    if (x >= 80 && x < 240 && y >= 10 && y < 100) {
      categories[i] = 1; hair[i] = 0.95;
      value = base * (0.7 + 0.12 * Math.sin(x * Math.PI / 2));
    } else if (x >= 65 && x < 255 && y >= 100 && y < 285) {
      categories[i] = 3; skin[i] = 0.95;
      value = base * (1 + 0.015 * Math.sin(x * Math.PI / 2));
      if (y >= 119 && y < 137 && ((x >= 107 && x < 142) || (x >= 178 && x < 213))) {
        value = base * (x % 4 < 2 ? 0.5 : 1.3);
      }
    }
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(value);
    data[i * 4 + 3] = 255;
  }
  return {
    image: { data, width, height },
    masks: { width, height, categories, skin, hair, skinIndex: 3, hairIndex: 1 },
    landmarks: syntheticDetection().faces[0],
  };
}
