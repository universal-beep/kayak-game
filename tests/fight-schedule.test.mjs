// Злые гребцы: в день знакомства (3-й) их много, потом по одному-два как
// элемент реки, в финале снова ватага. Расписание встреч выполняется на деле.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("расписание: знакомство на 3-м дне густое, середина редкая, финал снова густой", () => {
  const { K } = loadGame();
  const total = d => K.fightsTotal(K.LEVELS[d - 1]);
  assert.equal(total(1), 0); assert.equal(total(2), 0);
  assert.ok(total(3) >= 8, "знакомство: " + total(3));
  assert.ok(total(4) >= 6, "закрепление: " + total(4));
  for (const d of [5, 6, 7, 8]) assert.ok(total(d) >= 1 && total(d) <= 3, `день ${d}: ${total(d)}`);
  assert.ok(total(9) >= 8, "финал: " + total(9));
  for (const d of [3, 4, 9]) for (const m of [5, 6, 7, 8]) assert.ok(total(d) > total(m), `день ${d} гуще дня ${m}`);
});

test("случайная доля злых после знакомства падает, а не растёт", () => {
  const { K } = loadGame();
  const a = d => K.LEVELS[d - 1].aggro;
  assert.ok(a(3) >= a(4) && a(4) > a(5));
  for (const d of [5, 6, 7, 8]) assert.ok(a(d) <= 0.15, `день ${d}`);
});

test("цели парирований достижимы: злых больше, чем нужно парировать", () => {
  const { K } = loadGame();
  for (const L of K.LEVELS) if (L.goal === "parries") assert.ok(K.fightsTotal(L) >= L.need*2, `день ${L.day}`);
});

function day(d) {
  const { K } = loadGame();
  K.resetSave();
  K.G.day = d - 1; K.sg();
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  return K;
}

test("встреча выходит по доле пути: гребцы по одному с паузой, все злые", () => {
  const K = day(3), L = K.LEVELS[2];
  K.G.dist = L.len*0.05;
  for (let i = 0; i < 5; i++) K.fightStep();
  assert.equal(K.G.obs.length, 0, "рано");
  K.G.dist = L.len*0.31;                       // вторая встреча: трое
  let frames = 0;
  while (K.G.fightIdx < 3 && frames++ < 10) K.fightStep();
  // первая встреча (n=1) пропущена по дистанции, но идёт по порядку: доводим расписание
  let guard = 0;
  while ((K.G.fightLeft || K.G.fightIdx < 2) && guard++ < 2000) { K.G.dist = L.len*0.31; K.fightStep(); if (guard % 40 === 0) K.G.obs.forEach(o => { o.wy -= 900; }); }
  const fighters = K.G.obs.filter(o => o.type === "kayaker" && o.aggro);
  assert.ok(K.G.fightIdx >= 2);
  assert.ok(fighters.every(o => o.aggro && o.variant === K.AGGRO_VARIANT));
});

test("все встречи дня выполняются и выпускают ровно столько гребцов, сколько в расписании", () => {
  for (const d of [3, 9]) {
    const K = day(d), L = K.LEVELS[d - 1];
    let spawned = 0, f = 0;
    const seen = new Set();
    for (; f < 20000 && (K.G.fightIdx < L.fights.length || K.G.fightLeft); f++) {
      K.G.dist = Math.min(L.len - 200, L.len*L.fights[Math.min(K.G.fightIdx, L.fights.length - 1)].at + 1);
      K.fightStep();
      for (const o of K.G.obs) if (!seen.has(o)) { seen.add(o); spawned++; }
      K.G.obs = [];                              // уплыли — место свободно
    }
    assert.ok(f < 20000, "день " + d + " не уложился");
    assert.equal(spawned, K.fightsTotal(L), "день " + d);
  }
});

test("первая встреча объясняется один раз", () => {
  const K = day(3);
  K.G.dist = K.LEVELS[2].len*0.11;
  for (let i = 0; i < 3; i++) K.fightStep();
  assert.ok(K.G.fightShown);
});

test("на своём уровне и в дни без расписания встреч нет", () => {
  const K = day(1);
  K.G.dist = 400; for (let i = 0; i < 50; i++) K.fightStep();
  assert.equal(K.G.obs.length, 0);
});
