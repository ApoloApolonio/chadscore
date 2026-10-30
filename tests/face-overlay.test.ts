import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { FACE_REGIONS, overlayPoint } from "../src/lib/face-overlay";
import { FaceVisualizationSchema } from "../src/lib/analysis-schema";
import { syntheticDetection } from "./fixtures/landmarks";

test("topologia estática coincide com contornos oficiais sem importar o runtime no cliente", () => {
  const require = createRequire(import.meta.url);
  const { FaceLandmarker: sdk } = require("@mediapipe/tasks-vision");
  const canonical = (edges: readonly (readonly number[])[]) => edges.map(([a, b]) => [a, b].sort((x, y) => x - y).join("-")).sort();
  for (const [key, constants] of [
    ["eyes", ["LEFT_EYE", "RIGHT_EYE"]], ["eyebrows", ["LEFT_EYEBROW", "RIGHT_EYEBROW"]],
    ["lips", ["LIPS"]], ["outline", ["FACE_OVAL"]],
  ] as const) {
    assert.deepEqual(canonical(FACE_REGIONS.find((r) => r.key === key)!.edges),
      canonical(constants.flatMap((name) => sdk[`FACE_LANDMARKS_${name}`].map(({ start, end }: { start: number; end: number }) => [start, end]))));
  }
  const outline = new Set(canonical(FACE_REGIONS.find((r) => r.key === "outline")!.edges));
  for (const edge of canonical(FACE_REGIONS.find((r) => r.key === "jawline")!.edges)) assert.ok(outline.has(edge));
  for (const { edges } of FACE_REGIONS) for (const edge of edges) {
    for (const index of edge) assert.ok(Number.isInteger(index) && index >= 0 && index < 468);
  }
});

test("projeção respeita razão de aspecto e ignora pontos ausentes/inválidos sem os deslocar", () => {
  assert.deepEqual(overlayPoint({ x: 0.25, y: 0.75 }, 800, 1200), { x: 200, y: 900 });
  assert.deepEqual(overlayPoint({ x: 0.25, y: 0.75 }, 1200, 800), { x: 300, y: 600 });
  for (const point of [undefined, { x: -0.1, y: 0.5 }, { x: 0.5, y: 1.1 }, { x: NaN, y: 0.5 }]) {
    assert.equal(overlayPoint(point, 800, 1200), null);
  }
});

test("payload contém apenas pontos e dimensões finitos; aceita 468 e 478 pontos", () => {
  const detection = syntheticDetection();
  const payload = { landmarks: detection.faces[0], width: detection.width, height: detection.height };
  assert.ok(FaceVisualizationSchema.safeParse(payload).success);
  assert.ok(FaceVisualizationSchema.safeParse({ ...payload, landmarks: payload.landmarks.slice(0, 468) }).success);
  for (const invalid of [{ ...payload, width: 0 }, { ...payload, width: 1281 },
    { ...payload, landmarks: [] }, { ...payload, photo: "not-allowed" },
    { ...payload, landmarks: payload.landmarks.map(() => ({ x: Infinity, y: 0.5 })) }]) {
    assert.equal(FaceVisualizationSchema.safeParse(invalid).success, false);
  }
});
