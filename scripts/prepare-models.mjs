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

const models = [
  {
    name: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    hash: "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
  },
  {
    name: "selfie_multiclass_256x256.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite",
    hash: "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0",
  },
];
for (const asset of models) {
  const path = new URL(asset.name, destination);
  let model;
  try {
    model = await readFile(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    console.log(`Baixando modelo público v1: ${asset.name} (nenhuma foto é enviada)...`);
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Falha ao baixar modelo: HTTP ${response.status}`);
    model = Buffer.from(await response.arrayBuffer());
  }
  if (createHash("sha256").update(model).digest("hex") !== asset.hash) {
    throw new Error(`SHA-256 inválido para ${asset.name}. O modelo não será utilizado.`);
  }
  await writeFile(path, model);
}
console.log("Modelos v1 verificados e arquivos MediaPipe preparados para uso local.");
