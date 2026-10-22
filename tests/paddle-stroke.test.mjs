// D1: гребок — дискретное событие. На каждый гребок один звук и всплеск,
// весло ходит по сторонам, лодка качается в пределах ±5 % высоты.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world(){
  const { K } = loadGame();
  K.resetSave(); K.startDay(0); setupWorld(K, { wy: 5000 });
  K.G.s = "playing"; K.G.stam = 100; K.G.btnFwd = true;
  return K;
}

test("гребок: звук и всплеск на каждый гребок, не каждый кадр", () => {
  const K = world();
  let strokes = 0;
  for (let i = 0; i < 70; i++){
    const before = new Set(K.G.pts);
    K.upd();
    if (K.G.strokes > strokes){
      strokes = K.G.strokes;
      assert.equal(K.G.sfxLast, "paddle", "гребок звучит");
      assert.equal(K.G.pts.filter(p => !before.has(p)).length, 4, "на гребке есть всплеск");
    }
  }
  assert.ok(strokes >= 3, "за 70 кадров несколько гребков");
  assert.ok(strokes < 70, "звук не на каждом кадре");
});

test("гребок: активная фаза 2–3 кадра, лодка качается на ±5 %", () => {
  const K = world();
  let active = 0;
  for (let i = 0; i < 12; i++){
    K.upd();
    assert.ok(K.G.rowActive <= 3, "фаза не длиннее трёх кадров");
    if (K.G.rowActive > 0) active++;
  }
  assert.ok(active >= 2 && active <= 3, "гребок виден 2–3 кадра");

  K.G.rowActive = 2; K.G.rowSide = 1;
  assert.equal(K.strokeLift(), 0.05);
  K.G.rowSide = -1;
  assert.equal(K.strokeLift(), -0.05);
  K.G.rowActive = 0;
  assert.equal(K.strokeLift(), 0);
});
