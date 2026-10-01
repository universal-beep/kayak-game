// Цапля: ловит рыбу (бросок клювом), а когда лодка подходит близко к берегу —
// перелетает вперёд по реке (иногда на другой берег) и встаёт снова; после
// двух перелётов улетает насовсем.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world() {
  const { K } = loadGame();
  K.resetSave(); K.G.day = 2; K.sg();
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing"; K.G.sp = 3;
  const e = { type: "heron", side: -1, wy: K.G.pwy + 60, off: 30, phase: 0.4, mode: "swim" };
  K.G.bev = [e];
  return { K, e };
}
function scare(K, e) { K.G.t = e.side*0.9; K.G.pwy = e.wy - 20; K.updBev(e); }

test("лодка подошла к берегу: цапля перелетает вперёд по реке и встаёт снова", () => {
  const { K, e } = world();
  const w0 = e.wy;
  scare(K, e);
  assert.ok(e.away && e.fly, "взлетела с перелётом");
  assert.ok(e.fly.w1 > w0 + 400, "летит вперёд по течению… то есть выше по реке");
  for (let i = 0; i < K.HERON_FLY + 2 && !e.dead; i++) K.updBev(e);
  assert.ok(!e.dead && !e.away, "приземлилась");
  assert.equal(e.hops, 1);
  assert.ok(e.wy > w0 + 400, "на новом месте");
  assert.ok(e.side === -1 || e.side === 1);
});

test("после двух перелётов улетает насовсем", () => {
  const { K, e } = world();
  for (let h = 0; h < K.HERON_HOPS; h++) {
    scare(K, e);
    for (let i = 0; i < K.HERON_FLY + 2; i++) K.updBev(e);
    assert.equal(e.hops, h + 1);
  }
  scare(K, e);
  assert.ok(e.away && !e.fly, "третий раз — просто улетает");
  for (let i = 0; i < 120 && !e.dead; i++) K.updBev(e);
  assert.ok(e.dead);
});

test("лодка далеко от берега: цапля стоит и ловит рыбу, не взлетает", () => {
  const { K, e } = world();
  K.G.t = -e.side*0.5;
  for (let i = 0; i < 600; i++) K.updBev(e);
  assert.ok(!e.away);
});

test("рисуется на всех стадиях цикла рыбалки и перелёта, с обоих берегов", () => {
  const { K, e } = world();
  K.G.scroll = e.wy - 300;
  for (const side of [-1, 1]) {
    e.side = side;
    for (let f = 0; f < 440; f += 11) { K.G.frame = f; assert.doesNotThrow(() => K.drwBev(e), "кадр " + f + " берег " + side); }
  }
  e.away = 1; e.fl = 30; e.fly = { w0: e.wy, w1: e.wy + 500, s0: -1, s1: 1 };
  assert.doesNotThrow(() => K.drwBev(e));
});
