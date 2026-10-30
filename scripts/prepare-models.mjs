import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("@mediapipe/tasks-vision"));
const destination = new URL("../public/mediapipe/", import.meta.url);
await mkdir(new URL("wasm/", destination), { recursive: true });
for (const name of await readdir(join(packageRoot, "wasm"))) {
  if (/\.(js|wasm)$/.test(name)) {
    await copyFile(join(packageRoot, "wasm", name), new URL(`wasm/${name}`, destination));
  }
}
// Bundle CommonJS sem dependências, carregado em worker clássico com namespace exports.
await copyFile(join(packageRoot, "vision_bundle.cjs"), new URL("vision_bundle.js", destination));

const modelURL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const modelPath = new URL("face_landmarker.task", destination);
let model;
try {
  model = await readFile(modelPath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.log("Baixando o modelo público Face Landmarker v1 (nenhuma foto é enviada)...");
  const response = await fetch(modelURL, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Falha ao baixar modelo: HTTP ${response.status}`);
  model = Buffer.from(await response.arrayBuffer());
}
const hash = createHash("sha256").update(model).digest("hex");
if (hash !== "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff") {
  throw new Error("SHA-256 do modelo não corresponde à versão fixada. Não será utilizado.");
}
await writeFile(modelPath, model);
console.log("Modelo v1 verificado e arquivos MediaPipe preparados para uso local.");
