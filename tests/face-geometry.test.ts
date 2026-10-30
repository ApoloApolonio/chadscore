import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFaceReport, scoreFromErrors } from "../src/lib/face-geometry";
import { ReportSchema } from "../src/lib/analysis-schema";
import { syntheticDetection } from "./fixtures/landmarks";
import { aggregateFaceScore } from "../src/lib/calibration";
import { roundScore } from "../src/lib/score-classification";

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test("simetria perfeita não basta para nota estrutural perfeita", () => {
  const report = calculateFaceReport(syntheticDetection());
  assert.equal(ReportSchema.safeParse(report).success, true);
  assert.equal(report.regions.harmony, 10);
  assert.ok(report.score !== null && report.score < 10 && report.score > 0);
  for (const component of report.scoreComponents) near(component.error, 0);
  near(report.measurements.find((m) => m.label === "Altura/largura da malha facial")!.value, 1.4);
  near(report.measurements.find((m) => m.label === "Largura mandibular/largura facial")!.value, 0.72);
  near(report.measurements.find((m) => m.label === "Espaço interno dos olhos/largura facial")!.value, 0.24);
});

test("deslocamento detectável altera medições e nota segundo a fórmula publicada", () => {
  const data = syntheticDetection();
  data.faces[0][291].y += 0.04;
  data.faces[0][362].x += 0.02;
  const report = calculateFaceReport(data);
  assert.ok(report.score !== null && report.score < 10);
  const harmony = 10 / (1 + report.scoreComponents.reduce((sum, c) => sum + c.weight * (c.error / c.tolerance) ** 2, 0));
  near(report.scoring.harmony!, harmony);
  assert.equal(report.score, roundScore(aggregateFaceScore(report.scoring.structure, harmony)!));
});

test("nota tem pesos explícitos, decai com erro e fica entre 0 e 10", () => {
  assert.equal(scoreFromErrors(Array(7).fill(0.08)).score, 5);
  assert.equal(scoreFromErrors(Array(7).fill(0)).score, 10);
  assert.equal(scoreFromErrors(Array(7).fill(9)).score, 0);
  assert.throws(() => scoreFromErrors([NaN, 0, 0]));
  assert.throws(() => scoreFromErrors([-1, 0, 0]));
  assert.throws(() => scoreFromErrors([0]));
});

test("corrige escala de pixels em imagens não quadradas", () => {
  const data = syntheticDetection();
  data.width = 2000;
  data.faces[0] = data.faces[0].map((p) => ({ x: p.x / 2, y: p.y }));
  const report = calculateFaceReport(data);
  const baseline = calculateFaceReport(syntheticDetection());
  assert.equal(report.score, baseline.score);
  report.measurements.forEach((measurement, index) => near(measurement.value, baseline.measurements[index].value));
});

test("resultados são invariantes a rotação no plano e espelhamento", () => {
  const baseline = calculateFaceReport(syntheticDetection());
  for (const transform of [
    (x: number, y: number) => ({ x: 1 - x, y }),
    (x: number, y: number) => ({
      x: 0.5 + (x - 0.5) * Math.cos(0.25) - (y - 0.5) * Math.sin(0.25),
      y: 0.5 + (x - 0.5) * Math.sin(0.25) + (y - 0.5) * Math.cos(0.25),
    }),
  ]) {
    const data = syntheticDetection();
    data.faces[0] = data.faces[0].map((p) => transform(p.x, p.y));
    const report = calculateFaceReport(data);
    assert.equal(report.score, baseline.score);
    report.measurements.forEach((m, index) => near(m.value, baseline.measurements[index].value));
  }
});

test("não pontua foto sem rosto, múltiplos rostos ou pontos insuficientes", () => {
  const data = syntheticDetection();
  assert.throws(() => calculateFaceReport({ ...data, faces: [] }), /Nenhum rosto/);
  assert.throws(() => calculateFaceReport({ ...data, faces: [data.faces[0], data.faces[0]] }), /mais de um rosto/);
  assert.throws(() => calculateFaceReport({ ...data, faces: [data.faces[0].slice(0, 100)] }), /suficientes/);
});

test("não inventa medições com pontos inválidos, pose inadequada ou olhos fechados", () => {
  for (const change of [
    (data: ReturnType<typeof syntheticDetection>) => { data.faces[0][10].x = NaN; },
    (data: ReturnType<typeof syntheticDetection>) => { data.faces[0][10].x = -1; },
    (data: ReturnType<typeof syntheticDetection>) => { data.faces[0][1].x = 0.7; },
    (data: ReturnType<typeof syntheticDetection>) => { data.faces[0][159] = { ...data.faces[0][145] }; },
    (data: ReturnType<typeof syntheticDetection>) => { data.width = 10; },
  ]) {
    const data = syntheticDetection();
    change(data);
    assert.throws(() => calculateFaceReport(data));
  }
});

test("recomendações são condicionadas às proporções calculadas", () => {
  const data = syntheticDetection();
  data.faces[0][10].y = 0.1;
  data.faces[0][172].x = 0.36;
  data.faces[0][397].x = 0.64;
  const report = calculateFaceReport(data);
  assert.match(report.looksmaxing[0], /supera 1,45/);
  assert.match(report.looksmaxing[1], /menos de 70%/);
  assert.ok(report.score !== null && report.score < calculateFaceReport(syntheticDetection()).score!);
});

test("regiões com pontos suficientes têm índices próprios; pele, cabelo e potencial não são inventados", () => {
  const report = calculateFaceReport(syntheticDetection());
  for (const [region, value] of Object.entries(report.regions)) {
    if (["skin", "hair"].includes(region)) assert.equal(value, null);
    else assert.ok(value !== null && value >= 0 && value <= 10);
  }
  assert.equal(report.potential, null);
  assert.equal(report.regions.harmony, 10);
  const data = syntheticDetection();
  data.faces[0][300].y += 0.04;
  const changed = calculateFaceReport(data);
  assert.ok(changed.regions.eyebrows! < 10);
  assert.equal(changed.regions.nose, report.regions.nose);
});

test("pontos regionais ausentes ou degenerados resultam em não avaliado, nunca em notas de fallback", () => {
  const data = syntheticDetection();
  data.faces[0][70].x = NaN;
  data.faces[0][327] = { ...data.faces[0][98] };
  const report = calculateFaceReport(data);
  assert.equal(report.regions.eyebrows, null);
  assert.equal(report.regions.nose, null);
  assert.equal(report.regions.harmony, null);
  assert.equal(report.score, null);
});
