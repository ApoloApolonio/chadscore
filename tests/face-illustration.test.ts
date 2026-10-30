import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FaceIllustration } from "../src/components/face-illustration";

test("rosto ilustrado é wireframe transparente, detalhado e simétrico, sem assets externos", () => {
  const html = renderToStaticMarkup(createElement(FaceIllustration));
  assert.ok(html.includes('aria-hidden="true"'));
  assert.ok(html.includes('data-illustration="stylized-male"'));
  assert.ok(html.includes('viewBox="0 0 400 400" fill="none"'));
  assert.ok(html.includes('transform="translate(400 0) scale(-1 1)"'));
  assert.doesNotMatch(html, /<image|href=|<script|foreignObject|https?:/i);
  const nodes = html.match(/<g class="illustration-points">(.*?)<\/g>/)![1];
  const coordinates = [...nodes.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)].map(([, x, y]) => [Number(x), Number(y)]);
  assert.ok(coordinates.length > 100);
  const unique = new Set(coordinates.map(([x, y]) => `${x},${y}`));
  assert.equal(unique.size, coordinates.length);
  for (const [x, y] of coordinates) {
    assert.ok(x >= 0 && x <= 400 && y >= 0 && y <= 400);
    assert.ok(unique.has(`${400 - x},${y}`), `Par simétrico ausente: ${x},${y}`);
  }
  const colors = [...html.matchAll(/(?:stroke|fill)="(#[a-f\d]+)"/gi)].map(([, color]) => color.toUpperCase());
  assert.ok(colors.every((color) => ["#8CCBFF", "#EDF5FF"].includes(color)));
});

test("interface não conserva tokens nem cores da antiga paleta verde; ilustração não entra nas fórmulas", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /--card: #111216/);
  assert.match(css, /--ice: #8ccbff/);
  assert.doesNotMatch(css, /--mint|#a0f2da|#d1f8ec|#b2e9e8|#111313|#effffb|#7dd8ff/i);
  for (const file of readdirSync("src/components").filter((file) => file.endsWith(".tsx"))) {
    assert.doesNotMatch(readFileSync(join("src/components", file), "utf8"), /#a0f2da|#d1f8ec|#b2e9e8|(?:text|bg|border|shadow)-(?:green|teal|emerald|lime)-/i);
  }
  for (const file of readdirSync("src/lib").filter((file) => file.endsWith(".ts"))) {
    assert.doesNotMatch(readFileSync(join("src/lib", file), "utf8"), /face-illustration|stylized-male/);
  }
});
