import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import { syntheticDetection, syntheticFaceMatrix } from "../fixtures/landmarks";
import { calculateFaceReport } from "../../src/lib/face-geometry";
import { classifyPSL, formatScore } from "../../src/lib/score-classification";
import { expressionDetection } from "../fixtures/expressions";

declare global { interface Window { battleTest: { workers: number; terminated: number; files: string[] } } }

function uneven() {
  const detection = syntheticDetection();
  detection.faces[0][291].y += .035;
  detection.faces[0][362].x += .015;
  return detection;
}

async function image(name: string) {
  return { name, mimeType: "image/png", buffer: await sharp({ create: { width: 320, height: 320, channels: 3, background: "#607080" } }).png().toBuffer() };
}

async function mock(page: Page, replies: Record<string, unknown>, pending = false) {
  await page.addInitScript(({ responses, neverReply }) => {
    window.battleTest = { workers: 0, terminated: 0, files: [] };
    class LocalWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor() { window.battleTest.workers++; }
      postMessage({ file }: { file: File }) {
        window.battleTest.files.push(file.name);
        if (!neverReply) queueMicrotask(() => this.onmessage?.(new MessageEvent("message", { data: responses[file.name] })));
      }
      terminate() { window.battleTest.terminated++; }
    }
    window.Worker = LocalWorker as unknown as typeof Worker;
  }, { responses: replies, neverReply: pending });
}

async function setup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "MogBattle", exact: true }).click();
  await expect(page.getByRole("button", { name: "MogBattle", exact: true })).toHaveAttribute("aria-pressed", "true");
}
const person = (page: Page, index: number) => page.getByRole("region", { name: `Participante ${index}`, exact: true });

async function photos(page: Page) {
  await person(page, 1).getByLabel("Foto do participante 1", { exact: true }).setInputFiles(await image("first.png"));
  await person(page, 2).getByLabel("Foto do participante 2", { exact: true }).setInputFiles(await image("second.png"));
}

async function startBattle(page: Page) {
  await page.getByRole("button", { name: "Iniciar batalha", exact: true }).click();
}

for (const width of [360, 1440]) for (const winner of [0, 1, null] as const) {
  test(`MogBattle ${width}px: ${winner === null ? "empate" : `vencedor ${winner + 1}`}, valores reais e descarte`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const a = winner === 1 ? uneven() : syntheticDetection();
    const b = winner === 0 ? uneven() : syntheticDetection();
    await mock(page, { "first.png": a, "second.png": b });
    const requests: { method: string; url: string }[] = [];
    page.on("request", (r) => requests.push({ method: r.method(), url: r.url() }));
    await setup(page);
    await person(page, 1).getByRole("textbox").fill("Alex");
    await person(page, 2).getByRole("textbox").fill("Bruno");
    const start = page.getByRole("button", { name: "Iniciar batalha", exact: true });
    await expect(start).toBeDisabled();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    for (const index of [1, 2]) {
      const select = person(page, index).getByRole("button", { name: "Selecionar foto", exact: true });
      await expect(select).toHaveCSS("background-color", "rgb(140, 203, 255)");
      await expect(select).toHaveCSS("color", "rgb(0, 0, 0)");
      await expect(select).not.toHaveCSS("box-shadow", "none");
      await expect(person(page, index).getByRole("button", { name: "Tirar foto", exact: true })).not.toHaveCSS("background-color", "rgb(140, 203, 255)");
    }
    await photos(page);
    const urls = await page.locator(".battle-draft-portrait img").evaluateAll((images) => images.map((img) => img.getAttribute("src")!));
    await expect(start).toBeEnabled();
    expect(await page.evaluate(() => window.battleTest.workers)).toBe(0);
    const startBounds = (await start.boundingBox())!, container = (await page.locator(".battle-start").boundingBox())!;
    expect(startBounds.x + startBounds.width / 2).toBeCloseTo(container.x + container.width / 2, 0);
    await startBattle(page);
    await expect(page.getByTestId("battle-outcome")).toHaveText(winner === null ? "EMPATE" : `${winner === 0 ? "Alex" : "Bruno"} venceu`);
    await expect(page.getByTestId("battle-outcome")).toBeFocused();
    const reports = [calculateFaceReport(a), calculateFaceReport(b)];
    for (const index of [0, 1]) {
      await expect(page.getByTestId(`battle-score-${index + 1}`)).toContainText(formatScore(reports[index].score));
      await expect(page.getByTestId(`battle-psl-${index + 1}`)).toHaveText(classifyPSL(reports[index].score));
      const svg = page.getByTestId(`battle-face-${index + 1}`);
      await expect(svg.locator("image")).toHaveAttribute("href", urls[index]);
      await expect(svg.locator("image")).toHaveCSS("filter", winner !== null && winner !== index ? "grayscale(1)" : "none");
      await expect(svg.locator("circle")).toHaveCount(478);
      const alignment = await svg.evaluate((element) => {
        const root = element as unknown as SVGSVGElement, image = root.querySelector("image")!;
        const point = root.createSVGPoint(); point.x = 340; point.y = 400;
        const projected = point.matrixTransform(root.getScreenCTM()!), bounds = image.getBoundingClientRect();
        return { x: (projected.x - bounds.x) / bounds.width, y: (projected.y - bounds.y) / bounds.height };
      });
      expect(alignment.x).toBeCloseTo(.34, 5); expect(alignment.y).toBeCloseTo(.4, 5);
    }
    await expect(page.getByText("MOGGADO", { exact: true })).toHaveCount(winner === null ? 0 : 1);
    await expect(page.locator(".battle-winner")).toHaveCount(winner === null ? 0 : 1);
    await expect(page.locator("[data-comparison=score]")).toHaveCount(11);
    const symmetry = page.getByRole("row", { name: /Simetria · erro RMS/ });
    await expect(symmetry.locator(".battle-cell-higher")).toHaveCount(0);
    await expect(page.getByRole("row", { name: /^Pele/ })).toContainText("—");
    const exact = Math.abs(Math.round(reports[0].score! * 10) - Math.round(reports[1].score! * 10)) / 10;
    await expect(page.getByTestId("battle-difference")).toContainText(`${formatScore(exact)} pontos`);
    if (winner === null) await expect(page.getByRole("row", { name: /^Nota geral/ })).toContainText("Empate");
    else await expect(page.locator("#battle-detail-heading")).toHaveText(winner === 0 ? "Alex MOGGA Bruno" : "Bruno MOGGA Alex");
    await page.getByRole("button", { name: "Desativar pontos", exact: true }).click();
    for (const layer of await page.getByTestId("landmark-layer").all()) await expect(layer).toHaveCSS("opacity", "0");
    await page.getByRole("button", { name: "Ativar pontos", exact: true }).click();
    expect(await page.evaluate(() => window.battleTest.workers)).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(requests.filter((r) => !r.url.startsWith("blob:") && (r.method !== "GET" || new URL(r.url).origin !== "http://127.0.0.1:3100"))).toEqual([]);
    await page.getByRole("button", { name: "Batalhar novamente", exact: true }).click();
    await expect(page.locator(".battle-draft-portrait img")).toHaveCount(0);
    await expect(start).toBeDisabled();
    for (const url of urls) expect(await page.evaluate(async (href) => { try { await fetch(href); return true; } catch { return false; } }, url)).toBe(false);
    await expect(page.getByTestId("battle-outcome")).toHaveCount(0);
  });
}

test("falhas não declaram vencedor e repetição reutiliza análise bem-sucedida", async ({ page }) => {
  await mock(page, { "first.png": syntheticDetection(), "second.png": { error: "Nenhum rosto detectado" }, "fixed.png": uneven() });
  await setup(page); await photos(page);
  await startBattle(page);
  await expect(page.getByRole("form").getByRole("alert")).toContainText("Nenhum rosto detectado");
  await expect(page.getByTestId("battle-outcome")).toHaveCount(0);
  await startBattle(page);
  await expect.poll(() => page.evaluate(() => window.battleTest.workers)).toBe(3);
  await expect(page.getByRole("button", { name: "Iniciar batalha", exact: true })).toBeEnabled();
  await person(page, 2).getByLabel("Foto do participante 2", { exact: true }).setInputFiles(await image("fixed.png"));
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await startBattle(page);
  await expect(page.getByTestId("battle-outcome")).toContainText("Participante 1 venceu");
  expect(await page.evaluate(() => window.battleTest.files)).toEqual(["first.png", "second.png", "second.png", "fixed.png"]);
});

for (const rejected of [1, 2]) test(`MogBattle identifica piscada do participante ${rejected} e troca só essa foto, preservando análise válida`, async ({ page }) => {
  const usable = expressionDetection({ eyeLeft: .12, eyeRight: .12, opening: .12, browGap: 1,
    activations: { eyeBlinkLeft: .85, eyeBlinkRight: .85, jawOpen: .9, browInnerUp: .96, browOuterUpLeft: .96, browOuterUpRight: .96 } });
  const blink = expressionDetection({ eyeLeft: .06, activations: { eyeBlinkRight: .96 } });
  const replies = { "first.png": rejected === 1 ? blink : usable, "second.png": rejected === 2 ? blink : usable, "fixed.png": usable };
  await mock(page, replies);
  await setup(page);
  await person(page, 1).getByRole("textbox").fill("Alex");
  await person(page, 2).getByRole("textbox").fill("Bruno");
  await photos(page); await startBattle(page);
  const alert = page.getByRole("form").getByRole("alert");
  await expect(alert).toContainText(`Participante ${rejected} (${rejected === 1 ? "Alex" : "Bruno"})`);
  await expect(alert).toContainText("O olho direito parece fechado ou encoberto");
  await expect(alert).toContainText(`A análise válida do participante ${3 - rejected} será reutilizada`);
  await expect(page.getByTestId("battle-outcome")).toHaveCount(0);
  expect(await page.evaluate(() => window.battleTest.files)).toEqual(["first.png", "second.png"]);
  const retainedUrl = await person(page, 3 - rejected).locator("img").getAttribute("src");
  await person(page, rejected).getByLabel(`Foto do participante ${rejected}`, { exact: true }).setInputFiles(await image("fixed.png"));
  await expect(alert).toHaveCount(0);
  await expect(person(page, 3 - rejected).locator("img")).toHaveAttribute("src", retainedUrl!);
  await startBattle(page);
  await expect(page.getByTestId("battle-outcome")).toHaveText("EMPATE");
  for (const index of [1, 2]) await expect(page.getByTestId(`battle-score-${index}`)).toContainText(formatScore(calculateFaceReport(usable).score));
  expect(await page.evaluate(() => window.battleTest.files)).toEqual(["first.png", "second.png", "fixed.png"]);
});

test("duas capturas rejeitadas exibem os dois participantes e motivos sem vencedor", async ({ page }) => {
  await mock(page, { "first.png": expressionDetection({ opening: .4 }), "second.png": { ...syntheticDetection(), captureQuality: null } });
  await setup(page); await photos(page); await startBattle(page);
  const alert = page.getByRole("form").getByRole("alert");
  await expect(alert).toContainText("Participante 1:");
  await expect(alert).toContainText("A boca está muito aberta");
  await expect(alert).toContainText("Participante 2:");
  await expect(alert).toContainText("Não foi possível verificar a nitidez");
  await expect(alert).not.toContainText("análise válida");
  await expect(page.getByTestId("battle-outcome")).toHaveCount(0);
});

test("nota geral indisponível, arquivo inválido e remoção não inventam resultado", async ({ page }) => {
  const tilted = syntheticDetection(); tilted.faceMatrices = [syntheticFaceMatrix(20)];
  await mock(page, { "first.png": syntheticDetection(), "second.png": tilted });
  await setup(page);
  await person(page, 1).getByLabel("Foto do participante 1").setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("invalid") });
  await expect(person(page, 1).getByRole("alert")).toContainText("não corresponde");
  await expect(page.getByRole("button", { name: "Iniciar batalha", exact: true })).toBeDisabled();
  await photos(page);
  await startBattle(page);
  await expect(page.getByRole("form").getByRole("alert")).toContainText("Captura sem confiança suficiente");
  await expect(page.getByTestId("battle-outcome")).toHaveCount(0);
  const url = await person(page, 1).locator("img").getAttribute("src");
  await person(page, 1).getByRole("button", { name: "Remover foto", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Iniciar batalha", exact: true })).toBeDisabled();
  expect(await page.evaluate(async (href) => { try { await fetch(href!); return true; } catch { return false; } }, url)).toBe(false);
});

test("mudar de modo aborta processamento e libera selfies; FaceScan continua utilizável", async ({ page }) => {
  await mock(page, {}, true); await setup(page); await photos(page);
  const urls = await page.locator(".battle-draft-portrait img").evaluateAll((images) => images.map((img) => img.getAttribute("src")!));
  await startBattle(page);
  await expect.poll(() => page.evaluate(() => window.battleTest.workers)).toBe(1);
  await page.getByRole("button", { name: "FaceScan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Analisar rosto", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.battleTest.terminated)).toBe(1);
  for (const url of urls) expect(await page.evaluate(async (href) => { try { await fetch(href); return true; } catch { return false; } }, url)).toBe(false);
  await page.getByRole("button", { name: "MogBattle", exact: true }).click();
  await expect(page.locator(".battle-draft-portrait img")).toHaveCount(0);
});

test("câmera do participante sem permissão oferece galeria e não ativa a outra câmera", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } } }));
  await setup(page); await person(page, 2).getByRole("button", { name: "Tirar foto", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toContainText("Permissão");
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Selecionar foto", exact: true }).click();
  await (await chooser).setFiles(await image("second.png"));
  await expect(person(page, 2).getByRole("img")).toBeVisible();
  await expect(person(page, 1).getByRole("img")).toHaveCount(0);
});

test("batalha começa diretamente com duas fotos válidas, sem checkbox, modal ou pop-up", async ({ page }) => {
  await mock(page, { "first.png": syntheticDetection(), "second.png": uneven() });
  let popups = 0;
  page.on("dialog", async (dialog) => { popups++; await dialog.dismiss(); });
  await setup(page);
  const start = page.getByRole("button", { name: "Iniciar batalha", exact: true });
  await expect(start).toBeDisabled();
  await expect(page.locator(".battle-authorization, input[type=checkbox]")).toHaveCount(0);
  await person(page, 1).getByLabel("Foto do participante 1", { exact: true }).setInputFiles(await image("first.png"));
  await expect(person(page, 1).getByRole("img")).toBeVisible();
  await expect(start).toBeDisabled();
  expect(await page.evaluate(() => window.battleTest.workers)).toBe(0);
  await person(page, 2).getByLabel("Foto do participante 2", { exact: true }).setInputFiles(await image("second.png"));
  await expect(start).toBeEnabled();
  expect(await page.evaluate(() => window.battleTest.workers)).toBe(0);
  await start.press("Enter");
  await expect(page.getByTestId("battle-outcome")).toContainText("venceu");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmar e iniciar", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.battleTest.workers)).toBe(2);
  await page.getByRole("button", { name: "Batalhar novamente", exact: true }).click();
  await expect(start).toBeDisabled();
  await photos(page); await startBattle(page);
  await expect(page.getByTestId("battle-outcome")).toContainText("venceu");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.battleTest.workers)).toBe(4);
  expect(popups).toBe(0);
});
