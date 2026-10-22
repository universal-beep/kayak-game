// D3: тряска — детерминированная, направленная, с силой от события;
// выключается тумблером и системной настройкой «меньше движения».
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

test("тряска: направление меняется, случайности нет", () => {
  const { K } = loadGame();
  const right = K.shakeOffset(1, 20, 1);
  const left = K.shakeOffset(1, 20, -1);
  assert.ok(right.x > 0, "вправо по направлению");
  assert.ok(left.x < 0, "влево по направлению");
  const again = K.shakeOffset(1, 20, 1);
  assert.equal(again.x, right.x, "повтор — тот же сдвиг");
  assert.equal(again.y, right.y);
  assert.equal(K.shakeOffset(1, 0, 1).x, 0, "без силы нет тряски");
});

test("тряска: тумблер выключает и возвращает", () => {
  const { K } = loadGame();
  K.toggleShake();
  const off = K.shakeOffset(1, 20, 1);
  assert.equal(off.x, 0); assert.equal(off.y, 0);
  K.toggleShake();
  assert.ok(K.shakeOffset(1, 20, 1).x > 0);
});

test("тряска: сила растёт от события", () => {
  const { K } = loadGame();
  const small = Math.abs(K.shakeOffset(1, 5, 1).x);
  const big = Math.abs(K.shakeOffset(1, 20, 1).x);
  assert.ok(big > small, "сильный удар трясёт сильнее");
});
