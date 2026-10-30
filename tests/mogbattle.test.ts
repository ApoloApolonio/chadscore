import assert from "node:assert/strict";
import { test } from "node:test";
import { compareBattleScores, battleComparisonRows } from "../src/lib/mogbattle";
import { analyzeBattlePhotos } from "../src/lib/battle-analysis";
import { calculateFaceReport } from "../src/lib/face-geometry";
import { syntheticDetection } from "./fixtures/landmarks";
import type { FaceAnalysisResponse } from "../src/lib/analysis-schema";

function response(): FaceAnalysisResponse {
  const detection = syntheticDetection();
  return { status: "completed", report: calculateFaceReport(detection), visualization: { landmarks: detection.faces[0], width: detection.width, height: detection.height } };
}

test("batalha compara as mesmas notas arredondadas do FaceScan e diferença exata em décimos", () => {
  assert.deepEqual(compareBattleScores(7.4, 6.9), { status: "winner", winner: 0, difference: .5 });
  assert.deepEqual(compareBattleScores(6.9, 7.4), { status: "winner", winner: 1, difference: .5 });
  assert.deepEqual(compareBattleScores(7.41, 7.44), { status: "tie", winner: null, difference: 0 });
  assert.deepEqual(compareBattleScores(7.4, 7.3), { status: "winner", winner: 0, difference: .1 });
  assert.equal(compareBattleScores(0, 10).winner, 1);
  for (const score of [null, NaN, Infinity, -1, 11]) {
    assert.equal(compareBattleScores(score, 8).status, "unavailable");
    assert.equal(compareBattleScores(8, score).winner, null);
  }
});

test("comparação não transforma proporções ou simetria descritiva em competição estética", () => {
  const a = response().report, b = structuredClone(a);
  a.regions.skin = null; b.regions.skin = 8;
  b.regions.eyes = 7;
  b.measurements[0].value = .1; a.measurements[0].value = 2;
  b.measurements[3].value += .2;
  const rows = battleComparisonRows(a, b);
  assert.equal(rows.filter((row) => row.kind === "score").length, 11);
  assert.equal(rows.find((row) => row.label === "Olhos")!.outcome.winner, 0);
  assert.equal(rows.find((row) => row.label === "Pele")!.outcome.winner, null);
  assert.equal(rows.find((row) => row.label.startsWith("Simetria"))!.outcome.winner, null);
  assert.ok(rows.filter((row) => row.kind === "geometry").every((row) => row.outcome.winner === null));
  b.measurements = [];
  assert.ok(battleComparisonRows(a, b).filter((row) => row.kind === "geometry").every((row) => row.values[1] === null));
});

test("orquestração usa provider compartilhado sequencial, sem inventar respostas, e reutiliza sucesso após falha", async () => {
  const files: [File, File] = [new File(["one"], "one.png"), new File(["two"], "two.png")];
  const cache = new WeakMap<File, FaceAnalysisResponse>();
  let calls = 0, fail = true, running = false;
  const provider = { async analyze(file: File) {
    assert.equal(running, false); running = true; calls++;
    await Promise.resolve(); running = false;
    if (file === files[1] && fail) throw new Error("Nenhum rosto detectado");
    return response();
  } };
  const options = { cache, provider, signal: new AbortController().signal };
  await assert.rejects(analyzeBattlePhotos(files, options), /Nenhum rosto/);
  assert.equal(calls, 2); assert.ok(cache.has(files[0])); assert.equal(cache.has(files[1]), false);
  fail = false;
  const result = await analyzeBattlePhotos(files, options);
  assert.equal(calls, 3); assert.equal(result.length, 2);
  await analyzeBattlePhotos(files, options); assert.equal(calls, 3);
  cache.delete(files[0]); await analyzeBattlePhotos(files, options); assert.equal(calls, 4);
});

test("cancelamento tardio interrompe a batalha e não coloca análise descartada em cache", async () => {
  const files: [File, File] = [new File(["one"], "one.png"), new File(["two"], "two.png")];
  const abort = new AbortController();
  const cache = new WeakMap<File, FaceAnalysisResponse>();
  let calls = 0;
  const provider = { async analyze() { calls++; abort.abort(); return response(); } };
  await assert.rejects(analyzeBattlePhotos(files, { provider, cache, signal: abort.signal }), { name: "AbortError" });
  assert.equal(calls, 1); assert.equal(cache.has(files[0]), false);
  await assert.rejects(analyzeBattlePhotos(files, { provider, cache, signal: abort.signal }), { name: "AbortError" });
  assert.equal(calls, 1);
});
