import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFaceReport } from "../src/lib/face-geometry";
import { ReportSchema } from "../src/lib/analysis-schema";
import { SCORE_WEIGHTS, STRUCTURE_REGION_WEIGHTS, STRUCTURE_CRITERIA, REGION_SCORE_WEIGHTS } from "../src/lib/calibration";
import { classifyPSL } from "../src/lib/score-classification";
import { expressionDetection } from "./fixtures/expressions";
import { syntheticDetection, syntheticExpressions, syntheticQuality } from "./fixtures/landmarks";

const accepted = [
  ["neutra", {}],
  ["ativação moderada isolada não é diagnóstico de expressão", { activations: Object.fromEntries(syntheticExpressions().map((e) => [e.categoryName, .65])) }],
  ["olhos naturalmente estreitos", { eyeLeft: .12, eyeRight: .12, activations: { eyeBlinkLeft: .85, eyeBlinkRight: .85 } }],
  ["olhos muito estreitos sem evidência forte de piscada", { eyeLeft: .07, eyeRight: .07, activations: { eyeBlinkLeft: .5, eyeBlinkRight: .5 } }],
  ["sobrancelhas naturalmente altas", { browGap: 1, activations: { browInnerUp: .98, browOuterUpLeft: .98, browOuterUpRight: .98 } }],
  ["um sinal forte de sobrancelha não basta", { browGap: 1.4, activations: { browInnerUp: .98 } }],
  ["lábios ligeiramente separados", { opening: .12, activations: { jawOpen: .90 } }],
  ["sorriso leve", { cornerLift: .02, activations: { mouthSmileLeft: .60, mouthSmileRight: .60 } }],
  ["leve inclinação", { tilt: 8 }],
  ["blendshape de piscada contradito por olhos abertos", { activations: { eyeBlinkLeft: .99, eyeBlinkRight: .99 } }],
] as const;

for (const [name, options] of accepted) test(`aceita captura utilizável: ${name}`, () => {
  const report = calculateFaceReport(expressionDetection(options));
  assert.equal(report.captureConfidence.reliable, true, report.captureConfidence.reasons.join(" "));
  assert.ok(report.score !== null);
  assert.equal(ReportSchema.safeParse(report).success, true);
});

const rejected = [
  ["boca amplamente aberta mesmo sem ativação", { opening: .36 }, /boca está muito aberta/],
  ["boca aberta e jawOpen forte", { opening: .20, activations: { jawOpen: .90 } }, /boca está muito aberta/],
  ["piscada direita", { eyeLeft: .06, activations: { eyeBlinkRight: .96 } }, /olho direito/],
  ["piscada esquerda assimétrica", { eyeRight: .12, activations: { eyeBlinkLeft: .85 } }, /olho esquerdo/],
  ["dois olhos fechados", { eyeLeft: .02, eyeRight: .02 }, /parece fechado ou encoberto/],
  ["sorriso bilateral forte", { cornerLift: .06, activations: { mouthSmileLeft: .91, mouthSmileRight: .91 } }, /sorriso acentuado/],
  ["sorriso unilateral forte", { cornerLift: .09, activations: { mouthSmileLeft: .96 } }, /sorriso acentuado/],
  ["sobrancelhas fortemente erguidas em conjunto", { browGap: 1.4, activations: { browInnerUp: .96, browOuterUpLeft: .96, browOuterUpRight: .96 } }, /elevação acentuada/],
  ["pose fora da faixa", { tilt: 20 }, /foto frontal/],
] as const;

for (const [name, options, reason] of rejected) test(`rejeita com motivo específico: ${name}`, () => {
  const report = calculateFaceReport(expressionDetection(options));
  assert.equal(report.captureConfidence.reliable, false);
  assert.equal(report.score, null);
  assert.equal(report.potential, null);
  assert.match(report.captureConfidence.reasons.join(" "), reason);
});

test("qualidade, metadados ausentes e regiões ocultas/incompletas continuam protegidos", () => {
  for (const change of [
    { captureQuality: { ...syntheticQuality(), detail: .001 } },
    { captureQuality: { ...syntheticQuality(), sourceFaceWidth: 100 } },
    { captureQuality: { ...syntheticQuality(), lightingImbalance: .7 } },
    { captureQuality: { ...syntheticQuality(), clippedFraction: .5 } },
    { faceExpressions: undefined }, { faceExpressions: [[]] },
    { faceExpressions: [[{ categoryName: "jawOpen", score: NaN }]] },
  ]) assert.equal(calculateFaceReport({ ...syntheticDetection(), ...change }).score, null);
  for (const index of [13, 70, 132]) {
    const data = syntheticDetection(); data.faces[0][index].x = NaN;
    const report = calculateFaceReport(data);
    assert.equal(report.score, null);
    assert.equal(report.captureConfidence.reliable, false);
  }
  const data = syntheticDetection(); data.faces[0][10].y = -1;
  assert.throws(() => calculateFaceReport(data), /incompletos ou fora da foto/);
});

test("evidência geométrica é invariante à escala e roll já normalizados", () => {
  for (const options of [{ eyeLeft: .12, eyeRight: .12 }, { eyeLeft: .06, activations: { eyeBlinkRight: .96 } }]) {
    const data = expressionDetection(options), baseline = calculateFaceReport(data);
    const angle = .15;
    data.faces[0] = data.faces[0].map(({ x, y }) => ({
      x: .51 + .8 * ((x - .5) * Math.cos(angle) - (y - .5) * Math.sin(angle)),
      y: .49 + .8 * ((x - .5) * Math.sin(angle) + (y - .5) * Math.cos(angle)),
    }));
    const report = calculateFaceReport(data);
    assert.equal(report.captureConfidence.reliable, baseline.captureConfidence.reliable);
    assert.equal(report.score, baseline.score);
  }
});

test("apenas a elegibilidade mudou: pesos, alvos, notas e PSL v3 permanecem iguais para os mesmos pontos aceitos", () => {
  assert.deepEqual(SCORE_WEIGHTS, { structure: .7, harmony: .3, presentation: 0 });
  assert.deepEqual(REGION_SCORE_WEIGHTS, { shape: .75, balance: .25 });
  assert.deepEqual(STRUCTURE_REGION_WEIGHTS, { jawline: .3, chin: .2, cheekbones: .2, eyes: .2, eyebrows: .1 });
  assert.equal(STRUCTURE_CRITERIA.length, 13);
  const neutral = calculateFaceReport(syntheticDetection());
  const data = syntheticDetection(); data.faceExpressions = [syntheticExpressions().map((entry) => ({ ...entry, score: .65 }))];
  const variation = calculateFaceReport(data);
  assert.equal(variation.score, neutral.score);
  assert.deepEqual(variation.regions, neutral.regions);
  assert.equal(classifyPSL(variation.score), classifyPSL(neutral.score));
  assert.deepEqual(variation.scoring, neutral.scoring);
});
