// Темп гребли: вперёд — больше очков, назад — меньше; мир идёт с той же
// скоростью, поэтому это выбор награды, а не наказание.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world(){
  const { K, ctx } = loadGame();
  K.resetSave(); K.startDay(0); setupWorld(K, { wy: 5000 });
  K.G.s = "playing"; K.G.whiskyT = 0;
  return { K, ctx };
}

test("темп: вперёд ×1.25, назад ×0.8, нейтрально ×1", () => {
  const { K } = world();
  K.G.rowing = 1;  assert.equal(K.rowMul(), 1.25); assert.equal(K.award(100), 125);
  K.G.rowing = -1; assert.equal(K.rowMul(), 0.8);  assert.equal(K.award(100), 80);
  K.G.rowing = 0;  assert.equal(K.rowMul(), 1);    assert.equal(K.award(100), 100);
});

test("темп: виски удваивает уже с учётом гребли", () => {
  const { K } = world();
  K.G.rowing = 1; K.G.whiskyT = 100;
  assert.equal(K.award(100), 250);
  K.G.rowing = -1;
  assert.equal(K.award(100), 160);
});

test("темп: в HUD видно множитель, а не голое «разгон»", () => {
  const { K, ctx } = world();
  K.G.rowing = 1; K.G.stam = 100;
  const texts = [];
  ctx.fillText = s => texts.push(String(s));
  K.rndr();
  assert.ok(texts.includes("ТЕМП ×1.25"), "нет подписи темпа вперёд");
  K.G.rowing = -1;
  texts.length = 0;
  K.rndr();
  assert.ok(texts.includes("ТЕМП ×0.8"), "нет подписи темпа назад");
});
