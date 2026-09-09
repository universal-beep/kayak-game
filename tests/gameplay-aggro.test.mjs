// Спавн и распознавание агрессоров.
// 1) Объекты спавнятся далеко за верхней кромкой (не «материализуются» у края).
// 2) Агрессивный соперник замахивается борт-о-борт, спокойный — никогда.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const { K } = loadGame();

test("спавн далеко за верхней кромкой экрана", () => {
  setupWorld(K);
  const lead = K.spawnWy() - K.G.scroll;
  assert.ok(lead >= 200, "объекты должны спавниться минимум за 200px до появления в кадре, сейчас " + lead);
});

function makeRower(o) {
  K.G.obs.push({ t: 0, wy: K.G.pwy, type: "kayaker", size: 18, halfPx: 14, visHalf: 30,
                 sprite: undefined, variant: 0, vt: 0, aggro: o.aggro, swingT: -1, flipT: 0 });
}

test("борт-о-борт агрессивный замахивается, спокойный — нет", () => {
  setupWorld(K);
  K.G.s = "playing"; K.G.inv = 0; K.G.whiskyT = 0; K.G.taughtParry = false;
  K.G.t = 0; K.G.pwy = 1000;
  K.G.obs = [];
  makeRower({ aggro: true });   // первый — злой
  makeRower({ aggro: false });  // второй — мирный
  const angry = K.G.obs[0], calm = K.G.obs[1];
  // Развести по бортам, чтобы не мешали друг другу.
  angry.t = 0.35; calm.t = -0.35;

  K.upd();

  assert.ok(angry.swingT >= 0, "агрессор должен начать замах борт-о-борт");
  assert.equal(K.fightFrame(angry), "rower_wind", "в замахе показывается кадр rower_wind");
  assert.equal(calm.swingT, -1, "мирный соперник не замахивается");
  assert.equal(calm.aggro, false, "мирный соперник остаётся мирным");
  assert.equal(K.fightFrame(calm), null, "у мирного нет боевого кадра");
});