// D4: холст набирается в DPR-бэкинге, контекст масштабируется, CSS-размер
// прежний; спрайты в катсценах/лагере — целыми пикселями 1/2/3.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadGame } from "./harness.mjs";

test("рендер: бэкинг = W×dpr, контекст масштабируется", () => {
  const { K, ctx } = loadGame(undefined, { dpr: 2 });
  assert.equal(K.dpr(), 2);
  assert.equal(K.viewW(), 420);
  assert.equal(K.viewH(), 720);
  const b = K.canvasBacking(420, 720, 2);
  assert.equal(b.w, 840);
  assert.equal(b.h, 1440);
  assert.deepEqual(ctx.lastTransform.slice(0, 4), [2, 0, 0, 2]);
});

test("рендер: pixelated в CSS", () => {
  const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
  assert.match(html, /#game\s*\{[^}]*image-rendering:pixelated/);
});

test("спрайты: дробные масштабы сцен — к целым пикселям", () => {
  const { K } = loadGame();
  assert.ok(Math.abs(K.pixelScale(0.55) - 2/3) < 1e-9);
  assert.ok(Math.abs(K.pixelScale(0.9) - 1) < 1e-9);
  assert.ok(Math.abs(K.pixelScale(1.73) - 5/3) < 1e-9);
});
