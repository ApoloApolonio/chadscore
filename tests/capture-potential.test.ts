import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateCapturePotential, faceTiltDegrees } from "../src/lib/capture-potential";
import { calculateFaceReport } from "../src/lib/face-geometry";
import { ReportSchema } from "../src/lib/analysis-schema";
import { sampleFaceLight } from "../public/capture-light.mjs";
import { syntheticDetection, syntheticFaceMatrix, syntheticLight } from "./fixtures/landmarks";

function captureInput() {
  const data = syntheticDetection();
  return { landmarks: data.faces[0], width: data.width, height: data.height, light: syntheticLight(), matrices: [syntheticFaceMatrix()] };
}

function grayImage(left: number, right = left, alpha = 255) {
  const width = 400, height = 400;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = x < width / 2 ? left : right;
      data[i + 3] = alpha;
    }
  }
  return { data, width, height };
}

test("pixels uniformes válidos geram medidas de luma reais, sem impor brilho médio ideal", () => {
  const landmarks = syntheticDetection().faces[0];
  for (const gray of [20, 60, 128, 220]) {
    const light = sampleFaceLight(grayImage(gray), landmarks);
    assert.ok(light);
    assert.ok(Math.abs(light.leftMean - gray / 255) < 1e-10);
    assert.ok(Math.abs(light.rightMean - gray / 255) < 1e-10);
    assert.equal(light.darkFraction, 0);
    assert.equal(light.brightFraction, 0);
    assert.equal(light.leftCount + light.rightCount, light.sampleCount);
    const input = captureInput();
    assert.deepEqual(estimateCapturePotential(7.7, { ...input, light }), { lower: 7.7, upper: 7.7 });
  }
});

test("estatísticas detectam saturação e diferença lateral de pixels, sem avaliar pele", () => {
  const landmarks = syntheticDetection().faces[0];
  const dark = sampleFaceLight(grayImage(0), landmarks);
  const bright = sampleFaceLight(grayImage(255), landmarks);
  assert.equal(dark?.darkFraction, 1);
  assert.equal(bright?.brightFraction, 1);
  const uneven = sampleFaceLight(grayImage(70, 130), landmarks);
  assert.ok(uneven);
  assert.ok(uneven.leftMean < uneven.rightMean);
  assert.equal(uneven.darkFraction, 0);
  assert.ok(estimateCapturePotential(7.7, { ...captureInput(), light: uneven })!.upper > 7.7);
});

test("área insuficiente, transparência e marcos ausentes não geram qualidade inventada", () => {
  const landmarks = syntheticDetection().faces[0];
  assert.equal(sampleFaceLight(grayImage(128, 128, 0), landmarks), null);
  assert.equal(sampleFaceLight(grayImage(128), []), null);
  assert.equal(sampleFaceLight({ data: new Uint8ClampedArray(4), width: 1, height: 1 }, landmarks), null);
  const cropped = landmarks.map((p) => ({ ...p, x: p.x - 0.48 }));
  assert.equal(sampleFaceLight(grayImage(128), cropped), null);
});

test("inclinação vem da matriz de rotação e é invariante à transposição/escalonamento uniforme", () => {
  assert.equal(faceTiltDegrees(syntheticFaceMatrix()), 0);
  const matrix = syntheticFaceMatrix(15);
  assert.ok(Math.abs(faceTiltDegrees(matrix)! - 15) < 1e-10);
  const transposed = { ...matrix, data: matrix.data.map((_, i) => matrix.data[(i % 4) * 4 + Math.floor(i / 4)]) };
  assert.ok(Math.abs(faceTiltDegrees(transposed)! - 15) < 1e-10);
  const scaled = { ...matrix, data: matrix.data.map((n, i) => i < 12 && i % 4 !== 3 ? n * 2 : n) };
  assert.ok(Math.abs(faceTiltDegrees(scaled)! - 15) < 1e-10);
  const invalid = { ...matrix, data: [...matrix.data] };
  invalid.data[4] = 0.8;
  assert.equal(faceTiltDegrees(invalid), null);
});

test("fórmula determinística limita cenário superior e admite também queda, sem bônus fixo", () => {
  const input = captureInput();
  input.matrices = [syntheticFaceMatrix(14)]; // A=(14−3)/22=0,5; U=0,6×0,5=0,3.
  const result = estimateCapturePotential(7.7, input);
  assert.deepEqual(result, { lower: 7.3, upper: 8.2 }); // delta=0,45; arredondamento independente.
  assert.deepEqual(estimateCapturePotential(7.7, input), result);
  const nearCeiling = estimateCapturePotential(9.8, input)!;
  assert.ok(nearCeiling.upper <= 10);
  assert.deepEqual(estimateCapturePotential(10, input), { lower: 10, upper: 10 });
  for (const score of [0, 1.2, 5.5, 7.7, 9.9, 10]) {
    const range = estimateCapturePotential(score, input)!;
    assert.ok(range.lower >= 0 && range.upper <= 10 && range.lower <= score && range.upper >= score);
    assert.ok(range.upper - score <= 1.55);
  }
});

test("alinhamento e centralização limitam confiança, sem criar bônus onde a nota já corrige rotação/translação", () => {
  const input = captureInput();
  input.matrices = [syntheticFaceMatrix(20)];
  const aligned = estimateCapturePotential(7.7, input)!;
  const rotated = { ...input, landmarks: input.landmarks.map((p) => ({
    x: 0.5 + (p.x - 0.5) * Math.cos(0.25) - (p.y - 0.5) * Math.sin(0.25),
    y: 0.5 + (p.x - 0.5) * Math.sin(0.25) + (p.y - 0.5) * Math.cos(0.25),
  })) };
  assert.ok(estimateCapturePotential(7.7, rotated)!.upper < aligned.upper);
  const offCenter = { ...input, landmarks: input.landmarks.map((p) => ({ x: p.x + 0.2, y: p.y })) };
  assert.ok(estimateCapturePotential(7.7, offCenter)!.upper < aligned.upper);
  const onlyFraming = { ...offCenter, matrices: [syntheticFaceMatrix()] };
  assert.deepEqual(estimateCapturePotential(7.7, onlyFraming), { lower: 7.7, upper: 7.7 });
});

test("dados faltantes, inválidos ou extremos deixam potencial não estimado", () => {
  const input = captureInput();
  for (const changed of [
    { light: null }, { matrices: [] }, { matrices: [syntheticFaceMatrix(35)] },
    { light: { ...input.light, coverage: 0.8 } },
    { light: { ...input.light, sampleCount: 20 } },
    { light: { ...input.light, leftMean: NaN } },
    { light: { ...input.light, leftCount: 128 } },
    { light: { ...input.light, darkFraction: 0.6 } },
    { light: { ...input.light, leftMean: 0.1, rightMean: 0.9 } },
  ]) assert.equal(estimateCapturePotential(7.7, { ...input, ...changed }), null);
  assert.equal(estimateCapturePotential(NaN, input), null);
});

test("relatório integra qualidade opcional, preserva nota/PSL e não persiste pixels ou matrizes", () => {
  const data = syntheticDetection();
  data.faces[0][291].y += 0.04;
  data.faces[0][362].x += 0.02;
  const baseline = calculateFaceReport(data);
  const withCapture = calculateFaceReport({ ...data, captureLight: syntheticLight(), faceMatrices: [syntheticFaceMatrix(10)] });
  assert.equal(withCapture.score, baseline.score);
  assert.ok(baseline.score !== null && withCapture.potential! > baseline.score);
  assert.equal(withCapture.potential, withCapture.potentialRange!.upper);
  assert.equal(ReportSchema.safeParse(withCapture).success, true);
  assert.equal(baseline.potential, null);
  assert.equal(baseline.potentialRange, null);
  assert.equal("captureLight" in withCapture, false);
  assert.equal("faceMatrices" in withCapture, false);
  const invalidCapture = calculateFaceReport({ ...data, captureLight: {} });
  assert.equal(invalidCapture.potential, null);
});
