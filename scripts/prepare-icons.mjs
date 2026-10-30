import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = new URL("../assets/chadscore-icon.png", import.meta.url);
const destination = new URL("../public/icons/", import.meta.url);
const sizes = [16, 32, 48, 180, 512];

await mkdir(destination, { recursive: true });

const rendered = new Map();
for (const size of sizes) {
  const { data, info } = await sharp(await readFile(source))
    .rotate()
    .ensureAlpha()
    .resize(size, size, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer({ resolveWithObject: true });
  if (info.width !== size || info.height !== size) {
    throw new Error(`Ícone ${size}×${size} gerado como ${info.width}×${info.height}.`);
  }
  rendered.set(size, data);
  await writeFile(new URL(`icon-${size}.png`, destination), data);
}

/** ICO moderno com frames PNG 16/32/48; preserva o mesmo desenho dos arquivos PNG. */
function buildIco(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...frames.map(({ data }) => data)]);
}

const ico = buildIco([16, 32, 48].map((size) => ({ size, data: rendered.get(size) })));
await writeFile(new URL("../public/favicon.ico", import.meta.url), ico);

console.log(`Ícones gerados: ${sizes.join(", ")} px e favicon.ico (16/32/48).`);
