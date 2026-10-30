import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { syntheticDetection, syntheticFaceMatrix, syntheticLight } from "../fixtures/landmarks";
import { calculateFaceReport } from "../../src/lib/face-geometry";
import { classifyPotential, classifyPSL, formatScore } from "../../src/lib/score-classification";
import { syntheticAppearance } from "../fixtures/appearance";
import { measureAppearance } from "../../public/appearance-analysis.mjs";

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
      constructor() { document.documentElement.dataset.testWorkers = String(Number(document.documentElement.dataset.testWorkers || 0) + 1); }
      postMessage() { queueMicrotask(() => this.onmessage?.(new MessageEvent("message", { data: reply }))); }
      terminate() {}
    }
    window.Worker = TestWorker as unknown as typeof Worker;
  }, result);
}

test("só habilita análise com foto válida e permite substituir após erro", async ({ page }) => {
  await mockLocalDetection(page, { error: "Falha de detecção exclusiva de teste." });
  await page.goto("/");
  const analyze = page.getByRole("button", { name: "Analisar rosto" });
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(analyze).toBeDisabled();
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
  await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toBeVisible();
  await expect(analyze).toBeEnabled();
  expect(await page.locator("html").getAttribute("data-test-workers")).toBeNull();
  await page.getByLabel("Trocar selfie", { exact: true }).setInputFiles(await syntheticImage());
  await expect(analyze).toBeEnabled();
  await analyze.click();
  await expect(page.locator("#selfie-error")).toHaveText("Falha de detecção exclusiva de teste.");
  await page.getByLabel("Trocar selfie", { exact: true }).setInputFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("invalid image") });
  await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toHaveCount(0);
  await expect(analyze).toBeDisabled();
});

test("geometria local gera resultados transparentes sem envio nem armazenamento", async ({ page }) => {
  await mockLocalDetection(page, syntheticDetection());
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) uploads.push(request.url());
  });
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
  await page.getByRole("button", { name: "Analisar rosto" }).click();
  await expect(page).toHaveURL(/\/resultados$/);
  for (const name of ["Notas por região facial", "Olhos", "Sobrancelhas", "Nariz", "Lábios", "Mandíbula", "Queixo", "Maçãs do rosto", "Pele", "Cabelo", "Harmonia facial"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/não uma medida científica de beleza/)).toHaveCount(0);
  await expect(page.getByText(/Geometria da foto, não beleza objetiva/)).toHaveCount(0);
  await expect(page.locator("#geometry-notice, .essential-note, .result-details")).toHaveCount(0);
  await expect(page.getByTestId("face-overlay").locator("image")).toHaveAttribute("href", /^blob:/);
  expect(uploads).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })))
    .toEqual({ local: 0, session: 0 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nenhum relatório nesta sessão" })).toBeVisible();
});

for (const viewport of [360, 1440]) for (const portrait of [true, false]) {
  test(`visualização alinhada e sem nova inferência em ${viewport}px, ${portrait ? "retrato EXIF" : "paisagem"}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport, height: 900 });
    const detection = syntheticDetection();
    detection.width = portrait ? 800 : 1200;
    detection.height = portrait ? 1200 : 800;
    // A peripheral off-image landmark must not be clamped onto the photo border.
    detection.faces[0][7] = { x: -0.1, y: 0.4 };
    await mockLocalDetection(page, detection);
    const uploads: string[] = [];
    page.on("request", (r) => { if (r.method() !== "GET") uploads.push(r.url()); });
    await page.goto("/");
    // EXIF 6: encoded 1200x800 is displayed as 800x1200, as in createImageBitmap(from-image).
    const buffer = portrait
      ? await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#405060" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer()
      : await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#405060" } }).png().toBuffer();
    await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles({ name: portrait ? "oriented.jpg" : "landscape.png", mimeType: portrait ? "image/jpeg" : "image/png", buffer });
    await page.getByRole("button", { name: "Analisar rosto" }).click();
    await expect(page).toHaveURL(/\/resultados$/);
    const scores = await page.locator('[data-testid$="score"], [data-testid="psl-classification"]').allTextContents();
    const open = page.getByRole("button", { name: "Visualizar análise facial", exact: true });
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await open.click();
    await expect(open).toHaveAttribute("aria-expanded", "true");
    const svg = page.getByTestId("face-overlay");
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute("viewBox", `0 0 ${detection.width} ${detection.height}`);
    await expect(svg.locator("image")).toHaveAttribute("href", /^blob:/);
    await expect(svg.locator('[data-landmark="7"]')).toHaveCount(0);
    await expect(svg.locator("circle")).toHaveCount(477);
    await expect(svg.locator("[data-region]")).toHaveCount(6);
    const alignment = await svg.evaluate(async (element) => {
      const root = element as unknown as SVGSVGElement;
      const image = root.querySelector("image")!;
      const circle = root.querySelector('[data-landmark="33"]')!;
      const position = root.createSVGPoint();
      position.x = Number(circle.getAttribute("cx")); position.y = Number(circle.getAttribute("cy"));
      const projected = position.matrixTransform(root.getScreenCTM()!);
      const bounds = image.getBoundingClientRect();
      const photo = new Image(); photo.src = image.getAttribute("href")!; await photo.decode();
      return { x: (projected.x - bounds.x) / bounds.width, y: (projected.y - bounds.y) / bounds.height,
        ratio: bounds.width / bounds.height, naturalRatio: photo.naturalWidth / photo.naturalHeight };
    });
    expect(alignment.x).toBeCloseTo(detection.faces[0][33].x, 5);
    expect(alignment.y).toBeCloseTo(detection.faces[0][33].y, 5);
    expect(alignment.ratio).toBeCloseTo(detection.width / detection.height, 5);
    expect(alignment.naturalRatio).toBeCloseTo(detection.width / detection.height, 5);
    await page.getByRole("button", { name: "Desativar pontos", exact: true }).click();
    await expect(page.getByTestId("landmark-layer")).toHaveCSS("opacity", "0");
    await page.getByRole("button", { name: "Ativar pontos", exact: true }).click();
    await expect(page.getByTestId("landmark-layer")).toHaveCSS("opacity", "1");
    await page.getByRole("button", { name: "Nariz", exact: true }).click();
    await expect(svg.locator("[data-region]")).toHaveCount(1);
    await expect(svg.locator('[data-region="nose"]')).toHaveCount(1);
    expect(await svg.locator("circle").count()).toBeLessThan(478);
    expect(await page.locator('[data-testid$="score"], [data-testid="psl-classification"]').allTextContents()).toEqual(scores);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#facial-visualization")).toHaveCSS("animation-name", "none");
    await open.click();
    await expect(svg).toBeVisible();
    await expect(page.locator("#region-controls")).toBeHidden();
    await open.click();
    await expect(svg).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-test-workers", "1");
    expect(uploads).toEqual([]);
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, overflow: document.documentElement.scrollWidth > innerWidth }))).toEqual({ local: 0, session: 0, overflow: false });
    const photoUrl = await svg.locator("image").getAttribute("href");
    await page.getByRole("button", { name: "Nova análise", exact: true }).click();
    expect(await page.evaluate(async (url) => { try { await fetch(url!); return true; } catch { return false; } }, photoUrl)).toBe(false);
    await page.goto("/resultados");
    await expect(page.getByRole("heading", { name: "Nenhum relatório nesta sessão" })).toBeVisible();
    await expect(page.getByTestId("face-overlay")).toHaveCount(0);
  });
}

test("arquivo inválido não pode ser analisado", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles({
    name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("not a real image"),
  });
  await expect(page.locator("#selfie-error")).toContainText("não corresponde");
  await expect(page.getByRole("button", { name: "Analisar rosto" })).toBeDisabled();
});

test("MediaPipe real carrega apenas arquivos da mesma origem e rejeita imagem sem rosto", async ({ page }) => {
  const requests: { url: string; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
  await page.getByRole("button", { name: "Analisar rosto" }).click();
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
  const segmentationModel = await request.get("/mediapipe/selfie_multiclass_256x256.tflite");
  expect(segmentationModel.status()).toBe(200);
  expect(createHash("sha256").update(await segmentationModel.body()).digest("hex"))
    .toBe("c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0");
  for (const variant of ["vision_wasm_internal", "vision_wasm_nosimd_internal"]) {
    const loader = await request.get(`/mediapipe/wasm/${variant}.js`);
    expect(loader.status()).toBe(200);
    const wasm = await request.get(`/mediapipe/wasm/${variant}.wasm`);
    expect(wasm.status()).toBe(200);
    expect(wasm.headers()["content-type"]).toContain("application/wasm");
    expect((await wasm.body()).subarray(0, 4)).toEqual(Buffer.from([0, 0x61, 0x73, 0x6d]));
  }
});

for (const width of [360, 1440]) {
  test(`pele e cabelo em ${width}px exibem notas calculadas sem alterar a nota geral`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const detection = syntheticDetection();
    detection.faces[0][291].y += 0.04;
    const fixture = syntheticAppearance();
    detection.appearance = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
    const report = calculateFaceReport(detection);
    expect(report.regions.skin).not.toBeNull();
    expect(report.regions.hair).not.toBeNull();
    await mockLocalDetection(page, detection);
    await page.goto("/");
    await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
    await page.getByRole("button", { name: "Analisar rosto" }).click();
    await expect(page).toHaveURL(/\/resultados$/);
    await expect(page.getByRole("article", { name: "Pele", exact: true })).toContainText(formatScore(report.regions.skin));
    await expect(page.getByRole("article", { name: "Cabelo", exact: true })).toContainText(formatScore(report.regions.hair));
    await expect(page.getByTestId("overall-score")).toHaveText(formatScore(report.score));
    await expect(page.getByTestId("psl-classification")).toHaveText(classifyPSL(report.score));
    await expect(page.getByRole("article")).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("Manrope é servida localmente por next/font e a calibração publicada é identificável", async ({ page }) => {
  const external: string[] = [];
  const fonts: number[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:3100") external.push(request.url());
  });
  page.on("response", (response) => {
    if (response.url().includes(".woff2")) fonts.push(response.status());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("body")).toHaveCSS("font-family", /Manrope/);
  await expect(page.locator("html")).toHaveAttribute("data-calibration", "2");
  await expect(page.locator("html")).toHaveAttribute("data-build", "local");
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((status) => status === 200)).toBe(true);
  expect(external).toEqual([]);
});

test("pose sem confiança mostra traços em vez de nota geral e PSL inventados", async ({ page }) => {
  const detection = syntheticDetection();
  detection.faceMatrices = [syntheticFaceMatrix(20)];
  await mockLocalDetection(page, detection);
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
  await page.getByRole("button", { name: "Analisar rosto" }).click();
  await expect(page).toHaveURL(/\/resultados$/);
  for (const name of ["overall-score", "psl-classification", "potential-score"]) {
    await expect(page.getByTestId(name)).toHaveText("—");
  }
  await expect(page.getByTestId("potential-label")).toHaveText("Não estimado");
  await expect(page.locator(".score-ring-fill, .region-marker")).toHaveCount(0);
});

test("worker de produção usa máscaras e pixels locais para pele/cabelo; somente detectores são sintéticos", async ({ page, context }) => {
  const detection = syntheticDetection();
  await context.route("**/mediapipe/vision_bundle.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `self.exports = {
      FilesetResolver: { forVisionTasks: async () => ({}) },
      FaceLandmarker: { createFromOptions: async () => ({
        detect: () => ({ faceLandmarks: ${JSON.stringify(detection.faces)}, facialTransformationMatrixes: ${JSON.stringify([syntheticFaceMatrix()])} }), close() {}
      }) },
      ImageSegmenter: { createFromOptions: async () => ({
        getLabels: () => ['background','hair','body-skin','face-skin','clothes','others'],
        segment: (image) => {
          const w=image.width, h=image.height;
          const categories=new Uint8Array(w*h), skin=new Float32Array(w*h), hair=new Float32Array(w*h);
          for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
            const i=y*w+x;
            if(x>=80&&x<240&&y>=10&&y<100){categories[i]=1;hair[i]=0.95;}
            else if(x>=65&&x<255&&y>=100&&y<285){categories[i]=3;skin[i]=0.95;}
          }
          const mask = (data) => ({width:w,height:h,getAsUint8Array:()=>data,getAsFloat32Array:()=>data});
          return {categoryMask:mask(categories),confidenceMasks:[mask(skin),mask(hair),mask(skin),mask(skin)],close(){}};
        }, close() {}
      }) }
    };`,
  }));
  const fixture = syntheticAppearance();
  const image = await sharp(fixture.image.data, { raw: { width: fixture.image.width, height: fixture.image.height, channels: 4 } }).png().toBuffer();
  const requests: {url: string; method: string}[] = [];
  page.on("request", (r) => requests.push({url: r.url(), method: r.method()}));
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles({ name: "synthetic-appearance.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "Analisar rosto" }).click();
  await expect(page).toHaveURL(/\/resultados$/);
  await expect(page.getByRole("article", { name: "Pele", exact: true }).locator(".region-label > span")).toHaveText(/^\d{1,2},\d$/);
  await expect(page.getByRole("article", { name: "Cabelo", exact: true }).locator(".region-label > span")).toHaveText(/^\d{1,2},\d$/);
  expect(requests.some((r) => r.url.includes("appearance-analysis.mjs"))).toBe(true);
  expect(requests.filter((r) => !r.url.startsWith("blob:") && (r.method !== "GET" || new URL(r.url).origin !== "http://127.0.0.1:3100"))).toEqual([]);
});

test("Image Segmenter real carrega modelo multiclasses e máscaras sem conexão externa", async ({ page, context }) => {
  test.setTimeout(60_000);
  const requests: {url: string; method: string}[] = [];
  context.on("request", (r) => requests.push({url:r.url(),method:r.method()}));
  await context.route("**/segmentation-smoke.worker.js", (route) => route.fulfill({
    contentType: "application/javascript",
    headers: { "Content-Security-Policy": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'" },
    body: `self.onmessage=async()=>{
      let segmenter,result;
      try {
        self.exports={};importScripts('/mediapipe/vision_bundle.js');
        const {ImageSegmenter,FilesetResolver}=self.exports;
        segmenter=await ImageSegmenter.createFromOptions(await FilesetResolver.forVisionTasks('/mediapipe/wasm'),{
          baseOptions:{modelAssetPath:'/mediapipe/selfie_multiclass_256x256.tflite',delegate:'CPU'},
          runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:true
        });
        const canvas=new OffscreenCanvas(256,256);canvas.getContext('2d').fillRect(0,0,256,256);
        result=segmenter.segment(canvas);
        self.postMessage({labels:segmenter.getLabels(),categories:result.categoryMask.getAsUint8Array().length,
          confidence:result.confidenceMasks.length,width:result.categoryMask.width,height:result.categoryMask.height});
      }catch(error){self.postMessage({error:String(error)});}
      finally{result?.close();segmenter?.close();self.close();}
    };`,
  }));
  await page.goto("/");
  const result = await page.evaluate(() => new Promise<{labels?:string[];categories?:number;confidence?:number;width?:number;height?:number;error?:string}>((resolve, reject) => {
    const worker = new Worker("/segmentation-smoke.worker.js");
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("Segmentation timeout")); }, 45_000);
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error("Segmentation worker failed")); };
    worker.onmessage = ({data}) => { clearTimeout(timer); worker.terminate(); resolve(data); };
    worker.postMessage("start");
  }));
  expect(result.error).toBeUndefined();
  expect(result.labels).toContain("hair");
  expect(result.labels).toContain("face-skin");
  expect(result.confidence).toBe(6);
  expect(result.categories).toBe(result.width! * result.height!);
  expect(requests.some((r) => r.url.includes("selfie_multiclass_256x256.tflite"))).toBe(true);
  expect(requests.filter((r) => !r.url.startsWith("blob:") && (r.method !== "GET" || new URL(r.url).origin !== "http://127.0.0.1:3100"))).toEqual([]);
});

for (const width of [360, 1440]) {
  test(`relatório minimalista em ${width}px mostra notas brasileiras, classificação e miniatura somente em memória`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const detection = syntheticDetection();
    detection.faces[0][291].y += 0.04;
    detection.faces[0][362].x += 0.02;
    const report = calculateFaceReport(detection);
    expect(report.score).toBeLessThan(10);
    await page.addInitScript(() => {
      const revoked: string[] = [];
      Object.defineProperty(window, "revokedBlobUrls", { value: revoked });
      const original = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url: string) => { revoked.push(url); original(url); };
    });
    await mockLocalDetection(page, detection);
    await page.goto("/");
    await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
    await page.getByRole("button", { name: "Analisar rosto" }).click();
    await expect(page).toHaveURL(/\/resultados$/);
    const thumbnail = page.getByTestId("face-overlay");
    await expect(thumbnail).toBeVisible();
    const photoUrl = await thumbnail.locator("image").getAttribute("href");
    expect(photoUrl).toMatch(/^blob:/);
    await expect(page.getByTestId("overall-score")).toHaveText(formatScore(report.score));
    await expect(page.getByTestId("overall-score")).toHaveText(/^\d{1,2},\d$/);
    await expect(page.getByTestId("psl-classification")).toHaveText(classifyPSL(report.score));
    await expect(page.getByTestId("potential-score")).toHaveText("—");
    const classification = page.getByTestId("psl-classification");
    await expect(page.getByText("SEU PSL", { exact: true })).toBeVisible();
    await expect(classification).toHaveCSS("font-size", width < 640 ? "34px" : "42px");
    await expect(classification).toHaveCSS("color", "rgb(140, 203, 255)");
    await expect(page.locator(".psl-line")).toHaveCSS("text-align", "center");
    const scoresBox = (await page.locator(".score-pair").boundingBox())!;
    const classificationBox = (await classification.boundingBox())!;
    expect(classificationBox.y).toBeGreaterThan(scoresBox.y + scoresBox.height);
    expect(classificationBox.x + classificationBox.width / 2).toBeCloseTo(scoresBox.x + scoresBox.width / 2, 0);
    await expect(page.getByTestId("potential-label")).toHaveText("Não estimado");
    await expect(page.locator(".score-ring[role=meter]")).toHaveCount(1);
    await expect(page.locator(".score-ring-fill")).toHaveCount(1);
    await expect(page.locator(".portrait-frame")).toHaveCSS("border-radius", "50%");
    await expect(page.getByRole("heading", { name: "Como a pontuação é calculada" })).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(10);
    for (const name of ["Pele", "Cabelo"]) {
      await expect(page.getByRole("article", { name, exact: true })).toContainText("—");
    }
    for (const [key, name] of [["eyes", "Olhos"], ["eyebrows", "Sobrancelhas"], ["nose", "Nariz"], ["lips", "Lábios"], ["jawline", "Mandíbula"], ["chin", "Queixo"], ["cheekbones", "Maçãs do rosto"], ["harmony", "Harmonia facial"]] as const) {
      await expect(page.getByRole("article", { name, exact: true })).toContainText(formatScore(report.regions[key]));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Nova análise", exact: true }).click();
    await expect(page).toHaveURL("/");
    expect(await page.evaluate(() => (window as unknown as { revokedBlobUrls: string[] }).revokedBlobUrls)).toContain(photoUrl);
    await expect(page.getByRole("button", { name: "Analisar rosto" })).toBeDisabled();
    await expect(page.getByAltText("Pré-visualização da selfie selecionada")).toHaveCount(0);
  });
}

for (const width of [360, 1440]) {
  test(`potencial técnico em ${width}px usa qualidade detectada, exibe vírgula e não altera PSL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const detection = syntheticDetection();
    detection.faces[0][291].y += 0.04;
    detection.faces[0][362].x += 0.02;
    detection.captureLight = syntheticLight();
    detection.faceMatrices = [syntheticFaceMatrix(14)];
    const report = calculateFaceReport(detection);
    expect(report.potential).not.toBeNull();
    expect(report.potential!).toBeGreaterThan(report.score!);
    await mockLocalDetection(page, detection);
    const uploads: string[] = [];
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH"].includes(request.method())) uploads.push(request.url());
    });
    await page.goto("/");
    await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
    await page.getByRole("button", { name: "Analisar rosto" }).click();
    await expect(page).toHaveURL(/\/resultados$/);
    await expect(page.getByTestId("potential-score")).toHaveText(formatScore(report.potential));
    await expect(page.getByTestId("potential-score")).toHaveText(/^\d{1,2},\d$/);
    await expect(page.getByTestId("potential-label")).toHaveText(classifyPotential(report.potential));
    await expect(page.getByTestId("psl-classification")).toHaveText(classifyPSL(report.score));
    await expect(page.getByTestId("overall-score")).toHaveText(formatScore(report.score));
    await expect(page.locator("#potential-note")).toContainText("não garante melhoria");
    await expect(page.locator(".score-ring[role=meter]")).toHaveCount(2);
    for (const [label, value] of [["ATUAL", report.score!], ["POTENCIAL", report.potential!]] as const) {
      const ring = page.getByRole("meter", { name: `${label}: ${formatScore(value)}`, exact: true });
      await expect(ring).toHaveAttribute("aria-valuenow", String(value));
      await expect(ring.locator(".score-ring-fill")).toHaveAttribute("stroke-dasharray", `${value * 10} 100`);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(uploads).toEqual([]);
  });
}

test("worker real calcula luz dos pixels locais; detector substituído apenas neste teste de integração", async ({ page, context }) => {
  const detection = syntheticDetection();
  detection.faces[0][291].y += 0.04;
  detection.faces[0][362].x += 0.02;
  // Mantém o worker, canvas e sampler reais. Apenas a saída do detector é sintética.
  await context.route("**/mediapipe/vision_bundle.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `self.exports = {
      FilesetResolver: { forVisionTasks: async () => ({}) },
      FaceLandmarker: { createFromOptions: async () => ({
        detect: () => ({ faceLandmarks: ${JSON.stringify(detection.faces)}, facialTransformationMatrixes: ${JSON.stringify([syntheticFaceMatrix(14)])} }),
        close() {}
      }) }
    };`,
  }));
  const requests: { url: string; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.goto("/");
  await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
  await page.getByRole("button", { name: "Analisar rosto" }).click();
  await expect(page).toHaveURL(/\/resultados$/);
  await expect(page.getByTestId("potential-score")).toHaveText(/^\d{1,2},\d$/);
  expect(requests.some((r) => r.url.includes("capture-light.mjs"))).toBe(true);
  expect(requests.filter((r) => !r.url.startsWith("blob:") &&
    (r.method !== "GET" || new URL(r.url).origin !== "http://127.0.0.1:3100"))).toEqual([]);
});

for (const width of [360, 1440]) {
  test(`tema preto e indicadores reais em ${width}px preservam fluxo local e pele com confiança moderada`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = syntheticAppearance();
    fixture.masks.skin.fill(0.74);
    const detection = syntheticDetection();
    detection.appearance = measureAppearance(fixture.image, fixture.masks, fixture.landmarks);
    const expected = calculateFaceReport(detection);
    expect(expected.regions.skin).not.toBeNull();
    await mockLocalDetection(page, detection);
    const uploads: string[] = [];
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH"].includes(request.method())) uploads.push(request.url());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "ChadScore." })).toBeVisible();
    await expect(page.locator("main")).toHaveCSS("background-color", "rgb(5, 5, 5)");
    await expect(page.locator("#selfie-panel .glass-card")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tirar foto", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Selecionar foto", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel("Escolher selfie", { exact: true }).setInputFiles(await syntheticImage());
    await page.getByRole("button", { name: "Analisar rosto" }).click();
    await expect(page).toHaveURL(/\/resultados$/);
    await expect(page.locator(".glass-card")).toHaveCount(0);
    await expect(page.locator(".result-bubble")).toHaveCount(5);
    for (const block of await page.locator(".result-bubble").all()) {
      await expect(block).toHaveCSS("border-radius", "28px");
      await expect(block).toHaveCSS("backdrop-filter", "blur(12px)");
      await expect(block).toHaveCSS("background-image", /gradient/);
      await expect(block).toHaveCSS("background-color", "rgb(17, 18, 22)");
      await expect(block).not.toHaveCSS("box-shadow", "none");
    }
    await expect(page.getByRole("button", { name: "Nova análise", exact: true })).toHaveClass(/new-analysis-button/);
    await expect(page.locator(".result-details, .essential-note, #geometry-notice")).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Pele", exact: true })).toContainText(formatScore(expected.regions.skin));
    await expect(page.getByTestId("overall-score")).toHaveText(formatScore(expected.score));
    await expect(page.getByTestId("psl-classification")).toHaveText(classifyPSL(expected.score));
    await expect(page.locator("main")).toHaveCSS("background-color", "rgb(5, 5, 5)");
    await expect(page.locator('[data-region="eyes"]')).toHaveAttribute("stroke", "#8CCBFF");
    for (const ring of await page.locator(".score-ring svg").all()) {
      expect(await ring.locator("stop").evaluateAll((stops) => stops.map((stop) => stop.getAttribute("stop-color"))))
        .toEqual(["#CDD8E7", "#EDF5FF", "#8CCBFF"]);
    }
    await expect(page.locator(".score-ring-fill").first()).toHaveCSS("animation-name", "none");
    const grid = await page.locator(".region-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(grid).toBe(2);
    for (const [key, name] of [["eyes", "Olhos"], ["eyebrows", "Sobrancelhas"], ["nose", "Nariz"], ["lips", "Lábios"], ["jawline", "Mandíbula"], ["chin", "Queixo"], ["cheekbones", "Maçãs do rosto"], ["skin", "Pele"], ["hair", "Cabelo"], ["harmony", "Harmonia facial"]] as const) {
      const item = page.getByRole("article", { name, exact: true });
      const value = expected.regions[key];
      await expect(item.locator("h3")).toHaveCSS("text-transform", "uppercase");
      if (value === null) {
        await expect(item.locator(".region-marker")).toHaveCount(0);
      } else {
        await expect(item.getByRole("meter")).toHaveAttribute("aria-valuenow", String(value));
        await expect(item.locator(".region-progress")).toHaveAttribute("style", `width: ${value * 10}%;`);
        await expect(item.locator(".region-marker")).toHaveCount(1);
        await expect(item.locator(".region-progress")).toHaveCSS("animation-name", "none");
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(uploads).toEqual([]);
  });
}
