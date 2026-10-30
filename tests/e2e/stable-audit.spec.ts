import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import { syntheticDetection } from "../fixtures/landmarks";

declare global { interface Window { stableAudit: { urls: Set<string>; workers: Set<Worker>; created: number; terminated: number } } }

async function image(name = "audit-procedural.png") {
  return { name, mimeType: "image/png", buffer: await sharp({ create: { width: 320, height: 320, channels: 3, background: "#607080" } }).png().toBuffer() };
}

async function instrumentation(page: Page, mock: boolean) {
  await page.addInitScript(({ detection, mocked }) => {
    const audit = window.stableAudit = { urls: new Set<string>(), workers: new Set<Worker>(), created: 0, terminated: 0 };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = create(blob); audit.urls.add(url); return url; };
    URL.revokeObjectURL = (url) => { audit.urls.delete(url); revoke(url); };
    if (mocked) {
      class LocalWorker {
        onmessage: ((event: MessageEvent) => void) | null = null;
        constructor() { audit.created++; audit.workers.add(this as unknown as Worker); }
        postMessage({ file }: { file: File }) {
          if (file.name === "pending.png") return;
          queueMicrotask(() => this.onmessage?.(new MessageEvent("message", { data: detection })));
        }
        terminate() { if (audit.workers.delete(this as unknown as Worker)) audit.terminated++; }
      }
      window.Worker = LocalWorker as unknown as typeof Worker;
    } else {
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(url: string | URL, options?: WorkerOptions) { super(url, options); audit.created++; audit.workers.add(this); }
        terminate() { if (audit.workers.delete(this)) audit.terminated++; super.terminate(); }
      };
    }
  }, { detection: syntheticDetection(), mocked: mock });
}

/**
 * Playwright's setInputFiles uses CDP DOM.setFileInputFiles, and Chrome keeps the
 * targeted <input> in the DevTools console group. A detached React page retains
 * its ancestors, so that harness reference would mask real app retention in soak
 * measurements. Dispatch the same change event with an in-page DataTransfer.
 */
async function upload(page: Page, label: string, file: { name: string; buffer: Buffer }) {
  await page.getByLabel(label, { exact: true }).evaluate((input, { name, base64 }) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], name, { type: "image/png" }));
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { name: file.name, base64: file.buffer.toString("base64") });
}

async function disposed(page: Page) {
  await expect.poll(() => page.evaluate(() => ({ urls: window.stableAudit.urls.size, workers: window.stableAudit.workers.size })))
    .toEqual({ urls: 0, workers: 0 });
}

test("soak limitado: 25 ciclos completos + aquecimento, trocas e cancelamentos não acumulam workers/URLs/DOM", async ({ page, context }) => {
  test.setTimeout(180_000);
  await instrumentation(page, true);
  const unexpected: string[] = [], errors: string[] = [];
  context.on("request", (r) => { if (!r.url().startsWith("blob:") && (r.method() !== "GET" || new URL(r.url()).origin !== "http://127.0.0.1:3100")) unexpected.push(r.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const file = await image(), pending = await image("pending.png");
  const cycle = async (cancel: boolean) => {
    await upload(page, "Escolher selfie", file);
    await page.getByRole("button", { name: "Analisar rosto", exact: true }).click();
    await expect(page).toHaveURL(/\/resultados$/);
    await page.getByRole("button", { name: "Nova análise", exact: true }).click();
    await disposed(page);
    await page.getByRole("button", { name: "MogBattle", exact: true }).click();
    for (const index of [1, 2]) await upload(page, `Foto do participante ${index}`, file);
    await page.getByRole("button", { name: "Iniciar batalha", exact: true }).click();
    await expect(page.getByTestId("battle-outcome")).toHaveText("EMPATE");
    await page.getByRole("button", { name: "Batalhar novamente", exact: true }).click();
    await disposed(page);
    await page.getByRole("button", { name: "FaceScan", exact: true }).click();
    if (cancel) {
      await upload(page, "Escolher selfie", pending);
      await page.getByRole("button", { name: "Analisar rosto", exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.stableAudit.workers.size)).toBe(1);
      await page.getByRole("button", { name: "MogBattle", exact: true }).click();
      await disposed(page);
      await page.getByRole("button", { name: "FaceScan", exact: true }).click();
    }
  };
  await cycle(false); await cycle(false);
  const cdp = await context.newCDPSession(page);
  const collect = async () => {
    await cdp.send("Runtime.discardConsoleEntries");
    await cdp.send("HeapProfiler.collectGarbage");
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await cdp.send("HeapProfiler.collectGarbage");
  };
  await collect();
  const beforeHeap = await cdp.send("Runtime.getHeapUsage"), beforeDOM = await cdp.send("Memory.getDOMCounters");
  for (let i = 0; i < 25; i++) {
    await cycle(i % 5 === 0);
    if (i % 5 === 4) await collect();
  }
  await collect();
  const afterHeap = await cdp.send("Runtime.getHeapUsage"), afterDOM = await cdp.send("Memory.getDOMCounters");
  const state = await page.evaluate(async () => ({ created: window.stableAudit.created, terminated: window.stableAudit.terminated,
    local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length,
    caches: (await caches.keys()).length, serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length }));
  expect(state).toEqual({ created: 86, terminated: 86, local: 0, session: 0, databases: 0, caches: 0, serviceWorkers: 0 });
  console.log("AUDIT_SOAK", JSON.stringify({ ...state, heapDeltaBytes: afterHeap.usedSize - beforeHeap.usedSize,
    beforeDOM, afterDOM, domDelta: afterDOM.nodes - beforeDOM.nodes, listenerDelta: afterDOM.jsEventListeners - beforeDOM.jsEventListeners }));
  // Bounded regression checks, not proof of absence of all browser/WASM leaks.
  expect(afterHeap.usedSize - beforeHeap.usedSize).toBeLessThan(8 * 1024 * 1024);
  expect(afterDOM.nodes - beforeDOM.nodes).toBeLessThan(100);
  expect(afterDOM.jsEventListeners - beforeDOM.jsEventListeners).toBeLessThan(30);
  expect(unexpected).toEqual([]); expect(errors).toEqual([]);
});

test("MediaPipe real: oito análises sequenciais sem rosto encerram cada worker e mantêm erro reproduzível", async ({ page, context }) => {
  test.setTimeout(180_000);
  await instrumentation(page, false);
  const unexpected: string[] = [];
  context.on("request", (r) => { if (!r.url().startsWith("blob:") && (r.method() !== "GET" || new URL(r.url()).origin !== "http://127.0.0.1:3100")) unexpected.push(r.url()); });
  await page.goto("/");
  const file = await image();
  for (let i = 0; i < 8; i++) {
    await page.getByLabel(i ? "Trocar selfie" : "Escolher selfie", { exact: true }).setInputFiles(file);
    await page.getByRole("button", { name: "Analisar rosto", exact: true }).click();
    await expect(page.locator("#selfie-error")).toContainText("Nenhum rosto detectado", { timeout: 60_000 });
    await expect.poll(() => page.evaluate(() => window.stableAudit.workers.size)).toBe(0);
    await expect(page.getByTestId("overall-score")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "MogBattle", exact: true }).click();
  await disposed(page);
  expect(await page.evaluate(() => [window.stableAudit.created, window.stableAudit.terminated])).toEqual([8, 8]);
  expect(unexpected).toEqual([]);
});

for (const width of [320, 768, 1920]) test(`auditoria visual/acessibilidade básica sem redesenho em ${width}px`, async ({ page }) => {
  await instrumentation(page, true);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(5, 5, 5)");
  await expect(page.locator("body")).toHaveCSS("font-family", /Manrope/);
  await expect(page.locator("main")).toHaveCSS("background-image", /linear-gradient/);
  await page.getByRole("button", { name: "MogBattle", exact: true }).click();
  await expect(page.getByRole("button", { name: "MogBattle", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const index of [1, 2]) await expect(page.getByLabel(`Nome do participante ${index}`, { exact: true })).toBeVisible();
  await page.getByLabel("Nome do participante 1", { exact: true }).fill("<img src=x onerror=alert(1)>");
  await expect(page.locator(".battle-participant img")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".face-float").first()).toHaveCSS("animation-name", "none");
  let dialogs = 0;
  page.on("dialog", async (dialog) => { dialogs++; await dialog.dismiss(); });
  const file = await image();
  for (const index of [1, 2]) await page.getByLabel(`Foto do participante ${index}`, { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Iniciar batalha", exact: true }).click();
  await expect(page.getByTestId("battle-outcome")).toHaveText("EMPATE");
  await expect(page.locator(".battle-person-name").first()).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(dialogs).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacidade e limites");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

for (const stage of ["bundle", "initialization", "detection"]) test(`worker real: falha em ${stage} informa erro sem relatório e encerra o worker`, async ({ page, context }) => {
  await instrumentation(page, false);
  await context.route("**/mediapipe/vision_bundle.js", (route) => route.fulfill({ contentType: "application/javascript", body: stage === "bundle"
    ? "throw new Error('Controlled bundle initialization failure');"
    : `self.exports={FilesetResolver:{forVisionTasks:async()=>({})},FaceLandmarker:{createFromOptions:async()=>{
        ${stage === "initialization" ? "throw new Error('Controlled model initialization failure');" : "return {detect(){throw new Error('Controlled inference failure')},close(){}};"}
      }}};` }));
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await image());
  await page.getByRole("button", { name: "Analisar rosto", exact: true }).click();
  await expect(page.locator("#selfie-error")).toContainText("Não foi possível iniciar o MediaPipe");
  await expect(page.getByTestId("overall-score")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.stableAudit.workers.size)).toBe(0);
  await page.getByRole("button", { name: "MogBattle", exact: true }).click();
  await disposed(page);
  expect(await page.evaluate(() => [window.stableAudit.created, window.stableAudit.terminated])).toEqual([1, 1]);
});
