// Бонус «солнце»: раньше давал только очки и продлевал комбо — почти
// бесполезен. Теперь — солнечная дорожка: 8 секунд по воде впереди блестит
// путь, где можно проплыть между препятствиями. Очки и комбо остались.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world() {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  K.G.day = 6; K.sg();
  setupWorld(K, { wy: 5000, rWidth: 1 });
  K.G.s = "playing"; K.G.py = 630;
  return K;
}
function ob(K, type, t, wy, half = 26) {
  const o = { type, t, wy, vt: 0, size: 18, halfPx: half, visHalf: half, visHalfY: half, aggro: false, swingT: -1 };
  K.G.obs.push(o); return o;
}

test("солнце включает дорожку на 8 секунд и по-прежнему даёт очки", () => {
  const K = world();
  const sc = K.G.bsc || 0;
  K.apBn({ type: "sun", t: 0, wy: 5000 });
  assert.ok(K.G.sunT >= 470 && K.G.sunT <= 490, "8 секунд: " + K.G.sunT);
  assert.ok((K.G.bsc || 0) > sc, "очки");
});

test("дорожка ведёт в щель, а не через камни", () => {
  const K = world();
  // Стенка камней поперёк реки, свободно только справа.
  const wy = 5000 + 300;
  for (const t of [-0.8, -0.55, -0.3, -0.05, 0.2]) ob(K, "rock", t, wy, 30);
  K.G.sunT = 480;
  const path = K.sunPath();
  assert.ok(path.length >= 10, "точек " + path.length);
  const hw = K.widthAt(wy)/2, c = K.centerAt(wy);
  const near = path.filter(p => Math.abs(p.wy - wy) <= 30);
  assert.ok(near.length, "дорожка проходит ряд камней");
  for (const p of near)
    for (const o of K.G.obs) {
      const ox = c + o.t*hw;
      assert.ok(Math.abs(p.x - ox) > o.visHalf, "точка " + Math.round(p.x) + " в камне " + Math.round(ox));
    }
});

test("без солнца дорожки нет", () => {
  const K = world();
  K.G.sunT = 0;
  assert.equal(K.sunPath().length, 0);
});
