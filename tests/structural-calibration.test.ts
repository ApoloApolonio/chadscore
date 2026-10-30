import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateFaceScore, CAPTURE_LIMITS, geometricResponse, SCORE_WEIGHTS, STRUCTURE_CRITERIA, STRUCTURE_REGION_WEIGHTS, weightedHarmonic } from "../src/lib/calibration";
import { calculateFaceReport } from "../src/lib/face-geometry";
import { measureStructure } from "../src/lib/structural-geometry";
import { assessCapture } from "../src/lib/capture-confidence";
import { compareBattleScores } from "../src/lib/mogbattle";
import { sampleCaptureQuality } from "../public/capture-quality.mjs";
import { syntheticDetection, syntheticExpressions, syntheticFaceMatrix, syntheticQuality } from "./fixtures/landmarks";
import { syntheticAppearance } from "./fixtures/appearance";
import { calibrationImage } from "./fixtures/calibration-images";

test("pesos centralizados somam um; agregação não compensa estrutura fraca com simetria perfeita", () => {
  assert.ok(Math.abs(Object.values(SCORE_WEIGHTS).reduce<number>((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(Object.values(STRUCTURE_REGION_WEIGHTS).reduce<number>((a, b) => a + b, 0) - 1) < 1e-12);
  assert.equal(aggregateFaceScore(10, 10), 10);
  assert.ok(aggregateFaceScore(4, 10)! < .7 * 4 + .3 * 10);
  assert.equal(aggregateFaceScore(null, 10), null);
  assert.equal(weightedHarmonic([{ value: NaN, weight: 1 }]), null);
  assert.equal(aggregateFaceScore(0, 10), 0);
  // Qualquer resultado >=9,5 exige estrutura >=9,3, mesmo com harmonia máxima.
  assert.ok(aggregateFaceScore(9.2, 10)! < 9.5);
});

test("cada preferência tem pico explícito, meia-resposta e queda contínua nos dois sentidos", () => {
  for (const criterion of STRUCTURE_CRITERIA) {
    const response = (value: number) => geometricResponse(Math.abs(value - criterion.target), criterion.halfResponse) / 10;
    assert.equal(response(criterion.target), 10);
    for (const direction of [-1, 1]) {
      assert.ok(Math.abs(response(criterion.target + direction * criterion.halfResponse) - 5) < 1e-10);
      assert.ok(response(criterion.target + direction * .01 * criterion.halfResponse) < 10);
      assert.ok(response(criterion.target + direction * 2 * criterion.halfResponse) < 5);
    }
  }
});

test("diferentes larguras mandibulares simétricas mudam estrutura, não só simetria", () => {
  const reports = [.52, .72, .78, .94].map((ratio) => {
    const data = syntheticDetection();
    data.faces[0][172].x = .5 - ratio / 4;
    data.faces[0][397].x = .5 + ratio / 4;
    return calculateFaceReport(data);
  });
  assert.equal(new Set(reports.map((r) => r.regions.jawline)).size, 4);
  assert.equal(new Set(reports.map((r) => r.score)).size, 4);
  for (const report of reports) assert.equal(report.regions.harmony, 10);
  assert.ok(reports[0].score! < reports[2].score!);
});

test("largura/altura do queixo e contorno malar têm resposta mensurável independente", () => {
  const baseline = calculateFaceReport(syntheticDetection());
  for (const [region, left, right, dx, dy] of [
    ["chin", 148, 377, -.025, -.02], ["cheekbones", 93, 323, .04, 0],
    ["jawline", 132, 361, .02, .02],
  ] as const) {
    const data = syntheticDetection();
    data.faces[0][left].x += dx; data.faces[0][right].x -= dx;
    data.faces[0][left].y += dy; data.faces[0][right].y += dy;
    const changed = calculateFaceReport(data);
    assert.notEqual(changed.regions[region], baseline.regions[region]);
    assert.notEqual(changed.scoring.structure, baseline.scoring.structure);
    assert.equal(changed.regions.harmony, 10);
  }
});

test("escala/distância projetada e translação preservam notas quando há pixels suficientes", () => {
  const baseline = calculateFaceReport(syntheticDetection());
  for (const scale of [.4, .7, 1.05]) {
    const data = syntheticDetection();
    data.faces[0] = data.faces[0].map(({ x, y }) => ({ x: .52 + (x - .5) * scale, y: .49 + (y - .5) * scale }));
    const report = calculateFaceReport(data);
    assert.equal(report.score, baseline.score);
    assert.deepEqual(report.regions, baseline.regions);
  }
});

test("luz/foco só habilitam a captura; acima do mínimo não rendem pontos", () => {
  const baseline = calculateFaceReport(syntheticDetection());
  for (const detail of [.02, .1, 1]) for (const lightingImbalance of [0, .2, .34]) {
    const report = calculateFaceReport({ ...syntheticDetection(), captureQuality: { ...syntheticQuality(), detail, lightingImbalance } });
    assert.equal(report.score, baseline.score);
  }
});

test("ausência, baixa resolução, desfoque, sombras, pose e expressão provocam abstenção", () => {
  for (const change of [
    { captureQuality: undefined }, { faceExpressions: undefined },
    { captureQuality: { ...syntheticQuality(), detail: .001 } },
    { captureQuality: { ...syntheticQuality(), clippedFraction: .21 } },
    { captureQuality: { ...syntheticQuality(), lightingImbalance: .36 } },
    { captureQuality: { ...syntheticQuality(), sourceFaceWidth: 159 } },
    { faceMatrices: [syntheticFaceMatrix(CAPTURE_LIMITS.tiltDegrees + 1)] },
    { faceExpressions: [syntheticExpressions().map((entry) => ({ ...entry, score: entry.categoryName === "mouthSmileLeft" ? .6 : 0 }))] },
  ]) {
    const report = calculateFaceReport({ ...syntheticDetection(), ...change });
    assert.equal(report.score, null);
    assert.equal(report.potential, null);
    assert.equal(report.captureConfidence.reliable, false);
    assert.ok(report.captureConfidence.reasons.length > 0);
    assert.equal(compareBattleScores(8, report.score).status, "unavailable");
  }
  const data = syntheticDetection(); data.faces[0][14].y += .04;
  assert.equal(calculateFaceReport(data).score, null);
  const input = { quality: syntheticQuality(), matrices: [syntheticFaceMatrix()], expressions: [syntheticExpressions()], facePixels: 500, mouthOpening: NaN };
  assert.equal(assessCapture(input).reliable, false);
});

test("contornos colapsados não recebem notas perfeitas de fallback", () => {
  const data = syntheticDetection(); data.faces[0][132] = { ...data.faces[0][172] };
  const report = calculateFaceReport(data);
  assert.equal(report.score, null);
  assert.equal(report.regions.jawline, null);
  assert.equal(report.captureConfidence.reliable, false);
});

test("sampler de pixels reais distingue detalhe, imagem plana e clipping", () => {
  const fixture = syntheticAppearance();
  const detailed = sampleCaptureQuality(fixture.image, fixture.landmarks, 160)!;
  assert.ok(detailed.detail >= CAPTURE_LIMITS.minimumDetail);
  for (let i = 0; i < fixture.image.data.length; i += 4) fixture.image.data.fill(100, i, i + 3);
  const flat = sampleCaptureQuality(fixture.image, fixture.landmarks, 160)!;
  assert.ok(flat.detail < 1e-12);
  fixture.image.data.fill(255);
  assert.equal(sampleCaptureQuality(fixture.image, fixture.landmarks, 160), null);
});

test("pipeline de pixels preserva geometria sob luz utilizável e abstém em desfoque/sombra/saturação fortes", () => {
  const analyze = (options: Parameters<typeof calibrationImage>[0]) => {
    const fixture = calibrationImage(options);
    return calculateFaceReport({ ...syntheticDetection(), width: fixture.image.width, height: fixture.image.height,
      captureQuality: sampleCaptureQuality(fixture.image, fixture.landmarks, 160) });
  };
  const baseline = analyze({});
  assert.ok(baseline.captureConfidence.reliable);
  for (const options of [{ exposure: .7 }, { exposure: 1.3 }, { lightingGradient: .3 }]) {
    const report = analyze(options);
    assert.equal(report.score, baseline.score);
    assert.deepEqual(report.regions, baseline.regions);
  }
  for (const options of [{ blur: 12 }, { lightingGradient: 3 }, { exposure: 4 }]) {
    const report = analyze(options);
    assert.equal(report.score, null);
    assert.equal(report.captureConfidence.reliable, false);
  }
});

test("15% de apresentação expõe sensibilidade sem mudança geométrica; v3 exclui esse efeito", () => {
  const proposed = (presentation: number) => .6 * 8 + .25 * 8 + .15 * presentation;
  assert.ok(Math.abs((proposed(10) - proposed(0)) - 1.5) < 1e-10);
  const baseline = calculateFaceReport(syntheticDetection());
  assert.equal(SCORE_WEIGHTS.presentation, 0);
  assert.ok(baseline.score! < 10);
  // Reconstitui toda a estrutura não arredondada a partir dos critérios, sem snapshots de nota.
  const detection = syntheticDetection();
  const structure = measureStructure((index) => detection.faces[0][index], Object.fromEntries(Object.keys(STRUCTURE_REGION_WEIGHTS).map((key) => [key, 10])));
  assert.ok(Math.abs(structure.score! - baseline.scoring.structure!) < 1e-8);
  assert.equal(compareBattleScores(baseline.score, baseline.score).status, "tie");
});
