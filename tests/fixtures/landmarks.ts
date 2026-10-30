import type { LandmarkDetection, Point } from "../../src/lib/face-geometry";

/** Geometria sintética exclusiva dos testes, nunca usada pela aplicação. */
export function syntheticDetection(): LandmarkDetection {
  const points: Point[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (index: number, x: number, y: number) => { points[index] = { x, y }; };
  set(10, 0.5, 0.15); set(152, 0.5, 0.85);
  set(168, 0.5, 0.36); set(1, 0.5, 0.48); set(2, 0.5, 0.55);
  set(33, 0.34, 0.4); set(263, 0.66, 0.4);
  set(133, 0.44, 0.4); set(362, 0.56, 0.4);
  set(159, 0.39, 0.38); set(145, 0.39, 0.42);
  set(386, 0.61, 0.38); set(374, 0.61, 0.42);
  set(234, 0.25, 0.5); set(454, 0.75, 0.5);
  set(172, 0.32, 0.7); set(397, 0.68, 0.7);
  set(61, 0.4, 0.65); set(291, 0.6, 0.65);
  return { faces: [points], width: 1000, height: 1000 };
}
