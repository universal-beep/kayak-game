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
