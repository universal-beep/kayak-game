// Мазай и зайцы (день 5): значок -> 30 секунд -> 10 зайцев на островках;
// 80% и больше — яхта до конца уровня (быстрее, не боится препятствий, кроме баржи).
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function day5() {
  const { K } = loadGame();
  K.resetSave(); K.G.day = 4; K.sg();
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing"; K.G.hp = 3; K.G.inv = 0;
  return K;
}

test("значок Мазая только на 5-м дне, и не в своём уровне", () => {
  const { K } = loadGame();
  K.LEVELS.forEach(L => assert.equal(!!L.mazai, L.day === 5, "день " + L.day));
  const k = day5();
  k.G.dist = k.LEVELS[4].len*0.31;
  assert.ok(k.mazaiBadgeDue());
  k.G.dist = 10;
  assert.ok(!k.mazaiBadgeDue(), "рано");
  k.G.custom = { custom: true, day: 0, river: 2, len: 500, dens: 1e-9, items: [] };
  k.G.dist = 400;
  assert.ok(!k.mazaiBadgeDue(), "в своём уровне нет");
});

test("значок лежит на реке один раз, подбор запускает 30 секунд Мазая", () => {
  const K = day5();
  K.G.dist = K.LEVELS[4].len*0.31;
  K.mazaiStep();                                  // ставит значок
  const badge = K.G.bns.find(b => b.type === "mazai");
  assert.ok(badge && K.G.mazaiPlaced);
  K.mazaiStep(); K.mazaiStep();
  assert.equal(K.G.bns.filter(b => b.type === "mazai").length, 1, "один");
  K.G.bns = [badge];
  K.G.t = K.G.t; badge.t = K.G.t; badge.wy = K.G.pwy;
  const b0 = K.G.bonuses;
  K.chkCl();
  assert.ok(K.G.mazai && !K.G.mazai.done && K.G.mazai.n === 10);
  assert.equal(K.G.bonuses, b0, "значок не считается бонусом дня");
});

test("зайцы выходят по одному с паузой, ровно десять", () => {
  const K = day5();
  K.G.dist = K.LEVELS[4].len*0.31; K.G.mazaiPlaced = true;
  K.startMazai();
  for (let i = 0; i < 61; i++) K.mazaiStep();
  assert.equal(K.G.bns.filter(b => b.type === "hare").length, 1, "первый");
  for (let i = 0; i < K.MAZAI_GAP - 2; i++) K.mazaiStep();
  assert.equal(K.G.bns.filter(b => b.type === "hare").length, 1, "второй ждёт паузу");
  for (let i = 0; i < 3000 && K.G.mazai.spawned < 10; i++) { K.G.bns = K.G.bns.filter(b => b.type !== "hare"); K.mazaiStep(); }
  assert.equal(K.G.mazai.spawned, 10);
});

function play(K, caught, total = 10) {
  K.G.dist = K.LEVELS[4].len*0.31; K.G.mazaiPlaced = true;
  K.startMazai();
  let frames = 0;
  while (!K.G.mazai.done && frames++ < 6000) {
    K.mazaiStep();
    for (const b of K.G.bns.filter(b => b.type === "hare")) {
      if (K.G.mazai.got < caught) { b.t = K.G.t; b.wy = K.G.pwy; K.chkCl(); }     // подобрал
      else { b.wy = K.G.scroll - 2000; K.G.bns = K.G.bns.filter(x => x !== b); K.G.mazai.gone++; }   // упустил
    }
  }
  assert.ok(K.G.mazai.done, "Мазай закончился");
}

test("8 зайцев из 10 — яхта до конца уровня", () => {
  const K = day5();
  play(K, 8);
  assert.equal(K.G.mazai.got, 8);
  assert.ok(K.G.yacht, "яхта");
  assert.ok(K.G.bsc >= 300, "награда");
});

test("7 зайцев из 10 — яхты нет, очки за зайцев", () => {
  const K = day5();
  play(K, 7);
  assert.ok(!K.G.yacht);
  assert.equal(K.G.mazai.got, 7);
  assert.ok(K.G.bsc >= 7*30);
});

test("яхта: удары камня, бревна, соперника, катера и собаки не отнимают сердце; баржа давит", () => {
  const K = day5();
  K.G.yacht = true;
  const rock = { type: "rock", t: K.G.t, wy: K.G.pwy, halfPx: 20, visHalf: 20, visHalfY: 20, vt: 0 };
  K.G.obs = [rock];
  K.chkCl();
  assert.ok(!K.G.obs.includes(rock), "камень разлетелся");
  assert.equal(K.G.hp, 3);
  K.damage();
  assert.equal(K.G.hp, 3, "damage() на яхте не наносит урон");
  const lives = K.G.lives;
  K.crush();
  assert.ok(K.G.lives < lives || K.G.hp < 3 || K.G.s !== "playing", "баржа яхту давит");
});

test("яхта быстрее на 15%, и рисуется вместе с HUD Мазая без ошибок", () => {
  const K = day5();
  assert.equal(K.YACHT_SPEED, 1.15);
  K.G.mazai = { n: 10, spawned: 3, got: 2, gone: 0, wait: 10, t: 300, done: false };
  assert.doesNotThrow(() => { K.drwKy(); K.drwMazaiHud(); });
  K.G.yacht = true;
  assert.doesNotThrow(() => K.drwKy());
  assert.doesNotThrow(() => K.rndr());
});
