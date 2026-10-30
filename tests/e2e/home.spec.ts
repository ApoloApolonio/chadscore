import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import { syntheticDetection } from "../fixtures/landmarks";

declare global {
  interface Window {
    cameraTest: { calls: number; stopped: number; release?: () => void };
  }
}

async function mockCamera(page: Page, mode: "success" | "denied" | "missing" | "pending" | "unsupported" = "success") {
  await page.addInitScript((scenario) => {
    window.cameraTest = { calls: 0, stopped: 0 };
    const getUserMedia = async (constraints: MediaStreamConstraints) => {
      window.cameraTest.calls++;
      if (constraints.audio !== false) throw new Error("Audio must be disabled");
      if (scenario === "denied") throw new DOMException("Denied", "NotAllowedError");
      if (scenario === "missing") throw new DOMException("No camera", "NotFoundError");
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext("2d")!;
      const media = canvas.captureStream(12);
      const timer = setInterval(() => { ctx.fillStyle = "#405060"; ctx.fillRect(0, 0, 640, 480); }, 80);
      for (const track of media.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { window.cameraTest.stopped++; clearInterval(timer); stop(); };
      }
      if (scenario === "pending") await new Promise<void>((resolve) => { window.cameraTest.release = resolve; });
      return media;
    };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: scenario === "unsupported" ? undefined : { getUserMedia } });
  }, mode);
}

async function openCamera(page: Page) {
  await page.getByRole("button", { name: "Tirar foto", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

for (const width of [360, 1440]) {
  test(`início mínimo acessível por teclado e galeria local em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockCamera(page);
    const remote: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith("blob:") && (r.method() !== "GET" || new URL(r.url()).origin !== "http://127.0.0.1:3100")) remote.push(r.url()); });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "ChadScore." })).toBeVisible();
    await expect(page.locator("main")).toHaveCSS("background-color", "rgb(5, 5, 5)");
    await expect(page.locator(".brand-header")).toHaveCSS("text-align", "center");
    await expect(page.locator("footer, .glass-card")).toHaveCount(0);
    await expect(page.locator("#selfie-panel > .home-card")).toHaveCount(2);
    for (const card of await page.locator(".home-card").all()) {
      await expect(card).toHaveCSS("border-radius", "28px");
      await expect(card).toHaveCSS("background-color", "rgb(17, 18, 22)");
      await expect(card).toHaveCSS("backdrop-filter", "blur(12px)");
      await expect(card).not.toHaveCSS("box-shadow", "none");
      const bounds = (await card.boundingBox())!;
      expect(bounds.width).toBeCloseTo(Math.min(width - (width < 640 ? 40 : 64), 576), 0);
      expect(bounds.x + bounds.width / 2).toBeCloseTo(width / 2, 0);
    }
    const modes = (await page.getByRole("group", { name: "Modo de análise" }).boundingBox())!;
    const portraitCard = (await page.locator(".home-face-card").boundingBox())!;
    const actionsCard = (await page.locator(".home-actions-card").boundingBox())!;
    expect(portraitCard.y - (modes.y + modes.height)).toBeLessThanOrEqual(24);
    expect(actionsCard.y - (portraitCard.y + portraitCard.height)).toBeCloseTo(18, 0);
    await expect(page.locator(".home-face-card svg")).toHaveCount(1);
    await expect(page.locator(".face-illustration")).toHaveAttribute("data-illustration", "stylized-male");
    await expect(page.locator(".face-illustration")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".face-illustration image")).toHaveCount(0);
    expect(await page.locator(".illustration-points circle").count()).toBeGreaterThan(100);
    await expect(page.locator(".home-actions-card button")).toHaveCount(3);
    await expect(page.locator("#selfie-panel").getByRole("button")).toHaveCount(3);
    await expect(page.locator("main p:not(.sr-only), main details, input[type=checkbox], footer")).toHaveCount(0);
    expect((await page.locator("main").innerText()).replace(/\s+/g, " ").trim()).toBe("ChadScore. FaceScan MogBattle Tirar foto Selecionar foto Analisar rosto");
    const camera = page.getByRole("button", { name: "Tirar foto", exact: true });
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "FaceScan", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "MogBattle", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(camera).toBeFocused();
    await page.keyboard.press("Tab");
    const select = page.getByRole("button", { name: "Selecionar foto", exact: true });
    await expect(select).toBeFocused();
    await expect(select).toHaveCSS("background-color", "rgb(140, 203, 255)");
    await expect(select).toHaveCSS("color", "rgb(0, 0, 0)");
    await expect(select).not.toHaveCSS("box-shadow", "none");
    await expect(select).toHaveCSS("transition-duration", /0\.18s/);
    await select.hover();
    await expect(select).toHaveCSS("filter", "brightness(1.06)");
    await page.mouse.move(0, 0);
    await expect(camera).not.toHaveCSS("background-color", "rgb(140, 203, 255)");
    const chooser = page.waitForEvent("filechooser");
    await select.press("Space");
    await (await chooser).setFiles({ name: "selfie.png", mimeType: "image/png", buffer: await sharp({ create: { width: 256, height: 256, channels: 3, background: "#607080" } }).png().toBuffer() });
    await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toBeVisible();
    await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toHaveCSS("border-radius", "50%");
    await expect(page.locator(".home-face-card img")).toHaveCount(1);
    await expect(page.locator(".home-face-card svg")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Analisar rosto", exact: true })).toHaveCSS("background-image", /linear-gradient/);
    await expect(page.getByRole("button", { name: "Analisar rosto", exact: true })).toHaveCSS("background-image", /140, 203, 255/);
    expect(await page.evaluate(() => window.cameraTest.calls)).toBe(0);
    await expect(page.getByRole("button", { name: "Analisar rosto", exact: true })).toBeEnabled();
    const photoUrl = await page.getByAltText("Pré-visualização da selfie selecionada").getAttribute("src");
    const replace = page.waitForEvent("filechooser");
    await select.click();
    await (await replace).setFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("not a valid image") });
    await expect(page.getByRole("form").getByRole("alert")).toContainText("não corresponde");
    await expect(page.getByRole("button", { name: "Analisar rosto", exact: true })).toBeDisabled();
    await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toHaveCount(0);
    expect(await page.evaluate(async (url) => { try { await fetch(url!); return true; } catch { return false; } }, photoUrl)).toBe(false);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".face-float")).toHaveCSS("animation-name", "none");
    await expect(select).toHaveCSS("transition-duration", "0s");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(remote).toEqual([]);
  });
}

test("câmera captura, permite refazer e habilita análise após confirmação", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockCamera(page);
  const uploads: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET") uploads.push(request.url()); });
  const detection = syntheticDetection();
  detection.width = 640; detection.height = 480;
  await page.addInitScript((reply) => {
    window.Worker = class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage() { queueMicrotask(() => this.onmessage?.(new MessageEvent("message", { data: reply }))); }
      terminate() {}
    } as unknown as typeof Worker;
  }, detection);
  await page.goto("/");
  expect(await page.evaluate(() => window.cameraTest.calls)).toBe(0);
  await openCamera(page);
  await page.getByRole("button", { name: "Capturar selfie", exact: true }).click();
  await expect(page.getByAltText("Selfie capturada para confirmação")).toBeVisible();
  expect(await page.evaluate(() => window.cameraTest.stopped)).toBe(1);
  await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toHaveCount(0);
  await page.getByRole("button", { name: "Tirar outra foto", exact: true }).click();
  await page.getByRole("button", { name: "Capturar selfie", exact: true }).click();
  await page.getByRole("button", { name: "Usar esta foto", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analisar rosto", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.cameraTest.calls)).toBe(2);
  expect(await page.evaluate(() => window.cameraTest.stopped)).toBe(2);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.getByRole("button", { name: "Analisar rosto", exact: true }).click();
  await expect(page).toHaveURL(/\/resultados$/);
  await page.getByRole("button", { name: "Visualizar análise facial", exact: true }).click();
  await expect(page.getByTestId("face-overlay").locator("image")).toHaveAttribute("href", /^blob:/);
  expect(uploads).toEqual([]);
});

for (const mode of ["denied", "missing", "unsupported"] as const) {
  test(`câmera ${mode}: oferece seletor e Escape devolve foco`, async ({ page }) => {
    await mockCamera(page, mode);
    await page.goto("/");
    await openCamera(page);
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(/selecione|selecionar/i);
    await expect(page.getByRole("button", { name: "Capturar selfie", exact: true })).toBeDisabled();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("dialog").getByRole("button", { name: "Selecionar foto", exact: true }).click();
    await (await chooser).setFiles([]);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await openCamera(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tirar foto", exact: true })).toBeFocused();
  });
}

test("fechar câmera para todos os tracks, inclusive permissão resolvida depois de fechar", async ({ page }) => {
  await mockCamera(page, "pending");
  await page.goto("/");
  await openCamera(page);
  await expect.poll(() => page.evaluate(() => window.cameraTest.calls)).toBe(1);
  await page.getByRole("button", { name: "Fechar câmera", exact: true }).click();
  await page.evaluate(() => window.cameraTest.release?.());
  await expect.poll(() => page.evaluate(() => window.cameraTest.stopped)).toBe(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Escape interrompe câmera ativa sem selecionar selfie", async ({ page }) => {
  await mockCamera(page);
  await page.goto("/");
  await openCamera(page);
  await expect(page.getByRole("button", { name: "Capturar selfie", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.cameraTest.stopped)).toBe(1);
  await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toHaveCount(0);
});

test("identidade preta preservada em sessão vazia e página não encontrada", async ({ page }) => {
  await page.goto("/resultados");
  await expect(page.getByRole("heading", { name: "Nenhum relatório nesta sessão" })).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(5, 5, 5)");
  await page.goto("/pagina-inexistente");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(5, 5, 5)");
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL("/");
});

test("avisos ficam em página separada sem checkbox ou restrição de idade", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { name: "Privacidade e limites" })).toBeVisible();
  await expect(page.getByText(/Use imagens dos participantes somente com autorização deles/)).toBeVisible();
  await expect(page.getByText(/não há upload/i)).toBeVisible();
  await expect(page.getByText(/não mede beleza/i)).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page.locator("#selfie-panel").getByRole("button")).toHaveCount(3);
});
