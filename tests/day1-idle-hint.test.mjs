// День 1 — обучение: если игрок не тронул управление, через 7 секунд
// появляется подсказка; кто сразу греб или рулил — подсказки не видит.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function day1() {
  const { K } = loadGame();
  K.resetSave();
  K.G.day = 0;
  K.sg();
  return K;
}

test("без единого нажатия за 7 секунд появляется подсказка про управление", () => {
  const K = day1();
  for (let i = 0; i < 419; i++) { K.G.df = 0; K.upd(); }
  assert.ok(!K.G.hint || !/УПРАВЛЯТЬ/.test(K.G.hint.text), "раньше времени");
  for (let i = 0; i < 3; i++) { K.G.df = 0; K.upd(); }
  assert.ok(K.G.hint && /УПРАВЛЯТЬ/.test(K.G.hint.text));
});

test("кто начал грести, подсказки не получает", () => {
  const K = day1();
  K.G.btnFwd = true;
  for (let i = 0; i < 500; i++) { K.G.df = 0; K.upd(); if (K.G.s !== "playing") break; }
  assert.ok(!K.G.hint || !/УПРАВЛЯТЬ/.test(K.G.hint.text));
  assert.ok(K.G.movedOnce);
});

test("на других днях подсказки нет", () => {
  const { K } = loadGame();
  K.G.day = 2; K.sg();
  for (let i = 0; i < 430; i++) { K.G.df = 0; K.upd(); if (K.G.s !== "playing") break; }
  assert.ok(!K.G.hint || !/УПРАВЛЯТЬ/.test(K.G.hint.text));
});
