// На Медведице по колее вдоль берега едут трое велосипедистов — сверху вниз
// по экрану, навстречу байдарке, и звенят звонком, проезжая мимо. На Волге
// их нет: там своё — пляжи и купающиеся.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("велосипедисты на Медведице, не на Волге", () => {
  const { K } = loadGame();
  assert.ok(K.BEV_POOLS[1].includes("cyclists"), "Медведица");
  assert.ok(!K.BEV_POOLS[0].includes("cyclists"), "не Волга");
  for (const n of ["cyclist0", "cyclist1"]) assert.ok(K.SPR[n], "нет спрайта " + n);
});

test("трое едут сверху вниз по экрану и один раз звенят, проезжая мимо", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 1000 });
  const e = { type: "cyclists", side: 1, wy: 1400, phase: 0 };
  K.G.frame = 0; K.G.sfxLast = "";
  const y0 = [0, 1, 2].map(i => K.screenYOf(K.cyclistWy(e, i)));
  let rang = 0;
  for (let f = 1; f <= 600; f++) {
    K.G.frame = f; K.G.sfxLast = ""; K.updBev(e);
    if (K.G.sfxLast === "ring") rang++;
  }
  const y1 = [0, 1, 2].map(i => K.screenYOf(K.cyclistWy(e, i)));
  for (let i = 0; i < 3; i++) assert.ok(y1[i] > y0[i] + 100, "едет вниз по экрану: " + i);
  assert.equal(new Set(y0).size, 3, "едут друг за другом, не в одной точке");
  assert.equal(rang, 1, "звонок один раз");
});

test("колея из двух широких тропок: по одной едет один, по другой — двое", () => {
  const { K } = loadGame();
  const lanes = [0, 1, 2].map(i => K.cyclistLane(i));
  assert.notEqual(lanes[0], lanes[1], "первый — на своей тропке");
  assert.equal(lanes[1], lanes[2], "двое других — на второй");
  assert.ok(Math.abs(lanes[0] - lanes[1]) >= 36, "тропки разнесены: " + Math.abs(lanes[0] - lanes[1]));
});

test("колея — это дорога: сплошное земляное полотно, на нём колеи темнее", () => {
  const { K, ctx } = loadGame();
  setupWorld(K, { wy: 1400 - K.PY + 360 });
  K.G.rBend = 0; K.G.frame = 10;
  const rects = [];
  const orig = ctx.fillRect;
  ctx.fillRect = function (x, y, w, h) { rects.push({ w, h, c: this.fillStyle }); };
  K.drwBev({ type: "cyclists", side: 1, wy: 1400, phase: 0, f0: 0 });
  ctx.fillRect = orig;
  const bed = rects.filter(r => r.w >= 40);
  assert.ok(bed.length > 10, "полотно дороги: широких полос " + bed.length);
  const colors = new Set(rects.map(r => r.c));
  assert.ok(colors.size >= 3, "полотно, колеи и трава между ними: цветов " + colors.size);
});
