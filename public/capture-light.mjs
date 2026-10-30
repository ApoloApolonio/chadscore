/**
 * Estatísticas de pixels de uma elipse central do rosto (não identifica tipo de pele).
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {{x: number, y: number}[]} landmarks
 */
export function sampleFaceLight(image, landmarks) {
  const { data, width, height } = image;
  if (data.length !== width * height * 4 || width < 1 || height < 1) return null;
  const points = [10, 152, 234, 454, 33, 263].map((index) => landmarks[index]);
  if (points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
      p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return null;
  const pixel = (point) => ({ x: point.x * width, y: point.y * height });
  const [top, chin, left, right, eyeLeft, eyeRight] = points.map(pixel);
  const eyeDistance = Math.hypot(eyeRight.x - eyeLeft.x, eyeRight.y - eyeLeft.y);
  if (eyeDistance < 1) return null;
  const ex = { x: (eyeRight.x - eyeLeft.x) / eyeDistance, y: (eyeRight.y - eyeLeft.y) / eyeDistance };
  const ey = { x: -ex.y, y: ex.x };
  const cx = (top.x + chin.x) / 2;
  const cy = (top.y + chin.y) / 2;
  const rx = 0.4 * Math.hypot(right.x - left.x, right.y - left.y);
  const ry = 0.4 * Math.hypot(chin.x - top.x, chin.y - top.y);
  if (rx < 1 || ry < 1) return null;
  const bx = Math.hypot(rx * ex.x, ry * ey.x);
  const by = Math.hypot(rx * ex.y, ry * ey.y);
  let expected = 0, count = 0, dark = 0, bright = 0;
  let leftCount = 0, rightCount = 0, leftSum = 0, rightSum = 0;
  // Grade fixa de 2 px: custo limitado pelo redimensionamento anterior para 1280.
  for (let y = Math.floor(cy - by); y <= Math.ceil(cy + by); y += 2) {
    for (let x = Math.floor(cx - bx); x <= Math.ceil(cx + bx); x += 2) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = dx * ex.x + dy * ex.y;
      const v = dx * ey.x + dy * ey.y;
      if ((u / rx) ** 2 + (v / ry) ** 2 > 1) continue;
      expected += 1;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 250) continue;
      // Luma sRGB aproximada; não equivale a iluminância física nem mede saúde da pele.
      const luma = (0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]) / 255;
      count += 1;
      if (luma <= 8 / 255) dark += 1;
      if (luma >= 247 / 255) bright += 1;
      if (u < 0) { leftCount += 1; leftSum += luma; }
      else { rightCount += 1; rightSum += luma; }
    }
  }
  if (!expected || count < 512 || leftCount < 128 || rightCount < 128 || count / expected < 0.95) return null;
  return {
    sampleCount: count,
    leftCount,
    rightCount,
    coverage: count / expected,
    darkFraction: dark / count,
    brightFraction: bright / count,
    leftMean: leftSum / leftCount,
    rightMean: rightSum / rightCount,
  };
}
