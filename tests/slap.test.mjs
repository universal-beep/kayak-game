// Удар веслом по «своим» — мирному байдарочнику: шлепок, нашу байдарку чуть
// отбрасывает, его — в другую сторону, без переворота и очков. По корове —
// мычит и отходит к своему берегу, нас тоже отбрасывает.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world() {
  const { K } = loadGame();
  setupWorld(K); K.G.s = "playing"; K.G.t = 0; K.G.vt = 0; K.G.sfxLast = "";
  return K;
}

test("шлёп по своему: звук, нас отбрасывает, его тоже, но не переворачивается", () => {
  const K = world();
  const o = { t: 0.2, wy: K.G.pwy, type: "kayaker", size: 20, halfPx: 14, visHalf: 28, vt: 0, swingT: -1, aggro: false, flipT: 0 };
  K.G.obs.push(o);
  const sc0 = K.G.bsc || 0;
  K.paddleStrike();
  assert.equal(K.G.sfxLast, "slap", "шлепок");
  assert.ok(K.G.vt < 0, "нас отбросило от него (он справа): vt=" + K.G.vt);
  assert.ok(!(o.flipT > 0), "не переворачивается");
  assert.equal(K.G.bsc || 0, sc0, "очков за своих нет");
  const t0 = o.t;
  for (let i = 0; i < 30; i++) K.stepShove(o);
  assert.ok(o.t > t0 + 0.02, "его отнесло в другую сторону");
});

test("удар по корове: мычит и отходит к своему берегу", () => {
  const K = world();
  const cow = { type: "rock", cow: true, sprite: "cow_water", t: -0.15, wy: K.G.pwy, vt: 0, halfPx: 30, visHalf: 40, visHalfY: 20 };
  K.G.obs.push(cow);
  K.paddleStrike();
  assert.equal(K.G.sfxLast, "moo", "мычит");
  assert.ok(K.G.vt > 0, "нас отбросило от коровы (она слева)");
  const t0 = cow.t;
  for (let i = 0; i < 30; i++) K.stepShove(cow);
  assert.ok(cow.t < t0 - 0.02, "корова отошла к своему берегу");
  assert.ok(K.G.obs.includes(cow), "корова осталась в реке");
});
