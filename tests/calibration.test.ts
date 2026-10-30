import assert from "node:assert/strict";
import { test } from "node:test";
import { measureAppearance } from "../public/appearance-analysis.mjs";
import { sampleFaceLight } from "../public/capture-light.mjs";
import { calculateAppearanceScores } from "../src/lib/appearance-scores";
import { calculateFaceReport } from "../src/lib/face-geometry";
import { classifyPSL, formatScore } from "../src/lib/score-classification";
import { geometricResponse } from "../src/lib/calibration";
import { calibrationImage, CALIBRATION_IMAGE_SOURCE } from "./fixtures/calibration-images";
import { syntheticDetection, syntheticFaceMatrix } from "./fixtures/landmarks";

function analyze(options: Parameters<typeof calibrationImage>[0] = {}) {
  const fixture = calibrationImage(options);
  const metrics = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
  return { fixture, metrics, scores: calculateAppearanceScores(metrics) };
}

test("calibração usa imagens adequadas aos testes numéricos, autorais e sem fotografias armazenadas", () => {
  assert.match(CALIBRATION_IMAGE_SOURCE, /no real person/);
  assert.ok(calibrationImage().image.data instanceof Uint8ClampedArray);
});

test("contraste irregular localizado é detectado sem diluir sua energia na média das áreas", () => {
  const smooth = analyze(), moderate = analyze({ texture: 0.15 }), marked = analyze({ texture: 0.35 });
  assert.ok(smooth.metrics.skin && moderate.metrics.skin && marked.metrics.skin);
  assert.ok(smooth.scores.skin !== null && moderate.scores.skin !== null && marked.scores.skin !== null);
  assert.ok(marked.metrics.skin.textureRms > smooth.metrics.skin.textureRms);
  assert.ok(marked.metrics.skin.midScaleResidual > smooth.metrics.skin.midScaleResidual);
  assert.ok(moderate.scores.skin < smooth.scores.skin);
  assert.ok(marked.scores.skin < moderate.scores.skin);
  // Não fixa uma nota desejada: verifica monotonicidade das características medidas.
});

test("ganho de exposição não saturado não funciona como bônus nem avalia cor natural", () => {
  const base = analyze({ texture: 0.2 });
  for (const exposure of [0.65, 0.9, 1.2, 1.6]) {
    const changed = analyze({ exposure, texture: 0.2 });
    assert.ok(base.scores.skin !== null && changed.scores.skin !== null);
    assert.ok(Math.abs(changed.scores.skin - base.scores.skin) <= 0.3);
    assert.ok(base.scores.hair !== null && changed.scores.hair !== null);
    assert.ok(Math.abs(changed.scores.hair - base.scores.hair) <= 0.3);
  }
});

test("iluminação de baixa frequência tem influência limitada sobre textura local", () => {
  const base = analyze({ texture: 0.2 }), gradient = analyze({ texture: 0.2, lightingGradient: 0.25 });
  assert.ok(base.scores.skin !== null && gradient.scores.skin !== null);
  assert.ok(Math.abs(base.scores.skin - gradient.scores.skin) <= 0.4);
});

test("desfoque e exposição inutilizável provocam abstenção, não alta nota por pele lisa", () => {
  assert.equal(analyze({ texture: 0.2, blur: 3 }).scores.skin, null);
  assert.equal(analyze({ texture: 0.2, blur: 3 }).scores.hair, null);
  assert.equal(analyze({ exposure: 3 }).scores.skin, null);
});

test("nitidez acima do mínimo não adiciona pontos de aparência", () => {
  const measured = analyze({ texture: 0.2 }).metrics;
  assert.ok(measured.skin && measured.hair);
  const one = calculateAppearanceScores({ skin: { ...measured.skin, detail: 1.5 }, hair: { ...measured.hair, detail: 1 } });
  const two = calculateAppearanceScores({ skin: { ...measured.skin, detail: 3 }, hair: { ...measured.hair, detail: 3 } });
  assert.deepEqual(one, two);
});

test("resposta geométrica não tem corte artificial ou bônus; 8% de erro é meia-resposta", () => {
  assert.equal(geometricResponse(0, 0.08), 100);
  assert.equal(geometricResponse(0.08, 0.08), 50);
  assert.ok(geometricResponse(0.005, 0.08) < 100);
  assert.ok(geometricResponse(0.16, 0.08) > 0);
});

test("todas as regiões geométricas reagem a assimetrias locais, sem proporções ideais", () => {
  for (const [key, point] of [["eyes", 386], ["eyebrows", 300], ["nose", 327], ["lips", 291],
    ["jawline", 397], ["chin", 377], ["cheekbones", 323]] as const) {
    const baseline = syntheticDetection();
    const unchanged = calculateFaceReport(baseline);
    baseline.faces[0][point].y += 0.015;
    const changed = calculateFaceReport(baseline);
    assert.ok(changed.regions[key] !== null && changed.regions[key]! < unchanged.regions[key]!);
    assert.ok(changed.score !== null && changed.score < unchanged.score!);
  }
});

test("olhos com larguras iguais mas alturas distintas não recebem nota perfeita automática", () => {
  const data = syntheticDetection();
  data.faces[0][386].y -= 0.012;
  data.faces[0][374].y += 0.012;
  const report = calculateFaceReport(data);
  assert.ok(report.regions.eyes !== null && report.regions.eyes < 10);
});

test("pose lateral ou matriz ausente não se convertem em punição à aparência", () => {
  for (const faceMatrices of [undefined, [], [syntheticFaceMatrix(20)]]) {
    const report = calculateFaceReport({ ...syntheticDetection(), faceMatrices });
    assert.equal(report.score, null);
    assert.equal(report.regions.harmony, null);
    assert.equal(report.potential, null);
    assert.equal(classifyPSL(report.score), "—");
    assert.equal(formatScore(report.score), "—");
  }
});

test("luz e textura alteram apenas apresentação/captura, não geometria ou classificação de pontos idênticos", () => {
  const detection = syntheticDetection();
  detection.faces[0][291].y += 0.01;
  const baseline = calculateFaceReport(detection);
  for (const options of [{}, { texture: 0.3 }, { exposure: 0.7 }, { lightingGradient: 0.2 }, { blur: 3 }]) {
    const { fixture, metrics } = analyze(options);
    const report = calculateFaceReport({ ...detection, appearance: metrics,
      captureLight: sampleFaceLight(fixture.image, fixture.landmarks) });
    assert.equal(report.score, baseline.score);
    assert.equal(classifyPSL(report.score), classifyPSL(baseline.score));
    if (report.potentialRange) {
      assert.ok(report.potentialRange.lower <= report.score! && report.potentialRange.upper >= report.score!);
      assert.ok(report.potentialRange.upper <= 10);
    }
  }
});
