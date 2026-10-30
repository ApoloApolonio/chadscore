import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFaceReport } from "../src/lib/face-geometry";
import { STRUCTURE_CRITERIA } from "../src/lib/calibration";
import { classifyPSL, roundScore } from "../src/lib/score-classification";
import { compareBattleScores } from "../src/lib/mogbattle";
import { syntheticDetection, syntheticFaceMatrix, syntheticLight } from "./fixtures/landmarks";
import { ReportSchema } from "../src/lib/analysis-schema";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const H = (items: { score: number; weight: number }[]) => items.reduce((s, x) => s + x.weight, 0) / items.reduce((s, x) => s + x.weight / x.score, 0);

test("auditoria independente: 100 variantes reproduzem todos os níveis harmônicos e os pesos 70/30 sem arredondamento intermediário", () => {
  for (let i = 0; i < 100; i++) {
    const data = syntheticDetection(), p = data.faces[0];
    const step = i / 99;
    p[172].x -= .03 * step; p[397].x += .02 * step;
    p[148].x -= .02 * step; p[377].x += .015 * step;
    p[93].y += .01 * step; p[323].y += .015 * step;
    p[300].y -= .01 * step;
    const report = calculateFaceReport(data);
    assert.equal(ReportSchema.safeParse(report).success, true);
    const expectedRegions = ([
      ["jawline", "Mandíbula", .3], ["chin", "Queixo", .2], ["cheekbones", "Maçãs", .2],
      ["eyes", "Olhos", .2], ["eyebrows", "Sobrancelhas", .1],
    ] as const).map(([region, label, weight]) => {
      const shape = H(STRUCTURE_CRITERIA.filter((c) => c.region === region).map((c) => {
        const measured = report.measurements.find((m) => m.label === c.label)!.value;
        return { score: 10 / (1 + ((measured - c.target) / c.halfResponse) ** 2), weight: c.weight };
      }));
      const balance = report.scoreComponents.find((c) => c.label.startsWith(label))!.score / 10;
      const score = H([{ score: shape, weight: .75 }, { score: balance, weight: .25 }]);
      assert.equal(report.regions[region], roundScore(score));
      return { score, weight };
    });
    const structure = H(expectedRegions);
    const harmony = 10 / (1 + report.scoreComponents.reduce((sum, c) => sum + (c.error / c.tolerance) ** 2, 0) / 7);
    near(report.scoring.structure!, structure);
    near(report.scoring.harmony!, harmony);
    assert.equal(report.score, roundScore(1 / (.7 / structure + .3 / harmony)));
    assert.equal(report.regions.harmony, roundScore(harmony));
  }
});

test("mesma entrada é reprodutível, não é modificada e a ordem dos participantes não altera notas/PSL/vencedor", () => {
  const first = syntheticDetection(), second = syntheticDetection();
  second.faces[0][291].y += .025; second.faces[0][362].x += .012;
  const snapshot = JSON.stringify([first, second]);
  const a = calculateFaceReport(first), b = calculateFaceReport(second);
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(calculateFaceReport(first), a);
    assert.deepEqual(calculateFaceReport(second), b);
  }
  assert.equal(JSON.stringify([first, second]), snapshot);
  const ab = compareBattleScores(a.score, b.score), ba = compareBattleScores(b.score, a.score);
  assert.equal(ab.winner, 0); assert.equal(ba.winner, 1);
  assert.equal(ab.difference, ba.difference);
  assert.equal(classifyPSL(calculateFaceReport(first).score), classifyPSL(a.score));
  assert.equal(compareBattleScores(a.score, a.score).status, "tie");
});

test("assimetria, inclinação cantal e ângulos mantêm notas sob espelho, roll, translação e escala utilizável", () => {
  const original = syntheticDetection();
  original.faces[0][133].y += .005; original.faces[0][362].y += .008;
  original.faces[0][397].x += .015;
  const baseline = calculateFaceReport(original);
  for (const mirror of [false, true]) for (const scale of [.5, .8, 1]) for (const roll of [-.18, 0, .18]) {
    const data = structuredClone(original);
    data.faces[0] = data.faces[0].map(({ x, y }) => {
      const dx = (x - .5) * (mirror ? -1 : 1), dy = y - .5;
      return { x: .51 + scale * (dx * Math.cos(roll) - dy * Math.sin(roll)), y: .49 + scale * (dx * Math.sin(roll) + dy * Math.cos(roll)) };
    });
    const report = calculateFaceReport(data);
    assert.equal(report.score, baseline.score);
    assert.deepEqual(report.regions, baseline.regions);
    report.measurements.forEach((m, index) => near(m.value, baseline.measurements[index].value));
  }
});

test("potencial permanece faixa técnica: determinístico, limitado e dependente da geral v3, sem alterar PSL", () => {
  for (const tilt of [0, 4, 8, 12]) {
    const data = { ...syntheticDetection(), captureLight: syntheticLight(), faceMatrices: [syntheticFaceMatrix(tilt)] };
    const a = calculateFaceReport(data), b = calculateFaceReport(data);
    assert.ok(a.potentialRange);
    assert.ok(a.potentialRange.lower <= a.score! && a.potentialRange.upper >= a.score!);
    assert.ok(a.potentialRange.lower >= 0 && a.potentialRange.upper <= 10);
    assert.deepEqual(a, b);
    assert.equal(a.score, calculateFaceReport({ ...data, captureLight: undefined }).score);
    assert.equal(classifyPSL(a.score), classifyPSL(b.score));
  }
});
