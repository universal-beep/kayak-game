// Мель — песчаная коса, а не лужа: после касания она остаётся на месте,
// но замедляет лодку только один раз за проход.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("мель не исчезает после касания и замедляет один раз", () => {
  const { K } = loadGame();
  K.resetSave();
  setupWorld(K, { wy: 1000 });
  K.G.s = "playing";
  K.G.sp = 6;
  const sand = { type: "shallows", t: 0, wy: 1000, halfPx: 51, vt: 0 };
  K.G.obs.push(sand);

  K.chkCl();
  assert.ok(K.G.obs.includes(sand), "мель осталась на месте");
  assert.ok(Math.abs(K.G.sp - 3.9) < 1e-9, "лодка замедлилась: " + K.G.sp);
  assert.equal(K.G.shallowsHit, 1, "касание посчитано один раз");

  K.G.sp = 6;
  K.chkCl();
  assert.ok(K.G.obs.includes(sand), "мель всё ещё на месте");
  assert.equal(K.G.sp, 6, "повторное касание той же мели не тормозит");
  assert.equal(K.G.shallowsHit, 1, "повторно не считается");
});
