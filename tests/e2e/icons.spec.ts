import { expect, test } from "@playwright/test";

const expected = [
  { rel: "icon", href: "/favicon.ico?v=2", sizes: "16x16 32x32 48x48" },
  { rel: "icon", href: "/icons/icon-16.png?v=2", sizes: "16x16" },
  { rel: "icon", href: "/icons/icon-32.png?v=2", sizes: "32x32" },
  { rel: "icon", href: "/icons/icon-48.png?v=2", sizes: "48x48" },
  { rel: "icon", href: "/icons/icon-512.png?v=2", sizes: "512x512" },
  { rel: "shortcut icon", href: "/favicon.ico?v=2", sizes: null },
  { rel: "apple-touch-icon", href: "/icons/icon-180.png?v=2", sizes: "180x180" },
];

test("página inicial anuncia todos os ícones oficiais e nenhum favicon antigo", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("ChadScore");

  for (const icon of expected) {
    const link = page.locator(`link[rel="${icon.rel}"][href="${icon.href}"]`);
    await expect(link).toHaveCount(1);
    if (icon.sizes) await expect(link).toHaveAttribute("sizes", icon.sizes);
  }

  const hrefs = await page.locator('link[rel~="icon"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  expect(hrefs.every((href) => href?.endsWith("?v=2"))).toBe(true);
  expect(hrefs.every((href) => href?.startsWith("/icons/") || href?.startsWith("/favicon.ico"))).toBe(true);
  expect(hrefs.some((href) => /favicon-(?:16|32|48)x\d+|favicon\.(?:svg|png)|vercel\.svg/i.test(href ?? ""))).toBe(false);
});

test("ícones oficiais respondem em produção com bytes, transparência e tipos corretos", async ({ page, request }) => {
  await page.goto("/");

  const pngs = [
    ["/icons/icon-16.png?v=2", 914],
    ["/icons/icon-32.png?v=2", 2_699],
    ["/icons/icon-48.png?v=2", 5_328],
    ["/icons/icon-180.png?v=2", 50_645],
    ["/icons/icon-512.png?v=2", 322_276],
  ] as const;

  for (const [url, size] of pngs) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()["content-type"], url).toMatch(/^image\/png/);
    const body = await response.body();
    expect(body.length, url).toBe(size);
    expect([...body.subarray(0, 8)], url).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    // PNG IHDR: bit depth, color type 6 (RGBA) e sem chunk tRNS.
    expect(body.readUInt8(24), url).toBe(8);
    expect(body.readUInt8(25), url).toBe(6);
    expect(body.includes(Buffer.from("tRNS")), url).toBe(false);
  }

  const ico = await request.get("/favicon.ico?v=2");
  expect(ico.status()).toBe(200);
  expect(ico.headers()["content-type"]).toMatch(/^image\/(?:x-icon|vnd\.microsoft\.icon)/);
  const icoBody = await ico.body();
  expect(icoBody.length).toBe(8_995);
  expect(icoBody.readUInt16LE(0)).toBe(0);
  expect(icoBody.readUInt16LE(2)).toBe(1);
  expect(icoBody.readUInt16LE(4)).toBe(3);
  expect(icoBody.readUInt16LE(6 + 6)).toBe(32);

  const direct = await request.get("/favicon.ico");
  expect(direct.status()).toBe(200);
  expect((await direct.body()).equals(icoBody)).toBe(true);
});
