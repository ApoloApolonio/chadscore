// Worker clássico: todas as bibliotecas e o modelo são servidos pela mesma origem.
// Nenhum fetch contém foto, metadados, pontos ou relatório.
self.onmessage = async ({ data }) => {
  let landmarker;
  let bitmap;
  let canvas;
  try {
    self.exports = {};
    self.importScripts("/mediapipe/vision_bundle.js");
    const { FaceLandmarker, FilesetResolver } = self.exports;
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 2,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
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
    self.postMessage({ faces: result.faceLandmarks, width, height });
  } catch {
    self.postMessage({ error: "Não foi possível iniciar o MediaPipe ou ler a foto. Verifique os arquivos locais do modelo (npm run prepare:models) e use um navegador atualizado." });
  } finally {
    bitmap?.close();
    landmarker?.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    self.close();
  }
};
