import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { faceAnalysisProvider } from "../src/lib/face-analysis";
import { syntheticDetection } from "./fixtures/landmarks";

function harness(t: TestContext, mode: "success" | "error" | "messageerror" | "throw" | "pending" | "late") {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  let start!: () => void;
  const started = new Promise<void>((resolve) => { start = resolve; });
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
    terminations = 0;
    constructor() { workers.push(this); }
    postMessage() {
      start();
      if (mode === "throw") throw new DOMException("Clone failed", "DataCloneError");
      if (mode === "pending") return;
      const message = this.onmessage, error = this.onerror;
      queueMicrotask(() => {
        if (mode === "success") this.onmessage?.({ data: syntheticDetection() } as MessageEvent);
        if (mode === "error" || mode === "late") error?.({} as ErrorEvent);
        if (mode === "messageerror") this.onmessageerror?.({} as MessageEvent);
        // Simulate a callback already queued when the first failure settled.
        if (mode === "late") message?.({ data: syntheticDetection() } as MessageEvent);
      });
    }
    terminate() { this.terminations++; }
  }
  class TestImage { src = ""; naturalWidth = 640; naturalHeight = 480; async decode() {} }
  for (const [key, value] of Object.entries({ Worker: FakeWorker, Image: TestImage, OffscreenCanvas: class {}, createImageBitmap: () => {} })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "local.png", { type: "image/png" });
  const assertDisposed = () => {
    assert.equal(workers.length, 1);
    assert.equal(workers[0].terminations, 1);
    assert.equal(workers[0].onmessage, null);
    assert.equal(workers[0].onerror, null);
    assert.equal(workers[0].onmessageerror, null);
  };
  return { file, started, assertDisposed };
}

for (const [mode, message] of [
  ["error", /carregar a análise local/], ["messageerror", /ler a resposta/],
  ["throw", /processar este arquivo/], ["late", /carregar a análise local/],
] as const) test(`worker: ${mode} rejeita imediatamente e libera todos os handlers uma única vez`, async (t) => {
  const h = harness(t, mode);
  await assert.rejects(faceAnalysisProvider.analyze(h.file), message);
  h.assertDisposed();
});

test("worker: sucesso libera handlers e listener de cancelamento", async (t) => {
  const h = harness(t, "success"), abort = new AbortController();
  const remove = t.mock.method(abort.signal, "removeEventListener");
  const result = await faceAnalysisProvider.analyze(h.file, abort.signal);
  assert.ok(result.report.score !== null);
  assert.equal(remove.mock.callCount(), 1);
  abort.abort();
  h.assertDisposed();
});

test("worker: timeout de 60s e cancelamento não deixam processamento pendente", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness(t, "pending");
  const rejected = assert.rejects(faceAnalysisProvider.analyze(h.file), /demorou demais/);
  await h.started;
  t.mock.timers.tick(60_000);
  await rejected;
  h.assertDisposed();
});

test("worker: cancelamento ativo limpa timer, listeners e handlers", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness(t, "pending"), abort = new AbortController();
  const rejected = assert.rejects(faceAnalysisProvider.analyze(h.file, abort.signal), { name: "AbortError" });
  await h.started;
  abort.abort();
  await rejected;
  t.mock.timers.tick(60_000);
  h.assertDisposed();
});
