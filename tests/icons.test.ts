import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { siteIcons } from "../src/lib/site-icons";

const generated = [16, 32, 48, 180, 512] as const;
const pngPath = (size: number) => `public/icons/icon-${size}.png`;
const bytes = (path: string) => readFileSync(path);

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

test("metadados do App Router declaram ícone, atalho e apple-touch com os tamanhos oficiais", () => {
  const icons = asArray(siteIcons.icon);
  assert.deepEqual(
    icons.map(({ url, sizes, type }) => ({ url, sizes, type })),
    [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  );
  assert.deepEqual(asArray(siteIcons.shortcut).map(({ url }) => url), ["/favicon.ico"]);
  assert.deepEqual(
    asArray(siteIcons.apple).map(({ url, sizes, type }) => ({ url, sizes, type })),
    [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  );

  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /import \{ siteIcons \} from "@\/lib\/site-icons"/);
  assert.match(layout, /icons: siteIcons/);
  assert.doesNotMatch(layout, /favicon\.(?:svg|png)|icon-\d+x\d+/i);
});

test("fonte versionada é exatamente a imagem anexada, quadrada e sem artefatos de recorte", async () => {
  const source = bytes("assets/chadscore-icon.png");
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    "04fbb5712808764a718820feae5386c8f73cbf801ab867e56c6da6ecf16b7595",
  );
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 1254);
  assert.equal(metadata.height, 1254);
  assert.equal(metadata.hasAlpha, false);
});

test("PNGs oficiais têm dimensões exatas, fundo preto preservado e azul do círculo presente", async () => {
  const limits = new Map([
    [16, 2_000],
    [32, 5_000],
    [48, 8_000],
    [180, 60_000],
    [512, 350_000],
  ]);

  for (const size of generated) {
    const path = pngPath(size);
    const file = bytes(path);
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, "png", path);
    assert.equal(metadata.width, size, path);
    assert.equal(metadata.height, size, path);
    assert.equal(metadata.hasAlpha, false, path);
    assert.ok(file.length <= limits.get(size)!, `${path} deveria estar otimizado (${file.length} B)`);

    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 3, path);
    const pixel = (x: number, y: number) => {
      const index = (y * info.width + x) * info.channels;
      return [data[index], data[index + 1], data[index + 2]];
    };
    for (const [x, y] of [
      [0, 0],
      [size - 1, 0],
      [0, size - 1],
      [size - 1, size - 1],
    ]) {
      assert.ok(Math.max(...pixel(x, y)) <= 32, `${path} deveria manter o fundo preto em ${x},${y}`);
    }

    if (size === 512) {
      let blue = 0;
      for (let index = 0; index < data.length; index += info.channels) {
        if (data[index + 2] > 140 && data[index + 2] > data[index] + 50) blue++;
      }
      assert.ok(blue > 5_000, `círculo azul ausente ou apagado (${blue} px)`);
    }
  }
});

test("favicon.ico multi-resolução contém frames PNG 16, 32 e 48 coerentes com os PNGs oficiais", async () => {
  const ico = bytes("public/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);

  const expected = [16, 32, 48];
  let nextOffset = 6 + 16 * expected.length;
  for (const [index, size] of expected.entries()) {
    const entry = 6 + 16 * index;
    assert.equal(ico.readUInt8(entry), size);
    assert.equal(ico.readUInt8(entry + 1), size);
    assert.equal(ico.readUInt8(entry + 2), 0);
    assert.equal(ico.readUInt8(entry + 3), 0);
    assert.equal(ico.readUInt16LE(entry + 4), 1);
    assert.equal(ico.readUInt16LE(entry + 6), 32);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.equal(offset, nextOffset);
    assert.deepEqual([...ico.subarray(offset, offset + 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const frame = ico.subarray(offset, offset + length);
    assert.deepEqual(frame, bytes(pngPath(size)), `frame ${size} deveria ser idêntico ao PNG oficial`);
    const metadata = await sharp(frame).metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
    nextOffset += length;
  }
  assert.equal(nextOffset, ico.length);
});
