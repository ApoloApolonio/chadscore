// Worker clássico: todas as bibliotecas e o modelo são servidos pela mesma origem.
// Nenhum fetch contém foto, metadados, pontos ou relatório.
self.onmessage = async ({ data }) => {
  let landmarker;
  let segmenter;
  let segmentation;
  let bitmap;
  let canvas;
  let appearanceCanvas;
  try {
    self.exports = {};
    self.importScripts("/mediapipe/vision_bundle.js");
    const { FaceLandmarker, FilesetResolver, ImageSegmenter } = self.exports;
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 2,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
    bitmap = await createImageBitmap(data.file, { imageOrientation: "from-image" });
    if (bitmap.width * bitmap.height > 16_000_000) {
      self.postMessage({ error: "Use uma imagem de até 16 megapixels." });
      return;
    }
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, width, height);
    const result = landmarker.detect(canvas);
    let captureLight = null;
    let appearance = null;
    if (result.faceLandmarks.length === 1) {
      try {
        const { sampleFaceLight } = await import("/capture-light.mjs");
        captureLight = sampleFaceLight(context.getImageData(0, 0, width, height), result.faceLandmarks[0]);
      } catch {
        // A nota geométrica continua disponível; sem pixels confiáveis, potencial não estimado.
      }
      try {
        const points = result.faceLandmarks[0];
        const faceWidth = Math.hypot((points[454].x - points[234].x) * width, (points[454].y - points[234].y) * height);
        // Não amplia fotos pequenas. Escala de textura comparável: rosto com até 160 px.
        const appearanceScale = Math.min(1, 160 / faceWidth, 768 / Math.max(width, height));
        if (!Number.isFinite(appearanceScale) || faceWidth * appearanceScale < 120) throw new Error("Face too small");
        appearanceCanvas = new OffscreenCanvas(Math.max(1, Math.round(width * appearanceScale)), Math.max(1, Math.round(height * appearanceScale)));
        const appearanceContext = appearanceCanvas.getContext("2d", { willReadFrequently: true });
        if (!appearanceContext) throw new Error("Canvas unavailable");
        appearanceContext.drawImage(canvas, 0, 0, appearanceCanvas.width, appearanceCanvas.height);
        segmenter = await ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: "/mediapipe/selfie_multiclass_256x256.tflite", delegate: "CPU" },
          runningMode: "IMAGE", outputCategoryMask: true, outputConfidenceMasks: true,
        });
        const labels = segmenter.getLabels().map((label) => label.toLowerCase().trim().replace(/[ _]+/g, "-"));
        const skinIndex = labels.indexOf("face-skin"), hairIndex = labels.indexOf("hair");
        if (skinIndex < 0 || hairIndex < 0) throw new Error("Unsupported labels");
        segmentation = segmenter.segment(appearanceCanvas);
        const categories = segmentation.categoryMask;
        const skin = segmentation.confidenceMasks?.[skinIndex], hair = segmentation.confidenceMasks?.[hairIndex];
        if (!categories || !skin || !hair || skin.width !== categories.width || skin.height !== categories.height ||
            hair.width !== categories.width || hair.height !== categories.height) throw new Error("Invalid masks");
        const { measureAppearance } = await import("/appearance-analysis.mjs");
        appearance = measureAppearance(appearanceContext.getImageData(0, 0, appearanceCanvas.width, appearanceCanvas.height), {
          width: categories.width, height: categories.height,
          categories: categories.getAsUint8Array(), skin: skin.getAsFloat32Array(), hair: hair.getAsFloat32Array(),
          skinIndex, hairIndex,
        }, points);
      } catch {
        // Falha ou ausência de dados segmentados não modifica as outras notas.
      }
    }
    self.postMessage({
      faces: result.faceLandmarks, width, height,
      captureLight,
      appearance,
      faceMatrices: result.facialTransformationMatrixes,
    });
  } catch {
    self.postMessage({ error: "Não foi possível iniciar o MediaPipe ou ler a foto. Verifique os arquivos locais do modelo (npm run prepare:models) e use um navegador atualizado." });
  } finally {
    bitmap?.close();
    landmarker?.close();
    segmentation?.close();
    segmenter?.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    if (appearanceCanvas) { appearanceCanvas.width = 0; appearanceCanvas.height = 0; }
    self.close();
  }
};
