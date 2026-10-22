// Комбо знакомится цепочкой бонусов на первых двух днях, а не впервые
// на восьмом, где оно уже становится целью.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world(day){
  const { K } = loadGame();
  K.resetSave(); K.startDay(day); setupWorld(K, { wy: 5000 });
  K.G.s = "playing"; K.G.combo = 0; K.G.comboT = 0; K.G.pops = [];
  return K;
}
const hasComboHint = K => K.G.pops.some(p => /КОМБО/.test(p.text));

test("комбо: на первом дне цепочка бонусов показывает ×2", () => {
  const K = world(0);
  K.apBn({ type: "bread", t: 0, wy: K.G.pwy });
  assert.equal(K.G.combo, 1, "первый бонус — начало цепочки");
  assert.equal(hasComboHint(K), false);
  K.apBn({ type: "bread", t: 0, wy: K.G.pwy });
  assert.equal(K.G.combo, 2, "второй бонус подряд — ×2");
  assert.equal(K.G.maxCombo, 2);
  assert.ok(hasComboHint(K), "подсказка «КОМБО ×2»");
});

test("комбо: знакомство не повторяется на следующий день", () => {
  const K = world(0);
  K.apBn({ type: "bread", t: 0, wy: K.G.pwy });
  K.apBn({ type: "bread", t: 0, wy: K.G.pwy });
  K.save.seen.combo = 1;
  K.G.pops = []; K.G.combo = 0; K.G.comboT = 0; K.G.day = 1;
  K.apBn({ type: "bread", t: 0, wy: K.G.pwy });
  K.apBn({ type: "bread", t: 0, wy: K.G.pwy });
  assert.equal(K.G.combo, 2);
  assert.equal(hasComboHint(K), false, "второй раз подсказку не показываем");
});

test("комбо: на восьмом дне бонус сам цепочку не вводит", () => {
  const K = world(7);
  K.apBn({ type: "bread", t: 0, wy: K.G.pwy });
  K.apBn({ type: "bread", t: 0, wy: K.G.pwy });
  assert.equal(K.G.combo, 0, "бонусы не заменяют цель дня");
  assert.equal(hasComboHint(K), false);
});
