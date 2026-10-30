import type { FaceReport } from "./analysis-schema";
import { roundScore } from "./score-classification";
import { estimateCapturePotential, faceTiltDegrees } from "./capture-potential";
import { calculateAppearanceScores } from "./appearance-scores";
import { CALIBRATION_VERSION, geometricResponse, rms } from "./calibration";

export type Point = { x: number; y: number };
export type LandmarkDetection = {
  faces: Point[][]; width: number; height: number;
  captureLight?: unknown;
  faceMatrices?: unknown;
  appearance?: unknown;
};

// Índices da topologia Face Mesh do MediaPipe (não representam medidas ósseas).
export const SYMMETRY_PAIRS = [
  [33, 263], [133, 362], [159, 386], [145, 374],
  [234, 454], [172, 397], [61, 291],
] as const;

export const SCORING_CRITERIA = [
  { key: "eyes", label: "Olhos: reflexão, largura e abertura relativa", weight: 1 / 7, tolerance: 0.08 },
  { key: "eyebrows", label: "Sobrancelhas: reflexão regional", weight: 1 / 7, tolerance: 0.08 },
  { key: "nose", label: "Nariz: reflexão regional", weight: 1 / 7, tolerance: 0.08 },
  { key: "lips", label: "Lábios: reflexão regional", weight: 1 / 7, tolerance: 0.08 },
  { key: "jawline", label: "Mandíbula: reflexão e lados do contorno", weight: 1 / 7, tolerance: 0.08 },
  { key: "chin", label: "Queixo: reflexão regional", weight: 1 / 7, tolerance: 0.08 },
  { key: "cheekbones", label: "Maçãs do rosto: reflexão regional", weight: 1 / 7, tolerance: 0.08 },
] as const;

/** Pares bilaterais: sem proporções ideais, etnia ou avaliação de estrutura óssea. */
export const REGIONAL_PAIRS = {
  eyebrows: [[70, 300], [63, 293], [105, 334]],
  nose: [[98, 327], [129, 358]],
  lips: [[61, 291], [40, 270], [91, 321]],
  chin: [[148, 377], [149, 378], [176, 400]],
  cheekbones: [[93, 323], [132, 361], [234, 454]],
} as const;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const difference = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b);
const percent = (n: number) => `${(100 * n).toFixed(1)}%`;

export function scoreFromErrors(errors: readonly number[]) {
  if (errors.length !== SCORING_CRITERIA.length || errors.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error("Indicadores insuficientes para calcular a pontuação.");
  }
  const components = SCORING_CRITERIA.map((criterion, index) => ({
    label: criterion.label, weight: criterion.weight, tolerance: criterion.tolerance,
    error: errors[index],
    score: geometricResponse(errors[index], criterion.tolerance),
  }));
  return {
    // Média harmônica: uma região menos equilibrada não desaparece na média de regiões perfeitas.
    score: roundScore(10 / (1 + components.reduce((sum, item) => sum + item.weight * (item.error / item.tolerance) ** 2, 0))),
    components,
  };
}

/** Geometria pura: coordenadas em pixels, sem rede, inferência de atributos ou persistência. */
export function calculateFaceReport({ faces, width, height, captureLight, faceMatrices, appearance }: LandmarkDetection): FaceReport {
  if (faces.length !== 1) {
    throw new Error(faces.length === 0
      ? "Nenhum rosto detectado. Use uma selfie nítida, de frente e bem iluminada."
      : "Foi detectado mais de um rosto. Escolha uma selfie apenas sua.");
  }
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("Dimensões de imagem inválidas.");
  }
  const landmarks = faces[0];
  if (landmarks.length < 468) throw new Error("Não foram detectados pontos faciais suficientes.");
  const required = [...new Set([1, 2, 10, 152, 168, ...SYMMETRY_PAIRS.flat()])];
  const pixels: Record<number, Point> = {};
  for (const index of required) {
    const point = landmarks[index];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      throw new Error("Pontos faciais incompletos ou fora da foto. Evite cortar o rosto.");
    }
    pixels[index] = { x: point.x * width, y: point.y * height };
  }

  // Remove somente a rotação no plano da imagem. Não corrige perspectiva 3D.
  const eyeSpan = distance(pixels[33], pixels[263]);
  if (eyeSpan < 40) throw new Error("O rosto está pequeno demais. Aproxime a câmera sem cortar o rosto.");
  const ex = { x: (pixels[263].x - pixels[33].x) / eyeSpan, y: (pixels[263].y - pixels[33].y) / eyeSpan };
  const ey = { x: -ex.y, y: ex.x };
  if ((pixels[152].x - pixels[10].x) * ey.x + (pixels[152].y - pixels[10].y) * ey.y < 0) {
    ey.x *= -1;
    ey.y *= -1;
  }
  const origin = { x: (pixels[33].x + pixels[263].x) / 2, y: (pixels[33].y + pixels[263].y) / 2 };
  const aligned: Record<number, Point> = {};
  for (const index of required) {
    const dx = pixels[index].x - origin.x;
    const dy = pixels[index].y - origin.y;
    aligned[index] = { x: dx * ex.x + dy * ex.y, y: dx * ey.x + dy * ey.y };
  }
  const p = aligned;
  const faceWidth = Math.abs(p[454].x - p[234].x);
  const faceHeight = p[152].y - p[10].y;
  if (faceWidth < 80 || faceHeight < 100 || faceHeight < height * 0.15 ||
      p[2].y <= p[10].y || p[2].y >= p[152].y) {
    throw new Error("O enquadramento ou os pontos detectados não permitem medidas estáveis. Use uma foto de frente e mais próxima.");
  }
  const axis = (p[10].x + p[168].x + p[152].x) / 3;
  if (Math.abs(p[1].x - axis) / faceWidth > 0.16) {
    throw new Error("O rosto parece virado ou os pontos estão inconsistentes. Tente outra selfie de frente.");
  }
  const leftEyeWidth = distance(p[33], p[133]);
  const rightEyeWidth = distance(p[362], p[263]);
  const leftJaw = distance(p[172], p[152]);
  const rightJaw = distance(p[397], p[152]);
  if (Math.min(leftEyeWidth, rightEyeWidth, leftJaw, rightJaw) < 5) {
    throw new Error("Os pontos dos olhos ou do contorno não são confiáveis. Escolha outra foto.");
  }
  if (distance(p[159], p[145]) / leftEyeWidth < 0.08 ||
      distance(p[386], p[374]) / rightEyeWidth < 0.08) {
    throw new Error("Os olhos parecem fechados ou encobertos. Use uma foto com os dois olhos visíveis.");
  }

  const mirrorError = rms(SYMMETRY_PAIRS.map(([left, right]) =>
    Math.hypot(p[left].x + p[right].x - 2 * axis, p[left].y - p[right].y) / faceWidth));
  const eyeError = difference(leftEyeWidth, rightEyeWidth);
  const jawError = difference(leftJaw, rightJaw);
  const aspect = faceHeight / faceWidth;
  const jawRatio = Math.abs(p[397].x - p[172].x) / faceWidth;
  const eyeGap = distance(p[133], p[362]) / faceWidth;
  const mouthRatio = distance(p[61], p[291]) / faceWidth;
  const lowerFraction = (p[152].y - p[2].y) / faceHeight;
  const presentation = calculateAppearanceScores(appearance);

  const matrices = Array.isArray(faceMatrices) ? faceMatrices : [];
  const tilt = matrices.length === 1 ? faceTiltDegrees(matrices[0]) : null;
  // Não interpreta perspectiva pronunciada como característica permanente do rosto.
  const geometryReliable = tilt !== null && tilt <= 15;

  function regionalError(pairs: readonly (readonly [number, number])[]): number | null {
    if (!geometryReliable) return null;
    const points: { left: Point; right: Point }[] = [];
    const align = (index: number): Point | null => {
      const point = landmarks[index];
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
          point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
      const dx = point.x * width - origin.x;
      const dy = point.y * height - origin.y;
      return { x: dx * ex.x + dy * ex.y, y: dx * ey.x + dy * ey.y };
    };
    for (const [leftIndex, rightIndex] of pairs) {
      const left = align(leftIndex);
      const right = align(rightIndex);
      // Pares colapsados/incompletos não recebem uma nota fictícia de simetria.
      if (!left || !right || distance(left, right) < faceWidth * 0.03) return null;
      points.push({ left, right });
    }
    const localWidth = Math.max(...points.map(({ left, right }) => Math.abs(left.x - right.x)));
    if (localWidth < 8) return null;
    return rms(points.map(({ left, right }) =>
      Math.hypot(left.x + right.x - 2 * axis, left.y - right.y) / localWidth));
  }

  const eyeReflection = regionalError(SYMMETRY_PAIRS.slice(0, 4));
  const eyeOpeningDifference = difference(distance(p[159], p[145]) / leftEyeWidth, distance(p[386], p[374]) / rightEyeWidth);
  const jawReflection = regionalError([[172, 397]]);
  const errors = [
    eyeReflection === null ? null : rms([eyeReflection, eyeError, eyeOpeningDifference]),
    regionalError(REGIONAL_PAIRS.eyebrows), regionalError(REGIONAL_PAIRS.nose), regionalError(REGIONAL_PAIRS.lips),
    jawReflection === null ? null : rms([jawReflection, jawError]),
    regionalError(REGIONAL_PAIRS.chin), regionalError(REGIONAL_PAIRS.cheekbones),
  ];
  const regions = Object.fromEntries(SCORING_CRITERIA.map((criterion, i) => [criterion.key,
    errors[i] === null ? null : roundScore(geometricResponse(errors[i]!, criterion.tolerance) / 10),
  ])) as Record<(typeof SCORING_CRITERIA)[number]["key"], number | null>;
  const calibrated = errors.every((error) => error !== null) ? scoreFromErrors(errors as number[]) : null;
  const score = calibrated?.score ?? null;
  const components = calibrated?.components ?? [];
  const potentialRange = estimateCapturePotential(score, {
    landmarks, width, height, light: captureLight, matrices: faceMatrices,
  });

  const looksmaxing = [
    aspect > 1.45
      ? "A altura/largura projetada supera 1,45 nesta foto. Se quiser equilibrar visualmente um contorno alongado, experimente armações ou penteados com mais largura lateral, sem obrigação de mudar nada."
      : aspect < 1.15
        ? "A altura/largura projetada é inferior a 1,15 nesta foto. Se desejar um efeito visual mais alongado, experimente penteados com volume no topo ou armações menos largas."
        : "A altura/largura projetada fica entre 1,15 e 1,45 nesta foto. Experimente diferentes armações e penteados conforme seu gosto; essa faixa não é um padrão de beleza.",
    jawRatio < 0.70
      ? "O contorno mandibular projetado mede menos de 70% da largura facial. Se você usa barba e quer um efeito visual mais largo nessa região, pode experimentar acabamento com algum volume lateral. Não é uma medida óssea."
      : "O contorno mandibular projetado mede pelo menos 70% da largura facial. Se você usa barba, pode experimentar acabamento uniforme para acompanhar o contorno visível, sem técnicas para modificar os ossos.",
    mirrorError > 0.025 || eyeError > 0.08
      ? "O erro de reflexão supera 2,5% da largura ou a diferença das larguras dos olhos supera 8%. Antes de interpretar isso, refaça a foto com câmera centralizada, luz difusa e expressão relaxada; pode ser efeito da captura."
      : "Os desvios bilaterais estão abaixo dos limiares de sugestão (reflexão até 2,5% e olhos até 8%). Mantenha luz difusa e câmera centralizada para capturas mais comparáveis; não há garantia de melhora de nota.",
  ];

  return {
    calibrationVersion: CALIBRATION_VERSION,
    score,
    potential: potentialRange?.upper ?? null,
    potentialRange,
    regions: {
      ...regions,
      skin: presentation.skin,
      hair: presentation.hair,
      harmony: score,
    },
    summary: "Índice subjetivo das sete regiões geométricas, normalizadas pela própria região. Não é uma nota científica de beleza. Captura insuficiente ou região ausente não recebe uma nota substituta.",
    symmetry: `Erro RMS de reflexão: ${percent(mirrorError)} da largura facial. A pontuação regional usa a largura da própria região, sem padrão demográfico de proporções.`,
    jawline: `Largura aparente do contorno inferior/largura facial: ${jawRatio.toFixed(2)}. Diferença entre distâncias dos dois lados ao queixo: ${percent(jawError)}. Não estima definição, gordura, ângulo ou estrutura óssea da mandíbula.`,
    eyes: `Diferença relativa das larguras entre cantos dos olhos: ${percent(eyeError)}. Espaço entre cantos internos/largura facial: ${eyeGap.toFixed(2)}. Não mede saúde, visão ou formato ocular ideal.`,
    proportions: `Altura da malha facial/largura: ${aspect.toFixed(2)}. Largura da boca/largura facial: ${mouthRatio.toFixed(2)}. Trecho base do nariz–queixo/altura da malha: ${percent(lowerFraction)}. O topo da malha não é a linha do cabelo.`,
    looksmaxing,
    limitations: [
      "Mede somente projeções 2D estimadas pelo MediaPipe; não usa profundidade, milímetros, razão áurea ou padrões universais de beleza.",
      "A correção alinha os cantos externos dos olhos, mas não corrige rotação lateral, inclinação para cima/baixo, perspectiva ou lente. O filtro de pose é apenas heurístico.",
      "Iluminação, expressão, maquiagem e oclusões podem deslocar os pontos. A detecção não fornece precisão clínica nem garante que todos os rostos sejam detectados.",
      "Os pesos e tolerâncias são escolhas transparentes de produto, sem validação científica. Simetria não determina atratividade, saúde ou valor pessoal.",
    ],
    measurements: [
      { label: "Erro RMS de reflexão", value: 100 * mirrorError, unit: "%", method: "Raiz da média dos quadrados da distância entre cada ponto e a reflexão do par / largura facial × 100. Pares: 33–263, 133–362, 159–386, 145–374, 234–454, 172–397, 61–291; eixo médio de 10, 168 e 152. As notas usam normalização regional." },
      { label: "Diferença de largura dos olhos", value: 100 * eyeError, unit: "%", method: "|dist(33,133) − dist(362,263)| / maior largura × 100." },
      { label: "Diferença dos lados do contorno mandibular", value: 100 * jawError, unit: "%", method: "|dist(172,152) − dist(397,152)| / maior distância × 100." },
      { label: "Altura/largura da malha facial", value: aspect, unit: "razão", method: "Altura alinhada 10–152 / largura alinhada 234–454; não mede linha do cabelo." },
      { label: "Largura mandibular/largura facial", value: jawRatio, unit: "razão", method: "Largura alinhada 172–397 / largura alinhada 234–454 (contorno projetado)." },
      { label: "Espaço interno dos olhos/largura facial", value: eyeGap, unit: "razão", method: "Distância 133–362 / largura alinhada 234–454." },
      { label: "Largura da boca/largura facial", value: mouthRatio, unit: "razão", method: "Distância 61–291 / largura alinhada 234–454." },
      { label: "Trecho base do nariz–queixo/altura facial", value: 100 * lowerFraction, unit: "%", method: "Altura alinhada 2–152 / altura alinhada 10–152 × 100." },
    ],
    scoreComponents: components,
  };
}
