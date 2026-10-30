import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SELFIE_BYTES, validateSelfieFile } from "../src/lib/selfie";
import { faceAnalysisProvider } from "../src/lib/face-analysis";
import { syntheticDetection } from "./fixtures/landmarks";

const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function makeFile(bytes: number[], type = "image/png") {
  return new File([new Uint8Array(bytes)], "selfie", { type });
}

test("rejeita formato não permitido, mesmo com extensão de imagem", async () => {
  const file = new File(["<svg />"], "selfie.png", { type: "image/svg+xml" });
  await assert.rejects(validateSelfieFile(file), /JPG, PNG ou WebP/);
});

test("rejeita arquivo vazio", async () => {
  await assert.rejects(validateSelfieFile(makeFile([])), /vazio/);
});

test("rejeita arquivo acima de 5 MB", async () => {
  const file = new File([new Uint8Array(MAX_SELFIE_BYTES + 1)], "selfie.png", {
    type: "image/png",
  });
  await assert.rejects(validateSelfieFile(file), /no máximo 5 MB/);
});

test("rejeita conteúdo que não corresponde ao MIME", async () => {
  await assert.rejects(validateSelfieFile(makeFile([1, 2, 3])), /não corresponde/);
  await assert.rejects(
    validateSelfieFile(makeFile(pngHeader, "image/jpeg")),
    /não corresponde/,
  );
});

test("decodifica formatos permitidos e libera URLs temporárias em sucesso e erro", async (t) => {
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  let failDecode = false;
  let width = 640;
  class TestImage {
    src = "";
    naturalWidth = width;
    naturalHeight = 480;
    async decode() {
      if (failDecode) throw new Error("Corrupt image");
    }
  }
  Object.defineProperty(globalThis, "Image", { configurable: true, value: TestImage });
  const revoke = t.mock.method(URL, "revokeObjectURL");
  t.after(() => {
    if (originalImage) Object.defineProperty(globalThis, "Image", originalImage);
    else Reflect.deleteProperty(globalThis, "Image");
  });

  await validateSelfieFile(makeFile(pngHeader));
  await validateSelfieFile(makeFile([0xff, 0xd8, 0xff], "image/jpeg"));
  await validateSelfieFile(
    makeFile([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "image/webp"),
  );
  failDecode = true;
  await assert.rejects(validateSelfieFile(makeFile(pngHeader)), /Não foi possível ler/);
  failDecode = false;
  width = 0;
  await assert.rejects(validateSelfieFile(makeFile(pngHeader)), /Não foi possível ler/);
  assert.equal(revoke.mock.callCount(), 5);
});

test("cliente não processa operação já cancelada nem tenta rede", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Não deve haver chamadas de rede");
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(faceAnalysisProvider.analyze(makeFile(pngHeader), controller.signal), { name: "AbortError" });
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("cliente informa navegador incompatível sem tentar API remota", async () => {
  await assert.rejects(faceAnalysisProvider.analyze(makeFile(pngHeader)), /navegador/);
});

test("cliente usa worker local, valida pontos, trata erro e cancela liberando recursos, sem rede", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    assert.fail("Nenhuma foto pode sair via fetch");
  });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  let reply: unknown = syntheticDetection();
  let abortOnPost: AbortController | null = null;
  let terminated = 0;
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    constructor(url: string) { assert.equal(url, "/face-landmarker.worker.js"); }
    postMessage(data: { file: File }) {
      assert.ok(data.file instanceof File);
      if (abortOnPost) abortOnPost.abort();
      else queueMicrotask(() => this.onmessage?.({ data: reply }));
    }
    terminate() { terminated += 1; }
  }
  class TestImage {
    src = "";
    naturalWidth = 640;
    naturalHeight = 480;
    async decode() {}
  }
  for (const [key, value] of Object.entries({
    Worker: FakeWorker, Image: TestImage, OffscreenCanvas: class {}, createImageBitmap: () => {},
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  t.after(() => {
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const result = await faceAnalysisProvider.analyze(makeFile(pngHeader));
  assert.equal(result.report.score, 10);
  const detection = syntheticDetection();
  assert.deepEqual(result.visualization, {
    landmarks: detection.faces[0], width: detection.width, height: detection.height,
  });
  await assert.rejects(faceAnalysisProvider.analyze(makeFile([1, 2, 3])), /não corresponde/);
  assert.equal(terminated, 1, "arquivo inválido não deve criar outro worker");
  reply = {};
  await assert.rejects(faceAnalysisProvider.analyze(makeFile(pngHeader)), /pontos inválidos/);
  reply = { error: "Modelo local indisponível" };
  await assert.rejects(faceAnalysisProvider.analyze(makeFile(pngHeader)), /Modelo local indisponível/);
  abortOnPost = new AbortController();
  await assert.rejects(faceAnalysisProvider.analyze(makeFile(pngHeader), abortOnPost.signal), { name: "AbortError" });
  assert.equal(terminated, 4);
  assert.equal(fetchMock.mock.callCount(), 0);
});
