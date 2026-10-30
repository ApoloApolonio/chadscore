/**
 * Medidas de apresentação nos pixels segmentados. Nenhuma análise de saúde ou cor natural.
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {{width: number, height: number, categories: Uint8Array, skin: Float32Array, hair: Float32Array, skinIndex: number, hairIndex: number}} masks
 * @param {{x: number, y: number}[]} landmarks
 */
export function measureAppearance(image, masks, landmarks) {
  const unavailable = { skin: null, hair: null };
  const { width: w, height: h, data } = image;
  if (!w || !h || w > 768 || h > 768 || data.length !== w * h * 4 ||
      !masks.width || !masks.height || masks.skinIndex === masks.hairIndex ||
      masks.categories.length !== masks.width * masks.height ||
      masks.skin.length !== masks.categories.length || masks.hair.length !== masks.categories.length) return unavailable;
  if (![masks.skinIndex, masks.hairIndex].every((i) => Number.isInteger(i) && i >= 0 && i <= 255)) return unavailable;
  const indices = [10, 152, 234, 454, 33, 263, 133, 362];
  if (indices.some((i) => !landmarks[i] || !Number.isFinite(landmarks[i].x) || !Number.isFinite(landmarks[i].y) ||
      landmarks[i].x < 0 || landmarks[i].x > 1 || landmarks[i].y < 0 || landmarks[i].y > 1)) return unavailable;
  const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
  const l = p(33), r = p(263), top = p(10), chin = p(152);
  const span = Math.hypot(r.x - l.x, r.y - l.y);
  const fw = Math.hypot(p(454).x - p(234).x, p(454).y - p(234).y);
  const fh = Math.hypot(chin.x - top.x, chin.y - top.y);
  if (fw < 120 || span < 40 || fh < 140) return unavailable;
  const ex = { x: (r.x - l.x) / span, y: (r.y - l.y) / span };
  const ey = { x: -ex.y, y: ex.x };
  if ((chin.x - top.x) * ey.x + (chin.y - top.y) * ey.y < 0) { ey.x *= -1; ey.y *= -1; }
  const origin = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
  const eyeAreas = [33, 263].map((outer, k) => {
    const inner = p(k === 0 ? 133 : 362), edge = p(outer);
    return { x: (inner.x + edge.x) / 2, y: (inner.y + edge.y) / 2,
      width: Math.hypot(inner.x - edge.x, inner.y - edge.y) };
  });
  const luma = new Float32Array(w * h);
  for (let i = 0; i < luma.length; i += 1) luma[i] = (0.2126 * data[4 * i] + 0.7152 * data[4 * i + 1] + 0.0722 * data[4 * i + 2]) / 255;
  const stat = () => ({ count: 0, confidence: 0, clipped: 0, residual: 0, gradient: 0, laplacian: 0, light: 0 });
  // Bochechas externas/internas e testa: não exige que os dois lados estejam utilizáveis.
  // Os grupos impedem que duas subdivisões da mesma bochecha contem como regiões distintas.
  const patches = [
    { u: -0.25, v: 0.18, rx: 0.10, ry: 0.08, group: "left" },
    { u: 0.25, v: 0.18, rx: 0.10, ry: 0.08, group: "right" },
    { u: 0, v: -0.20, rx: 0.18, ry: 0.08, group: "forehead" },
    { u: -0.12, v: 0.14, rx: 0.065, ry: 0.07, group: "left" },
    { u: 0.12, v: 0.14, rx: 0.065, ry: 0.07, group: "right" },
  ];
  const patchStats = patches.map(stat);
  const patchTargets = patches.map(() => 0);
  const patchEnergy = patches.map(() => 0);
  const patchMidResidual = patches.map(() => 0);
  const patchMidCount = patches.map(() => 0);
  const hairStats = stat();
  const hairTiles = Array.from({ length: 16 }, stat);
  const references = [stat(), stat(), stat()];
  let hairCandidates = 0, hairConfident = 0, headArea = 0, hairAtEdge = 0, hairNearHead = 0;
  const maskAt = (x, y) => {
    const mx = Math.min(masks.width - 1, Math.floor((x + 0.5) * masks.width / w));
    const my = Math.min(masks.height - 1, Math.floor((y + 0.5) * masks.height / h));
    return my * masks.width + mx;
  };
  const metricsAt = (x, y) => {
    const i = y * w + x;
    let mean = 0;
    for (let yy = -2; yy <= 2; yy += 1) for (let xx = -2; xx <= 2; xx += 1) mean += luma[i + yy * w + xx];
    mean /= 25;
    const denominator = Math.max(mean, 0.001);
    return {
      mean,
      light: luma[i],
      residual: Math.abs(luma[i] - mean) / denominator,
      gradient: (Math.abs(luma[i + 1] - luma[i - 1]) + Math.abs(luma[i + w] - luma[i - w])) / (2 * denominator),
      laplacian: Math.abs(4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - w] - luma[i + w]) / denominator,
    };
  };
  const add = (s, m, confidence = 1) => {
    s.count += 1; s.confidence += confidence;
    s.residual += m.residual; s.gradient += m.gradient; s.laplacian += m.laplacian; s.light += m.light;
    if (m.light <= 8 / 255 || m.light >= 247 / 255) s.clipped += 1;
  };
  const confident = (x, y, category, confidence) => {
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const j = maskAt(x + dx, y + dy);
      if (data[((y + dy) * w + x + dx) * 4 + 3] < 250 || masks.categories[j] !== category ||
          !Number.isFinite(confidence[j]) || confidence[j] < 0.75 || confidence[j] > 1) return false;
    }
    return true;
  };
  const skinMargin = Math.max(3, Math.round(Math.min(w, h) * 0.015));
  const reliableSkin = (x, y, checkLight = true) => {
    if (x < skinMargin || y < skinMargin || x >= w - skinMargin || y >= h - skinMargin) return false;
    const center = maskAt(x, y);
    if (!Number.isFinite(masks.skin[center]) || masks.skin[center] < 0.70 || masks.skin[center] > 1) return false;
    let clipped = 0;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const i = (y + dy) * w + x + dx;
      const j = maskAt(x + dx, y + dy);
      if (data[i * 4 + 3] < 250 || masks.categories[j] !== masks.skinIndex ||
          !Number.isFinite(masks.skin[j]) || masks.skin[j] < 0.60 || masks.skin[j] > 1) return false;
      if (luma[i] <= 8 / 255 || luma[i] >= 247 / 255) clipped += 1;
    }
    // Descarta a amostra, não o rosto inteiro. As bordas dos olhos podem ser escuras;
    // por isso a referência de nitidez não usa este filtro de exposição.
    return !checkLight || (luma[y * w + x] > 8 / 255 && luma[y * w + x] < 247 / 255 && clipped <= 5);
  };
  // Média de baixa frequência somente em pele confiável: não mistura cabelo/fundo.
  const stride = w + 1;
  const skinIntegral = new Float64Array(stride * (h + 1));
  const skinCounts = new Uint32Array(stride * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let rowSum = 0, rowCount = 0;
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x, j = maskAt(x, y);
      if (masks.categories[j] === masks.skinIndex && masks.skin[j] >= 0.60 && masks.skin[j] <= 1 &&
          data[i * 4 + 3] >= 250 && luma[i] > 8 / 255 && luma[i] < 247 / 255) {
        rowSum += luma[i]; rowCount += 1;
      }
      const k = (y + 1) * stride + x + 1;
      skinIntegral[k] = skinIntegral[k - stride] + rowSum;
      skinCounts[k] = skinCounts[k - stride] + rowCount;
    }
  }
  const midMean = (x, y) => {
    const x0 = Math.max(0, x - 6), y0 = Math.max(0, y - 6);
    const x1 = Math.min(w, x + 7), y1 = Math.min(h, y + 7);
    const a = y0 * stride + x0, b = y0 * stride + x1, c = y1 * stride + x0, d = y1 * stride + x1;
    const count = skinCounts[d] - skinCounts[b] - skinCounts[c] + skinCounts[a];
    if (count < (x1 - x0) * (y1 - y0) * 0.7) return null;
    return (skinIntegral[d] - skinIntegral[b] - skinIntegral[c] + skinIntegral[a]) / count;
  };
  for (let y = 2; y < h - 2; y += 1) for (let x = 2; x < w - 2; x += 1) {
    if (data[(y * w + x) * 4 + 3] < 250) continue;
    const dx = x + 0.5 - origin.x, dy = y + 0.5 - origin.y;
    const u = (dx * ex.x + dy * ex.y) / fw;
    const v = (dx * ey.x + dy * ey.y) / fh;
    const maskIndex = maskAt(x, y);
    const patch = patches.findIndex((p) => ((u - p.u) / p.rx) ** 2 + ((v - p.v) / p.ry) ** 2 <= 1);
    if (patch >= 0) {
      patchTargets[patch] += 1;
      if (reliableSkin(x, y)) {
        const m = metricsAt(x, y), mid = midMean(x, y);
        if (mid !== null) {
          add(patchStats[patch], m, masks.skin[maskIndex]);
          patchEnergy[patch] += m.residual ** 2;
          patchMidResidual[patch] += Math.abs(m.mean - mid) / Math.max(mid, 0.001);
          patchMidCount[patch] += 1;
        }
      }
    }
    // Referência de nitidez nas bordas dos olhos, não na textura natural da pele.
    const eyeIndex = eyeAreas.findIndex((eye) => {
      if (eye.width < 1) return false;
      const ax = ((x - eye.x) * ex.x + (y - eye.y) * ex.y) / (eye.width * 0.65);
      const ay = ((x - eye.x) * ey.x + (y - eye.y) * ey.y) / (eye.width * 0.4);
      return ax * ax + ay * ay <= 1;
    });
    if (eyeIndex >= 0 && reliableSkin(x, y, false)) add(references[eyeIndex], metricsAt(x, y));
    // Alternativa de nitidez nas bordas nasais; não usa a lisura da pele como prova de foco.
    if (eyeIndex < 0 && Math.abs(u) >= 0.04 && Math.abs(u) <= 0.10 && v >= 0.04 && v <= 0.22 && reliableSkin(x, y, false)) {
      add(references[2], metricsAt(x, y));
    }
    // Cobertura VISÍVEL na região da cabeça; nunca densidade ou tamanho ideal do cabelo.
    if (Math.abs(u) <= 0.85 && v >= -0.9 && v <= 1.0) {
      headArea += 1;
      if (masks.categories[maskIndex] === masks.hairIndex) {
        hairCandidates += 1;
        if (x <= 3 || y <= 3 || x >= w - 4 || y >= h - 4) hairAtEdge += 1;
        if (confident(x, y, masks.hairIndex, masks.hair)) {
          hairConfident += 1;
          if (Math.abs(u) < 0.65 && v < 0.2) hairNearHead += 1;
          const m = metricsAt(x, y);
          add(hairStats, m, masks.hair[maskIndex]);
          const tx = Math.min(3, Math.floor((u + 0.85) / 1.7 * 4));
          const ty = Math.min(3, Math.floor((v + 0.9) / 1.9 * 4));
          add(hairTiles[ty * 4 + tx], m);
        }
      }
    }
  }
  const detail = (s) => s.laplacian / Math.max(s.gradient, 0.000001)
    * Math.min(1, (s.gradient / Math.max(1, s.count)) / 0.08);
  // Seleção por suficiência, confiança e luz, NUNCA pela textura ou pela nota desejada.
  const candidates = patchStats.map((s, i) => ({ ...s, index: i }))
    .filter((s) => s.count >= 80 && s.count / Math.max(1, patchTargets[s.index]) >= 0.4 && s.confidence / s.count >= 0.72);
  let validPatches = [];
  let bestCount = 0;
  for (let subset = 1; subset < 2 ** candidates.length; subset += 1) {
    const selected = candidates.filter((_, i) => (subset & (1 << i)) !== 0);
    if (new Set(selected.map((s) => patches[s.index].group)).size < 2) continue;
    const means = selected.map((s) => s.light / s.count);
    if ((Math.max(...means) - Math.min(...means)) / Math.max(...means, 0.001) > 0.45) continue;
    const count = selected.reduce((sum, s) => sum + s.count, 0);
    if (count > bestCount) { bestCount = count; validPatches = selected; }
  }
  const skinCount = validPatches.reduce((sum, s) => sum + s.count, 0);
  const skinCoverage = skinCount / Math.max(1, validPatches.reduce((sum, s) => sum + patchTargets[s.index], 0));
  const skinClipped = validPatches.reduce((sum, s) => sum + s.clipped, 0) / Math.max(1, skinCount);
  const skinConfidence = validPatches.reduce((sum, s) => sum + s.confidence, 0) / Math.max(1, skinCount);
  const patchMeans = validPatches.map((s) => s.light / s.count);
  const skinImbalance = patchMeans.length ? (Math.max(...patchMeans) - Math.min(...patchMeans)) / Math.max(...patchMeans, 0.001) : 1;
  const residuals = validPatches.map((s) => s.residual / s.count);
  const residual = residuals.reduce((a, b) => a + b, 0) / Math.max(1, residuals.length);
  const textureVariation = residuals.reduce((sum, n) => sum + Math.abs(n - residual), 0) / Math.max(1, residuals.length);
  const textureRms = Math.sqrt(validPatches.reduce((sum, s) => sum + patchEnergy[s.index], 0) / Math.max(1, skinCount));
  const midScaleResidual = validPatches.reduce((sum, s) => sum + patchMidResidual[s.index], 0)
    / Math.max(1, validPatches.reduce((sum, s) => sum + patchMidCount[s.index], 0));
  const eyeReferences = references.slice(0, 2).filter((s) => s.count >= 48 && s.gradient / s.count >= 0.008);
  const focusReferences = eyeReferences.length ? eyeReferences
    : references[2].count >= 80 && references[2].gradient / references[2].count >= 0.012 ? [references[2]] : [];
  const focusCount = focusReferences.reduce((sum, s) => sum + s.count, 0);
  const focusDetail = focusReferences.reduce((sum, s) => sum + detail(s) * s.count, 0) / Math.max(1, focusCount);
  const skin = skinCount >= 400 && validPatches.length >= 2 && skinCoverage >= 0.4 && focusCount >= 48
    ? { calibrationVersion: 2, sampleCount: skinCount, confidence: skinConfidence, coverage: skinCoverage, clippedFraction: skinClipped,
        areaCount: validPatches.length, referenceSamples: focusCount,
        lightingImbalance: skinImbalance, textureResidual: residual, textureRms, midScaleResidual, textureVariation, detail: focusDetail }
    : null;
  const tiles = hairTiles.filter((s) => s.count >= 24 && s.gradient / s.count >= 0.004);
  const details = tiles.map(detail);
  const averageDetail = details.reduce((a, b) => a + b, 0) / Math.max(1, details.length);
  const detailVariation = details.reduce((sum, n) => sum + Math.abs(n - averageDetail), 0) / Math.max(1, details.length);
  const gradients = tiles.map((s) => s.gradient / s.count);
  const averageGradient = gradients.reduce((a, b) => a + b, 0) / Math.max(1, gradients.length);
  const gradientVariation = gradients.reduce((sum, n) => sum + Math.abs(n - averageGradient), 0) / Math.max(1, gradients.length);
  const hair = hairStats.count >= 400 && hairConfident / Math.max(1, hairCandidates) >= 0.65 &&
    hairConfident / Math.max(1, headArea) >= 0.015 && hairNearHead >= 50 && hairAtEdge / Math.max(1, hairCandidates) <= 0.02 &&
    hairStats.gradient / hairStats.count >= 0.004 && tiles.length >= 3
    ? { calibrationVersion: 2, sampleCount: hairStats.count, confidence: hairStats.confidence / hairStats.count,
        coverage: hairConfident / hairCandidates, visibleCoverage: hairConfident / headArea,
        clippedFraction: hairStats.clipped / hairStats.count, detail: detail(hairStats),
        relativeDetailVariation: detailVariation / Math.max(averageDetail, 0.001),
        relativeGradientVariation: gradientVariation / Math.max(averageGradient, 0.001) }
    : null;
  return { skin, hair };
}
