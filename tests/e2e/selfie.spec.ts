import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { syntheticDetection } from "../fixtures/landmarks";

async function syntheticImage() {
  return {
    name: "synthetic-test-image.png",
    mimeType: "image/png",
    buffer: await sharp({ create: { width: 256, height: 256, channels: 3, background: "green" } }).png().toBuffer(),
  };
}

async function mockLocalDetection(page: Page, result: unknown) {
  // Pontos sintéticos só neste teste: não existe fallback de medições na aplicação.
  await page.addInitScript((reply) => {
    class TestWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage() { queueMicrotask(() => this.onmessage?.(new MessageEvent("message", { data: reply }))); }
      terminate() {}
    }
    window.Worker = TestWorker as unknown as typeof Worker;
  }, result);
}

test("consentimento local é obrigatório e reiniciado ao trocar a foto", async ({ page }) => {
  await mockLocalDetection(page, { error: "Falha de detecção exclusiva de teste." });
  await page.goto("/");
  const analyze = page.getByRole("button", { name: "Analisar meu rosto" });
  const consent = page.getByRole("checkbox");
  await expect(analyze).toBeDisabled();
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
  await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toBeVisible();
  await expect(analyze).toBeDisabled();
  await consent.check();
  await expect(analyze).toBeEnabled();
  await consent.uncheck();
  await expect(analyze).toBeDisabled();
  await consent.check();
  await page.getByLabel("Trocar selfie", { exact: true }).setInputFiles(await syntheticImage());
  await expect(consent).not.toBeChecked();
  await expect(analyze).toBeDisabled();
  await consent.check();
  await analyze.click();
  await expect(page.locator("#selfie-error")).toHaveText("Falha de detecção exclusiva de teste.");
  await page.getByRole("button", { name: "Remover foto" }).click();
  await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toHaveCount(0);
  await expect(consent).not.toBeChecked();
});

test("geometria local gera resultados transparentes sem envio nem armazenamento", async ({ page }) => {
  await mockLocalDetection(page, syntheticDetection());
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) uploads.push(request.url());
  });
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analisar meu rosto" }).click();
  await expect(page).toHaveURL(/\/resultados$/);
  for (const name of ["Simetria facial aparente", "Mandíbula", "Olhos", "Proporções visuais", "Indicadores calculados", "Como a pontuação é calculada"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Não é uma nota científica de beleza/)).toBeVisible();
  await expect(page.locator("img")).toHaveCount(0);
  expect(uploads).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })))
    .toEqual({ local: 0, session: 0 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nenhum relatório nesta sessão" })).toBeVisible();
});

test("arquivo inválido não pode ser analisado", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles({
    name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("not a real image"),
  });
  await expect(page.locator("#selfie-error")).toContainText("não corresponde");
  await expect(page.getByRole("button", { name: "Analisar meu rosto" })).toBeDisabled();
});

test("MediaPipe real carrega apenas arquivos da mesma origem e rejeita imagem sem rosto", async ({ page }) => {
  const requests: { url: string; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analisar meu rosto" }).click();
  await expect(page.locator("#selfie-error")).toContainText("Nenhum rosto detectado", { timeout: 60_000 });
  await expect(page).not.toHaveURL(/\/resultados$/);
  expect(requests.some((request) => request.url.includes("face_landmarker.task"))).toBe(true);
  expect(requests.filter((request) => !request.url.startsWith("blob:") &&
    (request.method !== "GET" || new URL(request.url).origin !== "http://127.0.0.1:3100"))).toEqual([]);
});

test("endpoint antigo não recebe mais fotos", async ({ request }) => {
  const response = await request.post("/api/analyze", { data: "no actual photo" });
  expect(response.status()).toBe(404);
});

test("build serve modelo, runtime, WASM e política do worker para hospedagem Next.js", async ({ request }) => {
  const worker = await request.get("/face-landmarker.worker.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-security-policy"]).toContain("connect-src 'self'");
  expect(worker.headers()["content-security-policy"]).toContain("'wasm-unsafe-eval'");
  const runtime = await request.get("/mediapipe/vision_bundle.js");
  expect(runtime.status()).toBe(200);
  expect(runtime.headers()["content-type"]).toMatch(/javascript/);
  const model = await request.get("/mediapipe/face_landmarker.task");
  expect(model.status()).toBe(200);
  expect(createHash("sha256").update(await model.body()).digest("hex"))
    .toBe("64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff");
  for (const variant of ["vision_wasm_internal", "vision_wasm_nosimd_internal"]) {
    const loader = await request.get(`/mediapipe/wasm/${variant}.js`);
    expect(loader.status()).toBe(200);
    const wasm = await request.get(`/mediapipe/wasm/${variant}.wasm`);
    expect(wasm.status()).toBe(200);
    expect(wasm.headers()["content-type"]).toContain("application/wasm");
    expect((await wasm.body()).subarray(0, 4)).toEqual(Buffer.from([0, 0x61, 0x73, 0x6d]));
  }
});
