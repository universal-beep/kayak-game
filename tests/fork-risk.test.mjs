// C2: развилка — узкий рукав рискован, но проходим; награда только за
// чистый выход. Камень в узком рукаве не должен превращать его в стену.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world(day = 3, rWidth = 0.85) {
  const { K } = loadGame();
  K.resetSave();
  K.G.day = day - 1; K.sg();
  setupWorld(K, { wy: 5000, t: 0, rWidth });
  K.G.s = "playing"; K.G.py = 630;
  return K;
}

test("развилка: в узком рукаве один камень, проход не уже 42 px", () => {
  const K = world();
  K.G.scroll = 5000; K.G.forks = []; K.G.obs = [];
  K.ensureForks(12000);
  const fk = K.G.forks.find(f => f.rock);
  assert.ok(fk, "камень в развилке есть");
  const r = fk.rock;
  assert.equal(r.forkRock, true);
  assert.equal(K.G.obs.filter(o => o.forkRock).length, K.G.forks.length);
  assert.equal(K.forkPassGap(r.t, r.wy), K.FORK_PASS_GAP);
  assert.ok(K.leavesPassage(r.t, r.wy, r.visHalf, r.visHalfY, K.FORK_PASS_GAP),
    "щель 42 px остаётся");
  assert.equal(K.inIsland(r.t, r.wy), false, "камень не на острове");
});

test("развилка: риск не раздвигает keepPassage", () => {
  const K = world();
  K.G.scroll = 5000; K.G.forks = []; K.G.obs = [];
  K.ensureForks(12000);
  const r = K.G.forks.find(f => f.rock).rock;
  const t0 = r.t;
  K.G.scroll = 0;                     // камень далеко впереди, но keepPassage его видит
  K.keepPassage();
  assert.equal(r.t, t0, "камень остался на месте");
  assert.ok(K.G.obs.includes(r), "камень не исчез");
});

test("развилка: узкий рукав даёт 120 только за чистый выход", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000; K.G.t = -0.8; K.G.rowing = 0;
  const fk = { start: 4800, end: 5700, center: -0.12, half: 0.19, narrowLeft: true, taken: 0 };
  K.G.forks = [fk]; K.G.obs = []; K.G.bns = [];
  K.upd();
  assert.equal(fk.taken, -1, "вошли в узкий");
  assert.equal(K.G.bsc, 0, "внутри рукава ещё не награда");
  K.G.scroll = 5600; K.G.pwy = 5701; K.upd();
  assert.equal(K.G.bsc, 120, "чистый узкий — 120");
  assert.ok(K.G.pops.some(p => p.text.includes("УЗКИМ РУКАВОМ")), "поп-ап награды");
});

test("развилка: удар в узком рукаве снимает награду", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000; K.G.t = -0.8; K.G.rowing = 0;
  const fk = { start: 4800, end: 5700, center: -0.12, half: 0.19, narrowLeft: true, taken: 0 };
  K.G.forks = [fk]; K.G.obs = []; K.G.bns = [];
  K.upd();
  fk.hit = true;
  K.G.scroll = 5600; K.G.pwy = 5701; K.upd();
  assert.equal(K.G.bsc, 0, "грязный узкий без награды");
  assert.ok(K.G.pops.some(p => p.text.includes("НО С УДАРОМ")), "поп-ап удара");
});

test("развилка: широкий рукав не даёт бонус за узкий", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000; K.G.t = 0.8; K.G.rowing = 0;
  const fk = { start: 4800, end: 5700, center: -0.12, half: 0.19, narrowLeft: true, taken: 0 };
  K.G.forks = [fk]; K.G.obs = []; K.G.bns = [];
  K.upd();
  K.G.scroll = 5600; K.G.pwy = 5701; K.upd();
  assert.equal(K.G.bsc, 0, "широкий без награды");
});
