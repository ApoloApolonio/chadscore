import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPotential, classifyPSL, formatScore, roundScore } from "../src/lib/score-classification";

test("classificação PSL respeita todos os limites da tabela", () => {
  const bands = [
    [0, 1.1, "Sub 3"], [1.2, 2.2, "Sub 5"], [2.3, 3.3, "LTN"],
    [3.4, 4.4, "MTN"], [4.5, 5.5, "HTN"], [5.6, 6.6, "Chadlite"],
    [6.7, 7.7, "Chad"], [7.8, 8.8, "Adam"], [8.9, 10, "True Adam"],
  ] as const;
  for (const [min, max, expected] of bands) {
    assert.equal(classifyPSL(min), expected);
    assert.equal(classifyPSL(max), expected);
  }
  for (let tenth = 0; tenth <= 100; tenth += 1) assert.ok(classifyPSL(tenth / 10));
});

test("potencial usa as faixas solicitadas, sem preencher uma previsão indisponível", () => {
  for (const [min, max, label] of [
    [0, 2.9, "Baixo"], [3, 4.9, "Mediano"], [5, 6.9, "Bom"],
    [7, 8.4, "Alto"], [8.5, 10, "Muito alto"],
  ] as const) {
    assert.equal(classifyPotential(min), label);
    assert.equal(classifyPotential(max), label);
  }
  assert.equal(classifyPotential(null), "Não estimado");
  assert.equal(formatScore(null), "—");
});

test("notas são formatadas em pt-BR com vírgula e uma casa decimal", () => {
  assert.equal(formatScore(0), "0,0");
  assert.equal(formatScore(7.7), "7,7");
  assert.equal(formatScore(10), "10,0");
  assert.equal(formatScore(1.15), "1,2");
  assert.equal(classifyPSL(1.15), "Sub 5");
  assert.equal(classifyPSL(7.75), "Adam");
  assert.equal(classifyPSL(null), "—");
  assert.equal(roundScore(8.86), 8.9);
});

test("valores inválidos não geram classificações ou notas fictícias", () => {
  for (const value of [-1, 10.1, NaN, Infinity]) {
    assert.throws(() => classifyPSL(value));
    assert.throws(() => classifyPotential(value));
    assert.throws(() => formatScore(value));
  }
});
