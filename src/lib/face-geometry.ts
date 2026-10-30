import type { FaceReport } from "./analysis-schema";

export type Point = { x: number; y: number };
export type LandmarkDetection = { faces: Point[][]; width: number; height: number };

// Índices da topologia Face Mesh do MediaPipe (não representam medidas ósseas).
export const SYMMETRY_PAIRS = [
  [33, 263], [133, 362], [159, 386], [145, 374],
  [234, 454], [172, 397], [61, 291],
] as const;

export const SCORING_CRITERIA = [
  { label: "Reflexão de 7 pares de pontos", weight: 0.60, tolerance: 0.08 },
  { label: "Equilíbrio das larguras dos olhos", weight: 0.25, tolerance: 0.30 },
  { label: "Equilíbrio dos lados do contorno mandibular", weight: 0.15, tolerance: 0.30 },
] as const;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const difference = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b);
const percent = (n: number) => `${(100 * n).toFixed(1)}%`;

export function scoreFromErrors(errors: readonly number[]) {
  if (errors.length !== 3 || errors.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error("Indicadores insuficientes para calcular a pontuação.");
  }
  const components = SCORING_CRITERIA.map((criterion, index) => ({
    ...criterion,
    error: errors[index],
    score: 100 * Math.max(0, 1 - errors[index] / criterion.tolerance),
  }));
  return {
    score: Math.round(components.reduce((sum, item) => sum + item.weight * item.score, 0)),
    components,
  };
}

/** Geometria pura: coordenadas em pixels, sem rede, inferência de atributos ou persistência. */
export function calculateFaceReport({ faces, width, height }: LandmarkDetection): FaceReport {
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

  const mirrorError = SYMMETRY_PAIRS.reduce((sum, [left, right]) =>
    sum + Math.hypot(p[left].x + p[right].x - 2 * axis, p[left].y - p[right].y) / faceWidth, 0) / SYMMETRY_PAIRS.length;
  const eyeError = difference(leftEyeWidth, rightEyeWidth);
  const jawError = difference(leftJaw, rightJaw);
  const aspect = faceHeight / faceWidth;
  const jawRatio = Math.abs(p[397].x - p[172].x) / faceWidth;
  const eyeGap = distance(p[133], p[362]) / faceWidth;
  const mouthRatio = distance(p[61], p[291]) / faceWidth;
  const lowerFraction = (p[152].y - p[2].y) / faceHeight;
  const { score, components } = scoreFromErrors([mirrorError, eyeError, jawError]);

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
    score,
    summary: "Índice subjetivo calculado somente pelo equilíbrio de pontos bilaterais nesta imagem. As proporções são descritivas e não aumentam nem reduzem a nota. Não é uma nota científica de beleza.",
    symmetry: `Erro médio de reflexão: ${percent(mirrorError)} da largura facial, usando 7 pares de pontos e eixo definido por testa, ponte nasal e queixo. Menor erro significa maior equilíbrio nesta projeção, não maior beleza.`,
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
      { label: "Erro médio de reflexão", value: 100 * mirrorError, unit: "%", method: "Média da distância entre cada ponto e a reflexão do par / largura facial × 100. Pares: 33–263, 133–362, 159–386, 145–374, 234–454, 172–397, 61–291; eixo médio de 10, 168 e 152." },
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
