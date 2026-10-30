import type { FaceVisualization } from "./analysis-schema";

type Edge = readonly [number, number];
const chain = (...indices: number[]): Edge[] => indices.slice(1).map((end, i) => [indices[i], end]);

// MediaPipe topology, Copyright The MediaPipe Authors, Apache-2.0.
// Contours: @mediapipe/tasks-vision 0.10.21 FaceLandmarker constants.
// Nose: mediapipe/python/solutions/face_mesh_connections.py (FACEMESH_NOSE).
// https://www.apache.org/licenses/LICENSE-2.0
// Static chains keep the inference runtime out of the results bundle.
export const FACE_REGIONS = [
  { key: "eyes", label: "Olhos", edges: [
    ...chain(263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466,263),
    ...chain(33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,33),
  ] },
  { key: "eyebrows", label: "Sobrancelhas", edges: [
    ...chain(276,283,282,295,285), ...chain(300,293,334,296,336),
    ...chain(46,53,52,65,55), ...chain(70,63,105,66,107),
  ] },
  { key: "nose", label: "Nariz", edges: [
    ...chain(168,6,197,195,5,4,1,19,94,2),
    ...chain(98,97,2,326,327,294,278,344,440,275,4,45,220,115,48,64,98),
  ] },
  { key: "lips", label: "Lábios", edges: [
    ...chain(61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,61),
    ...chain(78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191,78),
  ] },
  { key: "jawline", label: "Mandíbula", edges: chain(172,136,150,149,176,148,152,377,400,378,379,365,397) },
  { key: "outline", label: "Contorno facial", edges: chain(10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10) },
] as const;

export function overlayPoint(point: FaceVisualization["landmarks"][number] | undefined, width: number, height: number) {
  // Never clamp/fabricate positions, or connect a valid point to an off-image point.
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
  return { x: point.x * width, y: point.y * height };
}
