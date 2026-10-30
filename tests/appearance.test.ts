import assert from "node:assert/strict";
import { test } from "node:test";
import { measureAppearance } from "../public/appearance-analysis.mjs";
import { calculateAppearanceScores } from "../src/lib/appearance-scores";
import { calculateFaceReport } from "../src/lib/face-geometry";
import { classifyPSL } from "../src/lib/score-classification";
import { ReportSchema } from "../src/lib/analysis-schema";
import { syntheticAppearance } from "./fixtures/appearance";
import { syntheticDetection } from "./fixtures/landmarks";

test("pixels segmentados e confiáveis geram notas determinísticas de pele e cabelo", () => {
  const fixture = syntheticAppearance();
  const metrics = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  assert.ok(metrics.skin, "Pele deve ter amostras suficientes");
  assert.ok(metrics.hair, "Cabelo deve ter amostras suficientes");
  const scores = calculateAppearanceScores(metrics);
  assert.notEqual(scores.skin, null);
  assert.notEqual(scores.hair, null);
  for (const score of [scores.skin!, scores.hair!]) {
    assert.ok(score >= 0 && score <= 10);
    assert.ok(Number.isInteger(score * 10));
  }
  assert.deepEqual(calculateAppearanceScores(metrics), scores);
});

test("fórmulas publicadas usam apenas medidas de aparência, não quantidade de cabelo", () => {
  const metrics = {
    skin: { calibrationVersion: 2, sampleCount: 1000, areaCount: 3, referenceSamples: 128, confidence: 0.95, coverage: 0.9, clippedFraction: 0,
      lightingImbalance: 0.1, textureResidual: 0.1, textureRms: 0.1, midScaleResidual: 0.1, textureVariation: 0.1, detail: 2 },
    hair: { calibrationVersion: 2, sampleCount: 2000, confidence: 0.95, coverage: 0.9, visibleCoverage: 0.1,
      clippedFraction: 0, detail: 2, relativeDetailVariation: 1, relativeGradientVariation: 1 },
  };
  assert.deepEqual(calculateAppearanceScores(metrics), { skin: 5, hair: 5 });
  const moreVisibleHair = { ...metrics, hair: { ...metrics.hair, visibleCoverage: 0.5 } };
  assert.equal(calculateAppearanceScores(moreVisibleHair).hair, 5);
});

test("confiança moderada consistente aproveita pele sem relaxar o limiar de cabelo", () => {
  const fixture = syntheticAppearance();
  const initialHair = calculateAppearanceScores(measureAppearance(fixture.image, fixture.masks, fixture.landmarks)).hair;
  fixture.masks.skin.fill(0.74);
  const metrics = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  assert.ok(metrics.skin);
  assert.ok(metrics.skin.confidence >= 0.72 && metrics.skin.confidence < 0.8);
  assert.notEqual(calculateAppearanceScores(metrics).skin, null);
  assert.equal(calculateAppearanceScores(metrics).hair, initialHair);
  fixture.masks.skin.fill(0.69);
  assert.equal(measureAppearance(fixture.image, fixture.masks, fixture.landmarks).skin, null);
});

test("regiões centrais confiáveis substituem bochechas externas cobertas por cabelo", () => {
  const fixture = syntheticAppearance();
  const { width, height } = fixture.image;
  for (let y = 146; y < 191; y += 1) for (let x = 0; x < width; x += 1) {
    if ((x >= 104 && x <= 136) || (x >= 184 && x <= 216)) {
      fixture.masks.categories[y * width + x] = 1;
      fixture.masks.skin[y * width + x] = 0;
    }
  }
  assert.equal(height, 320);
  const metrics = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  assert.ok(metrics.skin);
  assert.ok(metrics.skin.areaCount >= 2);
  assert.ok(metrics.skin.sampleCount >= 400);
  assert.notEqual(calculateAppearanceScores(metrics).skin, null);
});

test("testa e bochecha confiáveis permitem análise quando o outro lado está em sombra extrema", () => {
  const fixture = syntheticAppearance();
  const { width, height, data } = fixture.image;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = y * width + x;
    if (y >= 50 && y < 100 && x >= 100 && x < 220) {
      fixture.masks.categories[i] = 3; fixture.masks.skin[i] = 0.95;
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 100;
    }
    if (x < 155 && y >= 105) data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 0;
  }
  const metrics = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  assert.ok(metrics.skin);
  assert.equal(metrics.skin.clippedFraction, 0);
  assert.ok(metrics.skin.lightingImbalance <= 0.45);
  assert.notEqual(calculateAppearanceScores(metrics).skin, null);
});

test("brilhos localizados são descartados sem inutilizar todas as regiões", () => {
  const fixture = syntheticAppearance();
  for (let y = 160; y < 176; y += 1) for (let x = 114; x < 126; x += 1) {
    const i = (y * fixture.image.width + x) * 4;
    fixture.image.data[i] = fixture.image.data[i + 1] = fixture.image.data[i + 2] = 255;
  }
  const measured = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  assert.ok(measured.skin);
  assert.equal(measured.skin.clippedFraction, 0);
  assert.notEqual(calculateAppearanceScores(measured).skin, null);
});

test("não pontua uma única região isolada nem um rosto inteiro sem exposição utilizável", () => {
  const fixture = syntheticAppearance();
  for (let y = 0; y < fixture.image.height; y += 1) for (let x = 159; x < fixture.image.width; x += 1) {
    fixture.masks.categories[y * fixture.image.width + x] = 0;
  }
  assert.equal(measureAppearance(fixture.image, fixture.masks, fixture.landmarks).skin, null);
  for (const value of [0, 255]) {
    const invalid = syntheticAppearance();
    for (let i = 0; i < invalid.image.data.length; i += 4) {
      invalid.image.data[i] = invalid.image.data[i + 1] = invalid.image.data[i + 2] = value;
    }
    assert.equal(measureAppearance(invalid.image, invalid.masks, invalid.landmarks).skin, null);
  }
});

test("referência nasal real pode substituir olhos cuja máscara não é confiável", () => {
  const fixture = syntheticAppearance();
  const { width, data } = fixture.image;
  for (let y = 110; y < 140; y += 1) for (let x = 102; x < 217; x += 1) {
    if (x < 148 || x > 173) fixture.masks.categories[y * width + x] = 5;
  }
  for (let y = 142; y < 178; y += 1) for (let x = 144; x < 177; x += 1) {
    if (x > 152 && x < 168) continue;
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = x % 4 < 2 ? 80 : 120;
  }
  const measured = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  assert.ok(measured.skin);
  assert.ok(measured.skin.referenceSamples >= 80);
  assert.notEqual(calculateAppearanceScores(measured).skin, null);
});

test("escurecer/clarear proporcionalmente pixels não saturados não é critério de cor natural", () => {
  const a = syntheticAppearance(70), b = syntheticAppearance(140);
  const one = calculateAppearanceScores(measureAppearance(a.image, a.masks, a.landmarks));
  const two = calculateAppearanceScores(measureAppearance(b.image, b.masks, b.landmarks));
  assert.notEqual(one.skin, null); assert.notEqual(two.skin, null);
  assert.notEqual(one.hair, null); assert.notEqual(two.hair, null);
  assert.ok(Math.abs(one.skin! - two.skin!) <= 0.2);
  assert.ok(Math.abs(one.hair! - two.hair!) <= 0.2);
});

test("baixa confiança, ausência de máscara e falta de cabelo visível não inventam notas", () => {
  const fixture = syntheticAppearance();
  fixture.masks.skin.fill(0.5); fixture.masks.hair.fill(0.5);
  assert.deepEqual(measureAppearance(fixture.image, fixture.masks, fixture.landmarks), { skin: null, hair: null });
  assert.deepEqual(calculateAppearanceScores(null), { skin: null, hair: null });
  const noHair = syntheticAppearance();
  noHair.masks.categories.forEach((value, i) => { if (value === 1) noHair.masks.categories[i] = 0; });
  assert.equal(measureAppearance(noHair.image, noHair.masks, noHair.landmarks).hair, null);
});

test("foto plana sem referência de nitidez não recebe nota alta fictícia de pele", () => {
  const fixture = syntheticAppearance();
  for (let i = 0; i < fixture.image.data.length; i += 4) {
    fixture.image.data[i] = fixture.image.data[i + 1] = fixture.image.data[i + 2] = 100;
  }
  assert.deepEqual(measureAppearance(fixture.image, fixture.masks, fixture.landmarks), { skin: null, hair: null });
});

test("falhas de confiança são independentes entre pele e cabelo", () => {
  const fixture = syntheticAppearance();
  fixture.masks.skin.fill(0.5);
  const first = calculateAppearanceScores(measureAppearance(fixture.image, fixture.masks, fixture.landmarks));
  assert.equal(first.skin, null);
  assert.notEqual(first.hair, null);
  fixture.masks.skin.fill(0.95);
  fixture.masks.hair.fill(0.5);
  const second = calculateAppearanceScores(measureAppearance(fixture.image, fixture.masks, fixture.landmarks));
  assert.notEqual(second.skin, null);
  assert.equal(second.hair, null);
});

test("desfoque sintético não ganha nota de pele lisa e reduz definição detectável", () => {
  const fixture = syntheticAppearance();
  const original = calculateAppearanceScores(measureAppearance(fixture.image, fixture.masks, fixture.landmarks));
  const source = fixture.image.data.slice();
  const { width, height } = fixture.image;
  for (let y = 3; y < height - 3; y += 1) for (let x = 3; x < width - 3; x += 1) {
    let sum = 0;
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) sum += source[((y + dy) * width + x + dx) * 4];
    const i = (y * width + x) * 4;
    fixture.image.data[i] = fixture.image.data[i + 1] = fixture.image.data[i + 2] = Math.round(sum / 49);
  }
  const blurred = calculateAppearanceScores(measureAppearance(fixture.image, fixture.masks, fixture.landmarks));
  assert.ok(original.skin !== null && original.hair !== null);
  assert.ok(blurred.skin === null || blurred.skin < original.skin);
  assert.ok(blurred.hair === null || blurred.hair < original.hair);
});

test("saturação e luz lateral excessiva fazem abstenção, não penalização da cor", () => {
  const fixture = syntheticAppearance();
  const measured = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  assert.ok(measured.skin); assert.ok(measured.hair);
  assert.equal(calculateAppearanceScores({ ...measured, skin: { ...measured.skin, clippedFraction: 0.5 } }).skin, null);
  assert.equal(calculateAppearanceScores({ ...measured, skin: { ...measured.skin, lightingImbalance: 0.6 } }).skin, null);
  assert.equal(calculateAppearanceScores({ ...measured, hair: { ...measured.hair, clippedFraction: 0.5 } }).hair, null);
});

test("dados inválidos e áreas muito pequenas são rejeitados sem afetar outras regiões", () => {
  const fixture = syntheticAppearance();
  const invalidMasks = { ...fixture.masks, skin: new Float32Array(0) };
  assert.deepEqual(measureAppearance(fixture.image, invalidMasks, fixture.landmarks), { skin: null, hair: null });
  assert.deepEqual(calculateAppearanceScores({ skin: { sampleCount: NaN }, hair: {} }), { skin: null, hair: null });
  const small = fixture.landmarks.map((p) => ({ x: 0.5 + (p.x - 0.5) * 0.3, y: p.y }));
  assert.deepEqual(measureAppearance(fixture.image, fixture.masks, small), { skin: null, hair: null });
});

test("integração preserva nota geral, potencial, demais regiões e classificação PSL", () => {
  const data = syntheticDetection();
  data.faces[0][291].y += 0.04;
  const baseline = calculateFaceReport(data);
  const fixture = syntheticAppearance();
  const appearance = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  const report = calculateFaceReport({ ...data, appearance });
  assert.equal(ReportSchema.safeParse(report).success, true);
  assert.equal(report.score, baseline.score);
  assert.deepEqual(report.potentialRange, baseline.potentialRange);
  assert.equal(classifyPSL(report.score), classifyPSL(baseline.score));
  for (const key of ["eyes", "eyebrows", "nose", "lips", "jawline", "chin", "cheekbones", "harmony"] as const) {
    assert.equal(report.regions[key], baseline.regions[key]);
  }
  assert.notEqual(report.regions.skin, null);
  assert.notEqual(report.regions.hair, null);
  assert.equal("appearance" in report, false); // Apenas as duas notas agregadas entram no relatório.
});
