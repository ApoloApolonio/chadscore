import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreRing } from "../src/components/score-ring";

test("círculos usam o valor real na acessibilidade, no arco proporcional e no texto brasileiro", () => {
  for (const value of [0, 2.3, 7.4, 10]) {
    const html = renderToStaticMarkup(createElement(ScoreRing, { value, label: "ATUAL", testId: "overall-score" }));
    assert.ok(html.includes(`aria-valuenow="${value}"`));
    assert.ok(html.includes(`stroke-dasharray="${value * 10} 100"`));
    assert.ok(html.includes(`>${value.toFixed(1).replace(".", ",")}<`));
    assert.ok(html.includes('aria-valuemin="0"'));
    assert.ok(html.includes('aria-valuemax="10"'));
    if (value === 0) assert.ok(html.includes('stroke-linecap="butt"'));
  }
});

test("sem confiança, círculo mostra traço sem inventar arco ou valor numérico", () => {
  const html = renderToStaticMarkup(createElement(ScoreRing, { value: null, label: "POTENCIAL", testId: "potential-score" }));
  assert.ok(html.includes(">—<"));
  assert.ok(html.includes("não estimado"));
  assert.ok(!html.includes("aria-valuenow"));
  assert.ok(!html.includes("stroke-dasharray"));
  assert.ok(!html.includes('role="meter"'));
});
