import { sampleFaceLight } from "./capture-light.mjs";

/** Canonical detail/exposure gate only. Never adds appearance or structure points. */
export function sampleCaptureQuality(image, landmarks, sourceFaceWidth) {
  const { width, height, data } = image;
  if (!width || !height || data.length !== width * height * 4) return null;
  const [left, right, top, chin] = [234, 454, 10, 152].map((index) => landmarks[index]);
  if ([left, right, top, chin].some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const faceWidth = Math.hypot((right.x - left.x) * width, (right.y - left.y) * height);
  if (faceWidth < 120 || faceWidth > 193) return null;
  const light = sampleFaceLight(image, landmarks);
  if (!light) return null;
  const luma = (x, y) => { const i = (y * width + x) * 4; return (.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]) / 255; };
  const cx = (left.x + right.x) * width / 2, cy = (top.y + chin.y) * height / 2;
  const rx = faceWidth * .37, ry = Math.abs(chin.y - top.y) * height * .37;
  let count = 0, energy = 0;
  for (let y = Math.max(1, Math.floor(cy - ry)); y < Math.min(height - 1, cy + ry); y += 2) {
    for (let x = Math.max(1, Math.floor(cx - rx)); x < Math.min(width - 1, cx + rx); x += 2) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
      const coordinates = [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      if (coordinates.some(([px, py]) => data[(py * width + px) * 4 + 3] < 250)) continue;
      const values = coordinates.map(([px, py]) => luma(px, py));
      const mean = values.reduce((a, b) => a + b) / values.length;
      if (mean < 8 / 255 || mean > 247 / 255) continue;
      const residual = (4 * values[0] - values[1] - values[2] - values[3] - values[4]) / Math.max(mean, 1 / 255);
      energy += residual ** 2; count++;
    }
  }
  if (count < 256) return null;
  return { sampleCount: count, sourceFaceWidth, canonicalFaceWidth: faceWidth, detail: Math.sqrt(energy / count),
    clippedFraction: light.darkFraction + light.brightFraction,
    lightingImbalance: Math.abs(light.leftMean - light.rightMean) / Math.max(light.leftMean, light.rightMean, 1 / 255) };
}
